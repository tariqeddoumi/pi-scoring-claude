"use server";

// Actions serveur — journal d'événements du projet (suivi événementiel).
// Réservées à project.write, journalisées. Les événements matériels
// (affectsScoring) rendent le score « à rafraîchir » (reviewPolicy) et
// alimentent la classification 1/W via la synchronisation des inputs.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { projectEventSchema } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/rbac";
import { EVENT_TYPE_DEFS } from "@/lib/domain/referentiels";

/** Enregistre un événement au journal du projet. */
export async function createProjectEvent(raw: Record<string, unknown>) {
  const parsed = projectEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const def = EVENT_TYPE_DEFS.get(d.type);
  if (!def) return { ok: false as const, error: "Type d'événement inconnu." };

  const eventDate = new Date(d.eventDate);
  if (isNaN(eventDate.getTime())) return { ok: false as const, error: "Date d'événement invalide." };
  const endDate = d.endDate?.trim() ? new Date(d.endDate) : null;

  const data = {
    projectId: d.projectId,
    type: d.type,
    // Sévérité et matérialité : défauts du référentiel, surcharge possible.
    severity: d.severity ?? def.severity,
    affectsScoring: d.affectsScoring ?? def.affectsScoring,
    title: d.title?.trim() || null,
    eventDate,
    endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
    amount: d.amount ?? null,
    note: d.note?.trim() || null,
    createdById: actor.id,
  };

  let created;
  await prisma.$transaction(async (tx) => {
    created = await tx.projectEvent.create({ data });
    await recordAudit(
      { actorId: actor.id, action: "CREATE", entity: "ProjectEvent", entityId: created.id, after: { ...data, eventDate: data.eventDate.toISOString() }, metadata: { projectId: d.projectId } },
      tx,
    );
  });

  revalidatePath(`/projects/${d.projectId}`);
  revalidatePath(`/projects/${d.projectId}/suivi`);
  return { ok: true as const };
}

/** Clôture (résout) un événement ouvert — ex. levée d'arrêt de chantier. */
export async function resolveProjectEvent(eventId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const ev = await prisma.projectEvent.findUnique({ where: { id: eventId } });
  if (!ev) return { ok: false as const, error: "Événement introuvable." };
  if (ev.resolved) return { ok: false as const, error: "Événement déjà clôturé." };

  await prisma.$transaction(async (tx) => {
    await tx.projectEvent.update({
      where: { id: eventId },
      data: { resolved: true, endDate: ev.endDate ?? new Date() },
    });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ProjectEvent", entityId: eventId, after: { resolved: true }, metadata: { projectId: ev.projectId, type: ev.type } },
      tx,
    );
  });

  revalidatePath(`/projects/${ev.projectId}`);
  revalidatePath(`/projects/${ev.projectId}/suivi`);
  return { ok: true as const };
}
