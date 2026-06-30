"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { recordAudit } from "@/server/engines/auditService";
import type { RegulatoryClassCode } from "@/lib/domain/types";

const CLASS_CODES: RegulatoryClassCode[] = ["SAIN", "SENSIBLE", "PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];

/**
 * Demande de dérogation de classification (override comité, 1/W §6.2 #10) :
 * propose de forcer une classe réglementaire différente de celle calculée, avec
 * justification. Statut PENDING jusqu'à décision. Réservé à scoring.validate.
 */
export async function requestRegulatoryOverride(projectId: string, forcedClass: string, justification: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_VALIDATE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
  if (!CLASS_CODES.includes(forcedClass as RegulatoryClassCode)) {
    return { ok: false as const, error: "Classe réglementaire invalide." };
  }
  if (!justification || justification.trim().length < 10) {
    return { ok: false as const, error: "Une justification (≥ 10 caractères) est requise." };
  }

  // Snapshot de la classe calculée par le moteur (dernière classification).
  const last = await prisma.classificationRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { engineClass: true, resultClass: true },
  });
  const engineClass = last?.engineClass ?? last?.resultClass ?? null;

  const ov = await prisma.regulatoryOverride.create({
    data: {
      projectId,
      forcedClass: forcedClass as RegulatoryClassCode,
      engineClass: engineClass ?? undefined,
      justification: justification.trim(),
      status: "PENDING",
      requestedById: actor.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: actor.id, action: "CREATE", entity: "RegulatoryOverride", entityId: ov.id, after: { projectId, forcedClass, engineClass } });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

/**
 * Décision sur une dérogation (approbation / rejet). À l'approbation, la
 * dérogation devient active et les autres dérogations actives du projet sont
 * désactivées. S'applique aux runs de classification suivants. Réservé à
 * scoring.validate ; journalisée.
 */
export async function decideRegulatoryOverride(overrideId: string, approve: boolean) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_VALIDATE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const ov = await prisma.regulatoryOverride.findUnique({ where: { id: overrideId }, select: { id: true, projectId: true, status: true } });
  if (!ov) return { ok: false as const, error: "Dérogation introuvable." };
  if (ov.status !== "PENDING") return { ok: false as const, error: "Dérogation déjà décidée." };

  await prisma.$transaction(async (tx) => {
    if (approve) {
      // Une seule dérogation active par projet.
      await tx.regulatoryOverride.updateMany({ where: { projectId: ov.projectId, active: true }, data: { active: false } });
    }
    await tx.regulatoryOverride.update({
      where: { id: overrideId },
      data: { status: approve ? "APPROVED" : "REJECTED", active: approve, decidedById: actor.id, decidedAt: new Date() },
    });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "RegulatoryOverride", entityId: overrideId, after: { status: approve ? "APPROVED" : "REJECTED" }, metadata: { projectId: ov.projectId } },
      tx,
    );
  });

  revalidatePath(`/projects/${ov.projectId}`);
  return { ok: true as const };
}
