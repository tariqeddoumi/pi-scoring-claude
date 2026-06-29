// =====================================================================
//  scoringService.ts — Moteurs DÉCOUPLÉS (Phase 3 du diagnostic)
//
//  Trois services réglementaires indépendants, chacun persistant son propre
//  run et journalisé séparément :
//    1. classification réglementaire BKAM (classifyAndPersist)
//    2. scoring économique D1..D4 + overlay D5 (scoreAndPersist) — consomme
//       UNIQUEMENT la classe réglementaire (CoeffBAM / blocage CTX)
//    3. provisionnement prudentiel (provisionAndPersist) — consomme la classe,
//       l'EAD et les garanties, SANS recalculer le score
//
//  Chaque service est exposé en « runner » autonome (runClassification,
//  runEconomicScoring, runProvisioning) ouvrant sa propre transaction, et
//  réutilisé par l'orchestrateur runFullScoring (séquence chaînée, 1 transaction).
// =====================================================================

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/engines/auditService";
import { runScoring } from "@/server/engines/scoringEngine";
import { classify } from "@/server/engines/regulatoryClassificationEngine";
import { computeEligibleGuarantees } from "@/server/engines/guaranteeEligibilityEngine";
import { computeProvision } from "@/server/engines/provisioningEngine";
import { computeGfaRelief } from "@/lib/domain/gfaVefa";
import { mostSevereClass } from "@/lib/domain/groups";
import { projectEad } from "@/lib/domain/facility";
import {
  loadActiveModelConfig,
  loadActiveRegime,
  loadProjectInputs,
} from "./modelLoader";
import type { GuaranteeInput, RegulatoryClassCode } from "@/lib/domain/types";

const round2 = (v: number) => Math.round(v * 100) / 100;

// Client transactionnel Prisma (réutilisé par les trois moteurs).
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ---------------------------------------------------------------------
//  1. CLASSIFICATION RÉGLEMENTAIRE (indépendante du scoring)
// ---------------------------------------------------------------------

interface ClassifyResult {
  classRun: { id: string };
  classification: ReturnType<typeof classify>;
  regimeId: string;
}

/** Classe une contrepartie/projet selon le régime actif et persiste un ClassificationRun. */
async function classifyAndPersist(tx: Tx, projectId: string, actorId: string): Promise<ClassifyResult> {
  const project = await tx.realEstateProject.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, groupId: true },
  });
  const { regimeId, config: regime } = await loadActiveRegime(tx);
  const inputs = await loadProjectInputs(tx, projectId);

  // Effet groupe (art.33/50) : classe la plus sévère des entités liées.
  const groupPeerClass = project.groupId
    ? await mostSevereGroupClass(tx, project.groupId, projectId)
    : undefined;

  // Contexte de restructuration (art.17-31) issu des entrées.
  const restructuring = {
    restructured: inputs.restructured === "yes",
    count: typeof inputs.restructuring_count === "number" ? inputs.restructuring_count : undefined,
    viable: inputs.restructuring_viable === false ? false : undefined,
    deferralMonths: typeof inputs.restructuring_deferral_months === "number" ? inputs.restructuring_deferral_months : undefined,
    secondDuringObservation: inputs.second_restructuring_in_observation === true,
    dpdOnRestructured: typeof inputs.dpd_on_restructured === "number" ? inputs.dpd_on_restructured : undefined,
  };

  const classification = classify({ regime, inputs, restructuring, groupPeerClass });

  const classRun = await tx.classificationRun.create({
    data: {
      projectId,
      regimeId,
      resultClass: classification.resultClass,
      isWatchList: classification.isWatchList,
      groupContagionClass: classification.groupContagionClass ?? null,
      restructuringNote: classification.restructuringNote ?? null,
      triggeredBy: classification.triggeredBy as any,
      inputSnapshot: inputs as any,
    },
    select: { id: true },
  });

  await recordAudit(
    {
      actorId,
      action: "CLASSIFY",
      entity: "ClassificationRun",
      entityId: classRun.id,
      after: { resultClass: classification.resultClass, regime: regime.code },
      metadata: { projectId },
    },
    tx,
  );

  return { classRun, classification, regimeId };
}

