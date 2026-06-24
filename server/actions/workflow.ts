"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { findTransition, type WorkflowStateName } from "@/lib/workflow";

/**
 * Transition d'état d'un dossier crédit. Applique la permission requise,
 * la séparation des tâches (SoD) et journalise (WORKFLOW_TRANSITION).
 */
export async function transitionWorkflow(
  projectId: string,
  toState: WorkflowStateName,
  comment?: string,
) {
  const last = await prisma.workflowStep.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const from = (last?.toState ?? "DRAFT") as WorkflowStateName;

  const transition = findTransition(from, toState);
  if (!transition) {
    return { ok: false as const, error: `Transition ${from} → ${toState} non autorisée.` };
  }

  let actor;
  try {
    actor = await authorize(transition.permission);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  // Séparation des tâches : l'approbateur doit différer de l'analyste ayant
  // transmis le dossier en validation.
  if (transition.sod) {
    const handoff = await prisma.workflowStep.findFirst({
      where: { projectId, toState: "MANAGER_VALIDATION" },
      orderBy: { createdAt: "desc" },
    });
    if (handoff && handoff.actorId === actor.id) {
      return {
        ok: false as const,
        error: "Séparation des tâches : l'approbateur ne peut pas être l'analyste ayant instruit le dossier.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workflowStep.create({
      data: {
        projectId,
        fromState: last ? from : null,
        toState,
        actorId: actor.id,
        comment: comment?.trim() ? comment.trim() : null,
      },
    });
    await recordAudit(
      {
        actorId: actor.id,
        action: "WORKFLOW_TRANSITION",
        entity: "RealEstateProject",
        entityId: projectId,
        after: { from, to: toState, comment: comment ?? null },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, from, to: toState };
}
