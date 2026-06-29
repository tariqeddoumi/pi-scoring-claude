"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  runFullScoring,
  runClassification,
  runEconomicScoring,
  runProvisioning,
} from "@/server/services/scoringService";
import { scoringInputsSchema, exploitationInputsSchema } from "@/lib/validation";
import { recordAudit } from "@/server/engines/auditService";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { getProjectMonitoring } from "@/server/queries";
import { deriveScoringInputs, type MonitoringSignals } from "@/lib/domain/scoringSignals";

/** Sauvegarde des entrées du wizard (brouillon) puis option de calcul. */
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
  const schema = project?.assetType === "EXPLOITATION" ? exploitationInputsSchema : scoringInputsSchema;
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

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed.data)) {
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
      { actorId: actor?.id, action: "UPDATE", entity: "ProjectInput", entityId: projectId, after: parsed.data },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
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

  const mon = await getProjectMonitoring(projectId);
  if (!mon) return { ok: false as const, error: "Projet introuvable." };
  if (mon.summary.sales.totalUnits === 0) {
    return { ok: false as const, error: "Aucun lot enregistré : renseignez d'abord le suivi (tranches/lots)." };
  }

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

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(derived.values)) {
      const data = {
        valueNum: typeof value === "number" ? value : null,
        valueStr: null,
        valueBool: typeof value === "boolean" ? value : null,
      };
      await tx.projectInput.upsert({
        where: { projectId_key: { projectId, key } },
        create: { projectId, key, ...data },
        update: data,
      });
    }
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ProjectInput", entityId: projectId, after: derived.values, metadata: { source: "monitoring_sync" } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  revalidatePath(`/projects/${projectId}/suivi`);
  return { ok: true as const, notes: derived.notes };
}