// ---------------------------------------------------------------------
//  2. SCORING ÉCONOMIQUE (consomme la classe réglementaire validée)
// ---------------------------------------------------------------------

interface ScoreResult {
  run: { id: string };
  scoring: ReturnType<typeof runScoring>;
  versionId: string;
}

/**
 * Calcule le score économique du projet et persiste un ScoringRun (+ détails
 * critères/domaines). Consomme la classe réglementaire fournie (CoeffBAM et
 * blocage CTX) ; ne recalcule jamais la classification.
 */
async function scoreAndPersist(
  tx: Tx,
  projectId: string,
  actorId: string,
  regulatoryClass: RegulatoryClassCode | undefined,
  classBlocksGo: boolean,
): Promise<ScoreResult> {
  const project = await tx.realEstateProject.findUniqueOrThrow({
    where: { id: projectId },
    select: { segment: true, zone: true, assetType: true },
  });
  const modelCode = project.assetType === "EXPLOITATION" ? "PI_EXPLOITATION" : "PI_PROMOTION";
  const { versionId, config: model } = await loadActiveModelConfig(tx, modelCode);
  const inputs = await loadProjectInputs(tx, projectId);

  const scoring = runScoring({
    model,
    inputs,
    segment: project.segment,
    zone: project.zone,
    regulatoryClass,
    classBlocksGo,
  });

  const run = await tx.scoringRun.create({
    data: {
      projectId,
      versionId,
      runById: actorId,
      status: "COMPLETED",
      inputSnapshot: inputs as any,
      scoreTechnique: scoring.scoreTechnique,
      scoreAfterPenalties: scoring.scoreAfterPenalties,
      coeffBAM: scoring.coeffBAM,
      scoreFinal: scoring.scoreFinal,
      decision: scoring.decision,
      triggeredRedFlags: scoring.redFlags as any,
      gateBlocked: scoring.gateBlocked,
    },
    select: { id: true },
  });

  // Map domain/criterion codes -> ids pour les résultats
  const domains = await tx.scoringDomain.findMany({
    where: { versionId },
    include: { criteria: true },
  });
  const domainIdByCode = new Map(domains.map((d) => [d.code, d.id]));
  const critIdByCode = new Map(
    domains.flatMap((d) => d.criteria.map((c) => [c.code, c.id] as const)),
  );

  await tx.criterionResult.createMany({
    data: scoring.criteria.map((c) => ({
      runId: run.id,
      criterionId: critIdByCode.get(c.criterionCode)!,
      rawValue: c.rawValue == null ? null : String(c.rawValue),
      score: c.score,
      weighted: c.weighted,
      matchedRef: c.matchedRef,
      gateBlocked: c.gateBlocked,
    })),
  });
  await tx.domainResult.createMany({
    data: scoring.domains.map((d) => ({
      runId: run.id,
      domainId: domainIdByCode.get(d.domainCode)!,
      score: d.score,
      weighted: d.weighted,
    })),
  });

  await recordAudit(
    {
      actorId,
      action: "CALCULATE",
      entity: "ScoringRun",
      entityId: run.id,
      after: {
        scoreFinal: scoring.scoreFinal,
        decision: scoring.decision,
        gateBlocked: scoring.gateBlocked,
      },
      metadata: { projectId, version: model.version },
    },
    tx,
  );

  return { run, scoring, versionId };
}

// ---------------------------------------------------------------------
//  3. PROVISIONNEMENT PRUDENTIEL (consomme classe + EAD + garanties)
// ---------------------------------------------------------------------

interface ProvisionResult {
  provRun: { id: string };
  provision: ReturnType<typeof computeProvision>;
  eligibleGuarantees: ReturnType<typeof computeEligibleGuarantees>;
}

