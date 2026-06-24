"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import {
  findTransition,
  outcomeToState,
  quorumReached,
  votesConsistent,
  type WorkflowStateName,
} from "@/lib/workflow";
import { committeeDecisionSchema } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/rbac";

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

/**
 * Enregistre une décision formelle de comité (quorum, votes, conditions) et
 * fait avancer le dossier en conséquence. Réservé à scoring.validate, avec
 * séparation des tâches vis-à-vis de l'analyste instructeur.
 */
export async function recordCommitteeDecision(
  projectId: string,
  raw: Record<string, unknown>,
) {
  const parsed = committeeDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  // Le dossier doit être en comité.
  const last = await prisma.workflowStep.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  const from = (last?.toState ?? "DRAFT") as WorkflowStateName;
  if (from !== "COMMITTEE") {
    return { ok: false as const, error: "Le dossier n'est pas en phase de comité." };
  }

  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_VALIDATE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  // Séparation des tâches : le président du comité ne peut pas être l'analyste
  // ayant instruit le dossier.
  const handoff = await prisma.workflowStep.findFirst({
    where: { projectId, toState: "MANAGER_VALIDATION" },
    orderBy: { createdAt: "desc" },
  });
  if (handoff && handoff.actorId === actor.id) {
    return {
      ok: false as const,
      error: "Séparation des tâches : le président ne peut pas être l'analyste instructeur.",
    };
  }

  if (!quorumReached(d.quorum, d.presentCount)) {
    return { ok: false as const, error: "Quorum non atteint (présents < quorum requis)." };
  }
  if (!votesConsistent(d)) {
    return { ok: false as const, error: "Votes incohérents (somme des voix > présents)." };
  }

  const targetState = outcomeToState(d.outcome);

  await prisma.$transaction(async (tx) => {
    const decision = await tx.committeeDecision.create({
      data: {
        projectId,
        outcome: d.outcome,
        chairId: actor.id,
        quorum: d.quorum,
        presentCount: d.presentCount,
        votesFor: d.votesFor,
        votesAgainst: d.votesAgainst,
        votesAbstain: d.votesAbstain,
        approvedAmount: d.approvedAmount ?? null,
        conditions: d.conditions?.trim() ? d.conditions.trim() : null,
        validUntil: d.validUntil ? new Date(d.validUntil) : null,
        minutesRef: d.minutesRef?.trim() ? d.minutesRef.trim() : null,
      },
    });

    // Transition d'état si la décision est tranchée (hors ajournement).
    if (targetState) {
      await tx.workflowStep.create({
        data: {
          projectId,
          fromState: "COMMITTEE",
          toState: targetState,
          actorId: actor.id,
          comment: `Décision comité : ${d.outcome}`,
        },
      });
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "COMMITTEE_DECISION",
        entity: "CommitteeDecision",
        entityId: decision.id,
        after: {
          outcome: d.outcome,
          targetState,
          votes: { for: d.votesFor, against: d.votesAgainst, abstain: d.votesAbstain },
          quorum: d.quorum,
          presentCount: d.presentCount,
        },
        metadata: { projectId },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const, outcome: d.outcome, targetState };
}
