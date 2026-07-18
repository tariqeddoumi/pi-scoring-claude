"use server";

// Actions serveur — planning des déblocages du BP initial : jalons
// prévisionnels + rattachement MANUEL des déblocages réels (événements
// « deblocage ») aux jalons. Réservées à project.write, journalisées.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { PERMISSIONS } from "@/lib/rbac";

const milestoneSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  label: z.string().min(2, "Libellé requis"),
  plannedDate: z.string().optional(),
  plannedAmount: z.coerce.number().min(0, "Montant requis"),
});

/** Crée ou met à jour un jalon du planning des déblocages. */
export async function upsertDisbursementMilestone(raw: Record<string, unknown>) {
  const parsed = milestoneSchema.safeParse(raw);
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

  const plannedDate = d.plannedDate?.trim() ? new Date(d.plannedDate) : null;
  const data = {
    label: d.label.trim(),
    plannedDate: plannedDate && !isNaN(plannedDate.getTime()) ? plannedDate : null,
    plannedAmount: d.plannedAmount,
  };

  await prisma.$transaction(async (tx) => {
    if (d.id) {
      await tx.disbursementMilestone.update({ where: { id: d.id }, data });
      await recordAudit({ actorId: actor.id, action: "UPDATE", entity: "DisbursementMilestone", entityId: d.id, after: data, metadata: { projectId: d.projectId } }, tx);
    } else {
      const last = await tx.disbursementMilestone.findFirst({
        where: { projectId: d.projectId },
        orderBy: { seq: "desc" },
        select: { seq: true },
      });
      const created = await tx.disbursementMilestone.create({
        data: { projectId: d.projectId, seq: (last?.seq ?? 0) + 1, ...data },
      });
      await recordAudit({ actorId: actor.id, action: "CREATE", entity: "DisbursementMilestone", entityId: created.id, after: data, metadata: { projectId: d.projectId } }, tx);
    }
  });

  revalidatePath(`/projects/${d.projectId}/suivi`);
  return { ok: true as const };
}

/** Supprime un jalon (les déblocages rattachés redeviennent « à rattacher »). */
export async function deleteDisbursementMilestone(milestoneId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const m = await prisma.disbursementMilestone.findUnique({ where: { id: milestoneId } });
  if (!m) return { ok: false as const, error: "Jalon introuvable." };

  await prisma.$transaction(async (tx) => {
    await tx.disbursementMilestone.delete({ where: { id: milestoneId } });
    await recordAudit({ actorId: actor.id, action: "DELETE", entity: "DisbursementMilestone", entityId: milestoneId, after: { label: m.label }, metadata: { projectId: m.projectId } }, tx);
  });

  revalidatePath(`/projects/${m.projectId}/suivi`);
  return { ok: true as const };
}

/** Rattache (ou détache : milestoneId null) un déblocage à un jalon du plan. */
export async function linkDisbursementToMilestone(eventId: string, milestoneId: string | null) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const ev = await prisma.projectEvent.findUnique({
    where: { id: eventId },
    select: { id: true, projectId: true, type: true },
  });
  if (!ev) return { ok: false as const, error: "Déblocage introuvable." };
  if (ev.type !== "deblocage") return { ok: false as const, error: "Seul un événement de déblocage peut être rattaché au plan." };

  if (milestoneId) {
    const m = await prisma.disbursementMilestone.findUnique({
      where: { id: milestoneId },
      select: { projectId: true },
    });
    if (!m || m.projectId !== ev.projectId) {
      return { ok: false as const, error: "Jalon introuvable pour ce projet." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectEvent.update({ where: { id: eventId }, data: { milestoneId } });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ProjectEvent", entityId: eventId, after: { milestoneId }, metadata: { projectId: ev.projectId, field: "disbursement_link" } },
      tx,
    );
  });

  revalidatePath(`/projects/${ev.projectId}/suivi`);
  return { ok: true as const };
}