/**
 * Calcule la provision réglementaire à partir d'une classe déjà déterminée,
 * de l'EAD (facilités réelles ou montant de prêt) et des garanties éligibles
 * (quotités/abattements + GFA/VEFA). Ne recalcule NI le score NI la classe.
 */
async function provisionAndPersist(
  tx: Tx,
  projectId: string,
  actorId: string,
  classificationRunId: string,
  classCode: RegulatoryClassCode,
  opts: { ead?: number; reservedAgios?: number },
): Promise<ProvisionResult> {
  const project = await tx.realEstateProject.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      guarantees: { include: { type: true } },
      facilities: { select: { authorizedAmount: true, drawnAmount: true, ccf: true } },
    },
  });
  const { regimeId, guaranteeTypes, hypEvaluationThreshold } = await loadActiveRegime(tx);

  const guaranteeInputs: GuaranteeInput[] = project.guarantees.map((g) => ({
    typeCode: g.type.code,
    marketValue: g.marketValue,
    rank: g.rank,
    yearsInSouffrance: g.yearsInSouffrance,
    recentlyEvaluated: g.recentlyEvaluated,
  }));
  const elig = computeEligibleGuarantees({
    guarantees: guaranteeInputs,
    types: guaranteeTypes,
    hypEvaluationThreshold,
  });

  const rateRow = await tx.provisionRate.findFirst({
    where: { regimeId, class: { code: classCode } },
    orderBy: { effectiveFrom: "desc" },
  });
  const rate = rateRow?.rate ?? 0;
  // EAD réel : somme des facilités (encours + non-tiré pondéré CCF) ; à défaut,
  // le montant de prêt autorisé. Un EAD explicite (opts.ead) reste prioritaire.
  const { ead: realEad } = projectEad(project.facilities, project.loanAmount ?? 0);
  const ead = opts.ead ?? realEad;
  const isDefault = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"].includes(classCode);

  // GFA (Garantie Financière d'Achèvement) : valeur admise en déduction de
  // l'assiette, pleinement qualifiée en cadre VEFA, abattue sinon.
  const gfa = computeGfaRelief({
    saleMode: project.saleMode,
    hasGFA: project.hasGFA,
    gfaAmount: project.gfaAmount,
    exposure: Math.max(0, ead - (opts.reservedAgios ?? 0) - elig.totalEligible),
  });
  const eligibleWithGfa = round2(elig.totalEligible + gfa.admittedValue);
  const breakdown = gfa.applicable
    ? [
        ...elig.lines,
        {
          typeCode: "GFA",
          marketValue: project.gfaAmount ?? 0,
          eligible: true,
          baseQuotity: gfa.quotity,
          effectiveQuotity: gfa.quotity,
          haircut: 0,
          abatementApplied: false,
          eligibleValue: gfa.admittedValue,
          note: gfa.note,
        },
      ]
    : elig.lines;

  const provision = computeProvision({
    ead,
    reservedAgios: opts.reservedAgios ?? 0,
    eligibleGuarantees: eligibleWithGfa,
    classCode,
    rate,
    // Irrégulière (19/G art.4bis) : souffrance mais couverte 100%.
    isIrregular: isDefault && elig.fullyCoveredByTopTier,
  });

  const provRun = await tx.provisionRun.create({
    data: {
      projectId,
      classificationRunId,
      ead: provision.ead,
      reservedAgios: provision.reservedAgios,
      eligibleGuarantees: provision.eligibleGuarantees,
      guaranteeBreakdown: breakdown as any,
      provisionBase: provision.provisionBase,
      rate: provision.rate,
      provisionAmount: provision.provisionAmount,
      classCode: provision.classCode,
      isIrregular: provision.isIrregular,
    },
    select: { id: true },
  });

  await recordAudit(
    {
      actorId,
      action: "PROVISION",
      entity: "ProvisionRun",
      entityId: provRun.id,
      after: { provisionAmount: provision.provisionAmount, rate, ead },
      metadata: { projectId, classCode },
    },
    tx,
  );

  return { provRun, provision, eligibleGuarantees: elig };
}

