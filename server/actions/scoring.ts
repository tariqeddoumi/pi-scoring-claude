"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  runFullScoring,
  runClassification,
  runEconomicScoring,
  runProvisioning,
} from "@/server/services/scoringService";
import type { ZodObject, ZodRawShape } from "zod";
import { scoringInputsSchema, exploitationInputsSchema } from "@/lib/validation";
import { extendSchemaWithModel } from "@/lib/modelInputs";
import { loadActiveModelConfig } from "@/server/services/modelLoader";
import { recordAudit } from "@/server/engines/auditService";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { getProjectMonitoring } from "@/server/queries";
import { deriveScoringInputs, type MonitoringSignals } from "@/lib/domain/scoringSignals";
import { deriveEventInputs } from "@/lib/domain/eventSignals";
import { deriveMoroccoInputs, type ProgramKind } from "@/lib/domain/morocco";
import { loadMoroccoReferentials, loadDivisionPolicy } from "@/server/services/referentialLoader";
import { computeDivisionRisques } from "@/lib/domain/divisionRisques";
import { financedPerimeter, inPerimeter } from "@/lib/domain/programmeV5";
import { deriveV5Inputs } from "@/server/services/programmeV5Service";
import { scheduleDpd, totalOverdue, overdraftExcessPct } from "@/lib/domain/facility";

/**
 * Sauvegarde des entrées du wizard (brouillon partiel accepté) puis option de
 * calcul. Le schéma suit le modèle PUBLIÉ : une clé ajoutée par
 * l'administration du modèle est acceptée sans redéploiement. Un champ vidé
 * SUPPRIME la valeur (donnée absente) — il n'est jamais converti en 0.
 */
export async function saveProjectInputs(
  projectId: string,
  rawInputs: Record<string, unknown>,
) {
  // Le jeu d'entrées attendu dépend de la nature de l'actif (promotion vs
  // exploitation), qui détermine le modèle de scoring applicable.
  const project = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: { assetType: true },
  });
  const isExploitation = project?.assetType === "EXPLOITATION";
  const baseSchema = (isExploitation ? exploitationInputsSchema : scoringInputsSchema) as unknown as ZodObject<ZodRawShape>;
  let schema: ZodObject<ZodRawShape> = baseSchema;
  try {
    const { config } = await loadActiveModelConfig(prisma, isExploitation ? "PI_EXPLOITATION" : "PI_PROMOTION");
    schema = extendSchemaWithModel(baseSchema, config);
  } catch {
    // Aucun modèle publié : on valide sur le schéma de base.
  }
  const parsed = schema.safeParse(rawInputs);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  // Deny‑by‑default : écriture réservée à la permission project.write.
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  // Seules les clés effectivement transmises sont touchées ; une clé
  // transmise vide est supprimée (absence explicite).
  const sent = Object.keys(rawInputs).filter((k) => k in schema.shape);
  const toWrite: Record<string, number | string | boolean> = {};
  const toDelete: string[] = [];
  for (const key of sent) {
    const value = (parsed.data as Record<string, unknown>)[key];
    if (value === null || value === undefined) toDelete.push(key);
    else toWrite[key] = value as number | string | boolean;
  }

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(toWrite)) {
      const data = {
        valueNum: typeof value === "number" ? value : null,
        valueStr: typeof value === "string" ? value : null,
        valueBool: typeof value === "boolean" ? value : null,
      };
      await tx.projectInput.upsert({
        where: { projectId_key: { projectId, key } },
        create: { projectId, key, ...data },
        update: data,
      });
    }
    if (toDelete.length > 0) {
      await tx.projectInput.deleteMany({ where: { projectId, key: { in: toDelete } } });
    }
    await recordAudit(
      {
        actorId: actor?.id,
        action: "UPDATE",
        entity: "ProjectInput",
        entityId: projectId,
        after: { ...toWrite, ...(toDelete.length ? { _cleared: toDelete } : {}) },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, cleared: toDelete };
}

