// =====================================================================
//  scoringService.ts
//  Orchestration transactionnelle d'un run complet :
//   classification BKAM -> scoring (avec CoeffBAM & règle CTX) ->
//   garanties éligibles -> provisionnement, le tout journalisé.
//  Toutes les écritures sont dans une seule transaction Prisma.
// =====================================================================

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/server/engines/auditService";
import { runScoring } from "@/server/engines/scoringEngine";
import { classify } from "@/server/engines/regulatoryClassificationEngine";
import { computeEligibleGuarantees } from "@/server/engines/guaranteeEligibilityEngine";
import { computeProvision } from "@/server/engines/provisioningEngine";
import { computeGfaRelief } from "@/lib/domain/gfaVefa";
import { mostSevereClass } from "@/lib/domain/groups";
import {
  loadActiveModelConfig,
  loadActiveRegime,
  loadProjectInputs,
} from "./modelLoader";
import type { GuaranteeInput, RegulatoryClassCode } from "@/lib/domain/types";

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface RunScoringOptions {
  projectId: string;
  actorId: string;
  ead?: number; // exposition pour le provisionnement (défaut: loanAmount)
  reservedAgios?: number;
}

export async function runFullScoring(opts: RunScoringOptions) {
  const { projectId, actorId } = opts;

  return prisma.$transaction(async (tx) => {
    // 1. Charger la configuration et les entrées
    const [{ versionId, config: model }, { regimeId, config: regime, guaranteeTypes, hypEvaluationThreshold }] =
      await Promise.all([loadActiveModelConfig(tx), loadActiveRegime(tx)]);
    const inputs = await loadProjectInputs(tx, projectId);

    const project = await tx.realEstateProject.findUniqueOrThrow({
      where: { id: projectId },
      include: { guarantees: { include: { type: true } } },
    });

    // 1bis. Effet groupe (art.33/50) : classe la plus sévère des entités liées.
    const groupPeerClass = project.groupId
      ? await mostSevereGroupClass(tx, project.groupId, projectId)
      : undefined;

    // 1ter. Contexte de restructuration (art.17-31) issu des entrées.
    const restructuring = {
      restructured: inputs.restructured === "yes",
      count: typeof inputs.restructuring_count === "number" ? inputs.restructuring_count : undefined,
      viable: inputs.restructuring_viable === false ? false : undefined,
      deferralMonths: typeof inputs.restructuring_deferral_months === "number" ? inputs.restructuring_deferral_months : undefined,
      secondDuringObservation: inputs.second_restructuring_in_observation === true,
      dpdOnRestructured: typeof inputs.dpd_on_restructured === "number" ? inputs.dpd_on_restructured : undefined,
    };

    // 2. Classification BKAM (DPD + triggers immobiliers + restructuration + groupe)
    const classification = classify({ regime, inputs, restructuring, groupPeerClass });

    // 3. Scoring (segment/zone + classe réglementaire + règle bloquante CTX)
    const scoring = runScoring({
      model,
      inputs,
      segment: project.segment,
      zone: project.zone,
      regulatoryClass: classification.resultClass,
      classBlocksGo: classification.blocksGo,
    });

    // 4. Persistance du run de scoring
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

    // 5. Classification persistée
    const classRun = await tx.classificationRun.create({
      data: {
        projectId,
        regimeId,
        scoringRunId: run.id,
        resultClass: classification.resultClass,
        isWatchList: classification.isWatchList,
        groupContagionClass: classification.groupContagionClass ?? null,
        restructuringNote: classification.restructuringNote ?? null,
        triggeredBy: classification.triggeredBy as any,
        inputSnapshot: inputs as any,
      },
    });

    // 6. Garanties éligibles (quotités + abattements) + provisionnement
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
      where: { regimeId, class: { code: classification.resultClass } },
      orderBy: { effectiveFrom: "desc" },
    });
    const rate = rateRow?.rate ?? 0;
    const ead = opts.ead ?? project.loanAmount ?? 0;
    const isDefault = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"].includes(
      classification.resultClass,
    );

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
      classCode: classification.resultClass,
      rate,
      // Irrégulière (19/G art.4bis) : souffrance mais couverte 100%.
      isIrregular: isDefault && elig.fullyCoveredByTopTier,
    });

    const provRun = await tx.provisionRun.create({
      data: {
        projectId,
        classificationRunId: classRun.id,
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
    });

    // 7. Audit (CALCULATE / CLASSIFY / PROVISION)
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
    await recordAudit(
      {
        actorId,
        action: "PROVISION",
        entity: "ProvisionRun",
        entityId: provRun.id,
        after: { provisionAmount: provision.provisionAmount, rate, ead },
        metadata: { projectId, classCode: classification.resultClass },
      },
      tx,
    );

    return { run, scoring, classification, provision, eligibleGuarantees: elig };
  });
}

/**
 * Effet groupe (BKAM 19/G art.33 ; 1/W art.50) : retourne la classe la plus
 * sévère parmi les dernières classifications des entités liées du groupe,
 * afin d'examiner la contagion sur la contrepartie évaluée.
 */
async function mostSevereGroupClass(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
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
