"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { modelTuningSchema } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/rbac";

/**
 * Met à jour le paramétrage du modèle de scoring actif : seuils de décision,
 * ajustements segment/zone et malus des red flags. Réservé à model.write,
 * journalisé. Édition en place de la version publiée (les runs passés conservent
 * leurs résultats déjà calculés) ; s'applique au prochain scoring.
 */
export async function updateModelTuning(raw: Record<string, unknown>) {
  const parsed = modelTuningSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  if (!(d.go > d.goWithConditions && d.goWithConditions > d.watchList)) {
    return { ok: false as const, error: "Les seuils doivent être strictement décroissants : GO > sous conditions > surveillance." };
  }

  let actor;
  try {
    actor = await authorize(PERMISSIONS.MODEL_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const decisionThresholds = { go: d.go, goWithConditions: d.goWithConditions, watchList: d.watchList };

  await prisma.$transaction(async (tx) => {
    await tx.scoringModelVersion.update({
      where: { id: d.versionId },
      data: {
        decisionThresholds: decisionThresholds as Prisma.InputJsonValue,
        segmentAdjustments: d.segmentAdjustments as Prisma.InputJsonValue,
        zoneAdjustments: d.zoneAdjustments as Prisma.InputJsonValue,
      },
    });
    for (const [id, malus] of Object.entries(d.redFlagMalus)) {
      await tx.redFlagRule.updateMany({ where: { id, versionId: d.versionId }, data: { malus } });
    }
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ScoringModelVersion", entityId: d.versionId, after: { decisionThresholds, segmentAdjustments: d.segmentAdjustments, zoneAdjustments: d.zoneAdjustments, redFlagMalus: d.redFlagMalus } },
      tx,
    );
  });

  revalidatePath("/admin/model");
  revalidatePath("/");
  return { ok: true as const };
}