// ---------------------------------------------------------------------
//  RUNNERS AUTONOMES (chaque moteur appelable indépendamment)
// ---------------------------------------------------------------------

/** Lance la classification réglementaire seule (sans scoring ni provision). */
export async function runClassification(projectId: string, actorId: string) {
  return prisma.$transaction((tx) => classifyAndPersist(tx, projectId, actorId));
}

/**
 * Lance le scoring économique seul, en consommant la dernière classe
 * réglementaire connue du projet (à défaut : SAIN, CoeffBAM = 1).
 */
export async function runEconomicScoring(projectId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.classificationRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { resultClass: true },
    });
    const regulatoryClass = latest?.resultClass;
    const blocksGo = regulatoryClass
      ? (await tx.regulatoryClass.findFirst({
          where: { code: regulatoryClass, regime: { active: true } },
          select: { blocksGo: true },
        }))?.blocksGo ?? false
      : false;
    return scoreAndPersist(tx, projectId, actorId, regulatoryClass, blocksGo);
  });
}

/**
 * Lance le provisionnement seul, en consommant la dernière classification
 * connue du projet. Échoue si aucune classification n'existe encore.
 */
export async function runProvisioning(
  projectId: string,
  actorId: string,
  opts: { ead?: number; reservedAgios?: number } = {},
) {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.classificationRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, resultClass: true },
    });
    if (!latest) {
      throw new Error("Aucune classification disponible : lancez d'abord la classification réglementaire.");
    }
    return provisionAndPersist(tx, projectId, actorId, latest.id, latest.resultClass, opts);
  });
}

// ---------------------------------------------------------------------
//  ORCHESTRATEUR : classification → scoring → provisionnement (1 transaction)
// ---------------------------------------------------------------------

export interface RunScoringOptions {
  projectId: string;
  actorId: string;
  ead?: number; // exposition pour le provisionnement (défaut: loanAmount)
  reservedAgios?: number;
}

/**
 * Enchaîne les trois moteurs découplés dans une seule transaction (chaîne
 * complète historisée) : on classe d'abord, puis on score en consommant la
 * classe, puis on provisionne en consommant la classe + l'EAD + les garanties.
 * Le ScoringRun est rattaché a posteriori au ClassificationRun (traçabilité).
 */
export async function runFullScoring(opts: RunScoringOptions) {
  const { projectId, actorId } = opts;

  return prisma.$transaction(async (tx) => {
    // 1. Classification réglementaire (indépendante)
    const { classRun, classification } = await classifyAndPersist(tx, projectId, actorId);

    // 2. Scoring économique consommant la classe validée
    const { run, scoring } = await scoreAndPersist(
      tx,
      projectId,
      actorId,
      classification.resultClass,
      classification.blocksGo,
    );

    // Rattachement classification ↔ scoring (traçabilité du run complet)
    await tx.classificationRun.update({
      where: { id: classRun.id },
      data: { scoringRunId: run.id },
    });

    // 3. Provisionnement consommant la classe + EAD + garanties
    const { provision, eligibleGuarantees } = await provisionAndPersist(
      tx,
      projectId,
      actorId,
      classRun.id,
      classification.resultClass,
      { ead: opts.ead, reservedAgios: opts.reservedAgios },
    );

    return { run, scoring, classification, provision, eligibleGuarantees };
  });
}

/**
 * Effet groupe (BKAM 19/G art.33 ; 1/W art.50) : retourne la classe la plus
 * sévère parmi les dernières classifications des entités liées du groupe,
 * afin d'examiner la contagion sur la contrepartie évaluée.
 */
async function mostSevereGroupClass(
  tx: Tx,
  groupId: string,
  excludeProjectId: string,
): Promise<RegulatoryClassCode | undefined> {
  const peers = await tx.realEstateProject.findMany({
    where: { groupId, id: { not: excludeProjectId } },
    select: {
      classificationRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { resultClass: true },
      },
    },
  });
  return mostSevereClass(
    peers.map((p) => p.classificationRuns[0]?.resultClass as RegulatoryClassCode | undefined),
  );
}