/** Lance le pipeline complet de scoring/classification/provisionnement. */
export async function runScoringAction(projectId: string, ead?: number, reservedAgios?: number) {
  // Deny‑by‑default : lancement de scoring réservé à la permission scoring.run.
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const result = await runFullScoring({
    projectId,
    actorId: actor.id,
    ead,
    reservedAgios,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  revalidatePath("/");
  return {
    ok: true as const,
    scoreFinal: result.scoring.scoreFinal,
    decision: result.scoring.decision,
    resultClass: result.classification.resultClass,
    provisionAmount: result.provision.provisionAmount,
  };
}

/** Lance la CLASSIFICATION réglementaire seule (moteur découplé). */
export async function runClassificationAction(projectId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
  const { classification } = await runClassification(projectId, actor.id);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  return { ok: true as const, resultClass: classification.resultClass, isWatchList: classification.isWatchList };
}

/** Lance le SCORING économique seul (consomme la dernière classe connue). */
export async function runEconomicScoringAction(projectId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
  const { scoring } = await runEconomicScoring(projectId, actor.id);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  return { ok: true as const, scoreFinal: scoring.scoreFinal, decision: scoring.decision };
}

/** Lance le PROVISIONNEMENT seul (consomme la dernière classification). */
export async function runProvisioningAction(projectId: string, ead?: number, reservedAgios?: number) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
  try {
    const { provision } = await runProvisioning(projectId, actor.id, { ead, reservedAgios });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/scoring`);
    return { ok: true as const, provisionAmount: provision.provisionAmount, classCode: provision.classCode };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/**
 * Synchronise les inputs de scoring dérivés du SUIVI réel (commercialisation +
 * avancement chantier) vers ProjectInput : prévente, ventes vs plan, avancement
 * vs plan, décalage business plan. Réservé à project.write, journalisé. Permet
 * de re-scorer « à mesure de l'avancement » sans ressaisie. Renvoie les valeurs
 * appliquées (pour affichage). Ne lance pas le scoring (étape suivante au choix).
 */
export async function syncMonitoringToInputs(projectId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
  return syncMonitoringCore(projectId, actor.id);
}

/** Corps de la synchronisation (autorisation vérifiée par l'appelant). */
async function syncMonitoringCore(projectId: string, actorId: string) {
  const mon = await getProjectMonitoring(projectId);
  if (!mon) return { ok: false as const, error: "Projet introuvable." };

  // 1. Signaux de commercialisation/avancement (si des lots existent).
  const values: Record<string, string | number | boolean> = {};
  const notes: { key: string; label: string; value?: string; reason: string }[] = [];
  if (mon.summary.sales.totalUnits > 0) {
    const signals: MonitoringSignals = {
      preSaleRatePct: mon.summary.sales.preSaleRatePct,
      salesVsPlanPct: mon.summary.businessPlan.salesVsPlanPct,
      caDeltaPct: mon.summary.businessPlan.caDeltaPct,
      unitsLate: mon.summary.businessPlan.unitsLate,
      totalUnits: mon.summary.sales.totalUnits,
      observedProgressPct: mon.visitAnalysis.trend.latestProgressPct,
      plannedProgressPct: mon.plannedProgressPct,
    };
    const derived = deriveScoringInputs(signals);
    Object.assign(values, derived.values);
    notes.push(...derived.notes);
  }

  // 2. Signaux du journal d'événements (arrêt de chantier, litige, saisie,
  //    restructuration… → inputs de classification 1/W).
  const events = await prisma.projectEvent.findMany({
    where: { projectId },
    select: { type: true, eventDate: true, endDate: true, resolved: true, affectsScoring: true },
  });
  const fromEvents = deriveEventInputs(events);
  Object.assign(values, fromEvents.values);
  notes.push(...fromEvents.notes);

  // 3. Impayés RÉELS depuis l'échéancier des facilités : le DPD dérivé de la
  //    plus ancienne échéance impayée alimente les bascules art.10-12 sans
  //    ressaisie. Le dépassement de ligne (%) est également mesuré (sa durée
  //    reste à documenter manuellement — art.10-12).
  const facilities = await prisma.facility.findMany({
    where: { projectId },
    select: { authorizedAmount: true, drawnAmount: true, installments: { select: { dueDate: true, amountDue: true, amountPaid: true } } },
  });
  const installments = facilities.flatMap((f) => f.installments);
  if (installments.length > 0) {
    const now = new Date();
    const dpd = scheduleDpd(installments, now);
    const overdue = totalOverdue(installments, now);
    values.dpd_days = dpd;
    notes.push({
      key: "dpd_days",
      label: "Retard (DPD) dérivé de l'échéancier",
      value: `${dpd} j`,
      reason: dpd > 0
        ? `Plus ancienne échéance impayée : ${dpd} j de retard, ${overdue.toLocaleString("fr-FR")} MAD échus non payés.`
        : "Aucune échéance échue impayée.",
    });
    const excess = overdraftExcessPct(facilities);
    if (excess > 0) {
      values.overdraft_excess_pct = excess;
      notes.push({
        key: "overdraft_excess_pct",
        label: "Dépassement de ligne",
        value: `${excess} %`,
        reason: "Encours tiré > autorisé — renseignez la durée du dépassement (art.10-12).",
      });
    }
  }

  // 4. Signaux alignés sur la pratique marocaine : complétude de la chaîne
  //    d'autorisations (verrou de tirage), ventes sécurisées pondérées par le
  //    financement de l'acquéreur, et quotité de désengagement des mainlevées.
  const projectForMorocco = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: {
      programKind: true,
      releaseQuotity: true,
      authorizations: { select: { code: true, obtained: true, obtainedAt: true } },
      facilities: { select: { drawnAmount: true, trancheId: true, status: true } },
      tranches: {
        select: {
          id: true, financed: true,
          units: {
            select: {
              status: true, plannedPrice: true, soldPrice: true,
              buyerFinancingStatus: true,
            },
          },
        },
      },
    },
  });
  if (projectForMorocco) {
    // Référentiels administrables (repli sur les défauts du code).
    const refs = await loadMoroccoReferentials(prisma);
    // Modèle v5 : ventes sécurisées et désengagement mesurés sur le PÉRIMÈTRE
    // FINANCÉ (tranches financées) et non sur le programme entier.
    const per = financedPerimeter(
      projectForMorocco.tranches.map((t) => ({ id: t.id, financed: t.financed })),
      projectForMorocco.facilities.map((f) => f.trancheId),
    );
    const units = projectForMorocco.tranches.filter((t) => inPerimeter(per, t.id)).flatMap((t) => t.units);
    const outstandingDebt = projectForMorocco.facilities
      .filter((f) => f.status !== "CLOSED" && (per.wholeProgramme || !f.trancheId || inPerimeter(per, f.trancheId)))
      .reduce((s, f) => s + (f.drawnAmount ?? 0), 0);
    const moroccoInputs = deriveMoroccoInputs({
      kind: (projectForMorocco.programKind as ProgramKind) ?? "CONSTRUCTION",
      authorizations: projectForMorocco.authorizations.map((a) => ({
        code: a.code, obtained: a.obtained, obtainedAt: a.obtainedAt,
      })),
      units: units.map((u) => ({
        price: u.soldPrice ?? u.plannedPrice ?? 0,
        financingStatus: u.buyerFinancingStatus ?? "",
        contractSecured: ["RESERVE", "COMPROMIS", "VENDU", "LIVRE"].includes(u.status),
        sold: ["VENDU", "LIVRE"].includes(u.status),
      })),
      releaseQuotity: projectForMorocco.releaseQuotity,
      outstandingDebt,
    }, { chain: refs.chain, financing: refs.financing, natures: refs.natures });
    for (const [key, value] of Object.entries(moroccoInputs)) {
      if (value === undefined) continue;
      values[key] = value as string | number | boolean;
    }
    notes.push({
      key: "authorization_completeness_pct",
      label: "Chaîne d'autorisations",
      value: `${moroccoInputs.authorization_completeness_pct} %`,
      reason: moroccoInputs.works_authorization_blocked
        ? "Une autorisation indispensable aux travaux financés est manquante — verrou de tirage."
        : "Aucun verrou d'autorisation de travaux ouvert.",
    });
  }

  // 4 bis. Modèle v5 : régionalité, périmètre financé, programme mixte,
  //    équipements exigés, déblocages selon le calendrier, désistements.
  const v5 = await deriveV5Inputs(projectId, mon.visitAnalysis.trend.latestProgressPct ?? null);
  Object.assign(values, v5.values);
  notes.push(...v5.notes);

  // 5. Division des risques : exposition agrégée de la contrepartie (groupe
  //    d'intérêt s'il est renseigné, sinon promoteur) rapportée aux fonds
  //    propres paramétrés. Sans politique paramétrée, la clé n'est pas
  //    renseignée (contrôle non effectué, signalé).
  const division = await deriveDivisionBreach(projectId);
  if (division) {
    if (division.breach !== null) values.division_limit_breach = division.breach;
    notes.push({
      key: "division_limit_breach",
      label: "Division des risques",
      value: division.breach === null ? undefined : division.breach ? "dépassée" : "respectée",
      reason: division.reason,
    });
  }

  if (Object.keys(values).length === 0) {
    return { ok: false as const, error: "Rien à synchroniser : ni lots de suivi, ni événement matériel au journal." };
  }

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      const data = {
        valueNum: typeof value === "number" ? value : null,
        valueStr: typeof value === "string" ? value : null,
        valueBool: typeof value === "boolean" ? value : null,
      };
      await tx.projectInput.upsert({
        where: { projectId_key: { projectId, key } },
        create: { projectId, key, ...data },
        update: data,
      });
    }
    await recordAudit(
      { actorId, action: "UPDATE", entity: "ProjectInput", entityId: projectId, after: values, metadata: { source: "monitoring_sync" } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  revalidatePath(`/projects/${projectId}/suivi`);
  return { ok: true as const, notes };
}

/**
 * Contrôle de division des risques pour la contrepartie du projet (groupe
 * d'intérêt si renseigné, sinon promoteur). Renvoie null si le projet est
 * introuvable ; breach = null si la politique n'est pas paramétrée.
 */
async function deriveDivisionBreach(
  projectId: string,
): Promise<{ breach: boolean | null; reason: string } | null> {
  const project = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: { groupId: true, promoterId: true, promoter: { select: { groupId: true } } },
  });
  if (!project) return null;
  const policy = await loadDivisionPolicy(prisma);
  if (!policy) {
    return {
      breach: null,
      reason: "Fonds propres prudentiels non paramétrés (Référentiels › Limites prudentielles, code DIVISION_RISQUES) : contrôle non effectué.",
    };
  }
  const groupId = project.groupId ?? project.promoter.groupId ?? null;
  const peers = await prisma.realEstateProject.findMany({
    where: groupId
      ? { OR: [{ groupId }, { promoter: { groupId } }] }
      : { promoterId: project.promoterId },
    select: {
      reference: true,
      loanAmount: true,
      facilities: { select: { label: true, authorizedAmount: true, drawnAmount: true, ccf: true, status: true } },
    },
  });
  const lines = peers.flatMap((p) => {
    const active = p.facilities.filter((f) => f.status !== "CLOSED");
    if (active.length === 0) {
      // Sans facilité saisie : le montant de crédit autorisé du projet.
      return p.loanAmount ? [{ label: p.reference, drawn: 0, undrawn: p.loanAmount, ccf: 1 }] : [];
    }
    return active.map((f) => ({
      label: `${p.reference} · ${f.label}`,
      drawn: f.drawnAmount,
      undrawn: Math.max(0, f.authorizedAmount - f.drawnAmount),
      ccf: f.ccf,
    }));
  });
  const res = computeDivisionRisques(lines, policy);
  const scope = groupId ? "groupe d'intérêt" : "promoteur";
  return {
    breach: res.breach,
    reason:
      `Exposition ${scope} : ${res.netExposure.toLocaleString("fr-FR")} MAD, soit ${(res.exposureRatio * 100).toFixed(1)} % des fonds propres ` +
      `(limite ${(res.limitPct * 100).toFixed(0)} %).` + (res.warnings.length ? " " + res.warnings.join(" ") : ""),
  };
}

/**
 * Recalcule tout le portefeuille sur le modèle PUBLIÉ (après publication
 * d'une nouvelle version, les scores existants restent ceux de l'ancienne
 * version tant qu'ils ne sont pas recalculés). Option : synchroniser d'abord
 * les données de suivi (autorisations, financement acquéreur, désengagement,
 * division des risques, impayés) pour alimenter les critères dérivés.
 * Chaque projet est traité isolément ; un échec n'arrête pas les autres.
 */
export async function rescorePortfolioAction(opts: { syncFirst?: boolean; onlyStale?: boolean } = {}) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.MODEL_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const projects = await prisma.realEstateProject.findMany({
    select: {
      id: true,
      reference: true,
      assetType: true,
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { version: { select: { status: true } } } },
    },
    orderBy: { reference: "asc" },
  });
  const targets = opts.onlyStale
    ? projects.filter((p) => p.scoringRuns[0]?.version.status !== "PUBLISHED")
    : projects;

  let scored = 0;
  let synced = 0;
  const errors: string[] = [];
  const decisions: Record<string, number> = {};
  for (const p of targets) {
    try {
      if (opts.syncFirst && p.assetType !== "EXPLOITATION") {
        const r = await syncMonitoringCore(p.id, actor.id);
        if (r.ok) synced += 1;
      }
      const res = await runFullScoring({ projectId: p.id, actorId: actor.id });
      scored += 1;
      decisions[res.scoring.decision] = (decisions[res.scoring.decision] ?? 0) + 1;
    } catch (e) {
      errors.push(`${p.reference} : ${e instanceof Error ? e.message : "échec du calcul"}`);
    }
  }

  await recordAudit({
    actorId: actor.id,
    action: "CALCULATE",
    entity: "Portfolio",
    after: { scored, synced, failed: errors.length, decisions },
    metadata: { source: "portfolio_rescore", syncFirst: !!opts.syncFirst, onlyStale: !!opts.onlyStale },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  return { ok: true as const, total: targets.length, scored, synced, decisions, errors };
}

