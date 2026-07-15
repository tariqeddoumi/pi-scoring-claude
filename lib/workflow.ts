// =====================================================================
//  Workflow crédit — machine à états (V2).
//  Définit les transitions autorisées entre états du dossier, la permission
//  requise pour chacune, et le cas échéant la séparation des tâches (SoD).
//  Logique pure (importable serveur et client). L'application réelle des
//  droits se fait côté serveur (server/actions/workflow.ts).
// =====================================================================

import { PERMISSIONS, hasPermission, type PermissionCode, type RoleName } from "@/lib/rbac";

export type WorkflowStateName =
  | "DRAFT"
  | "SUBMITTED"
  | "BRANCH_REVIEW"
  | "ANALYST_REVIEW"
  | "MANAGER_VALIDATION"
  | "COMMITTEE"
  | "APPROVED"
  | "REJECTED";

export interface TransitionDef {
  to: WorkflowStateName;
  label: string;
  permission: PermissionCode;
  // Séparation des tâches : l'acteur doit différer de l'analyste ayant
  // transmis le dossier en validation (anti auto-validation).
  sod?: boolean;
  kind?: "advance" | "reject" | "rework";
}

export const WORKFLOW_LABELS: Record<WorkflowStateName, string> = {
  DRAFT: "Brouillon (chargé d'affaires)",
  SUBMITTED: "Soumis",
  BRANCH_REVIEW: "Avis directeur de centre d'affaires",
  ANALYST_REVIEW: "Contre-étude (Risque)",
  MANAGER_VALIDATION: "Décision (délégation)",
  COMMITTEE: "Comité de crédit",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

export const WORKFLOW_TRANSITIONS: Record<WorkflowStateName, TransitionDef[]> = {
  DRAFT: [
    { to: "SUBMITTED", label: "Soumettre", permission: PERMISSIONS.PROJECT_WRITE, kind: "advance" },
  ],
  SUBMITTED: [
    { to: "BRANCH_REVIEW", label: "Prendre pour avis (DCA)", permission: PERMISSIONS.WORKFLOW_ENDORSE, kind: "advance" },
    // Chemin de compatibilité : la contre-étude peut se saisir directement du
    // dossier (petits centres sans étage DCA, dossiers historiques).
    { to: "ANALYST_REVIEW", label: "Prendre en contre-étude", permission: PERMISSIONS.SCORING_RUN, kind: "advance" },
    { to: "REJECTED", label: "Rejeter", permission: PERMISSIONS.SCORING_RUN, kind: "reject" },
  ],
  BRANCH_REVIEW: [
    { to: "ANALYST_REVIEW", label: "Avis favorable — transmettre à la contre-étude", permission: PERMISSIONS.WORKFLOW_ENDORSE, kind: "advance" },
    { to: "DRAFT", label: "Renvoyer au chargé d'affaires", permission: PERMISSIONS.WORKFLOW_ENDORSE, kind: "rework" },
    { to: "REJECTED", label: "Avis défavorable — rejeter", permission: PERMISSIONS.WORKFLOW_ENDORSE, kind: "reject" },
  ],
  ANALYST_REVIEW: [
    { to: "MANAGER_VALIDATION", label: "Score validé — transmettre à la décision", permission: PERMISSIONS.SCORING_RUN, kind: "advance" },
    { to: "DRAFT", label: "Renvoyer au chargé d'affaires", permission: PERMISSIONS.SCORING_RUN, kind: "rework" },
    { to: "REJECTED", label: "Rejeter", permission: PERMISSIONS.SCORING_RUN, kind: "reject" },
  ],
  MANAGER_VALIDATION: [
    { to: "COMMITTEE", label: "Passer en comité", permission: PERMISSIONS.SCORING_VALIDATE, kind: "advance" },
    { to: "APPROVED", label: "Approuver", permission: PERMISSIONS.SCORING_VALIDATE, sod: true, kind: "advance" },
    { to: "REJECTED", label: "Rejeter", permission: PERMISSIONS.SCORING_VALIDATE, kind: "reject" },
  ],
  COMMITTEE: [
    { to: "APPROVED", label: "Décision favorable", permission: PERMISSIONS.SCORING_VALIDATE, sod: true, kind: "advance" },
    { to: "REJECTED", label: "Décision défavorable", permission: PERMISSIONS.SCORING_VALIDATE, kind: "reject" },
  ],
  APPROVED: [],
  REJECTED: [
    { to: "DRAFT", label: "Reprendre le dossier", permission: PERMISSIONS.PROJECT_WRITE, kind: "rework" },
  ],
};

export function allowedTransitions(from: WorkflowStateName): TransitionDef[] {
  return WORKFLOW_TRANSITIONS[from] ?? [];
}

export function findTransition(
  from: WorkflowStateName,
  to: WorkflowStateName,
): TransitionDef | undefined {
  return allowedTransitions(from).find((t) => t.to === to);
}

export function isTerminal(state: WorkflowStateName): boolean {
  return allowedTransitions(state).length === 0;
}

// --- File d'attente ("mes dossiers à traiter") -------------------------

/** Transitions qu'un rôle peut déclencher depuis un état donné. */
export function roleTransitions(role: RoleName, from: WorkflowStateName): TransitionDef[] {
  return allowedTransitions(from).filter((t) => hasPermission(role, t.permission));
}

/** États depuis lesquels le rôle dispose d'au moins une action workflow. */
export function actionableStatesFor(role: RoleName): WorkflowStateName[] {
  return (Object.keys(WORKFLOW_TRANSITIONS) as WorkflowStateName[]).filter(
    (s) => roleTransitions(role, s).length > 0,
  );
}

// --- Décision de comité ------------------------------------------------

export type CommitteeOutcomeName =
  | "FAVORABLE"
  | "FAVORABLE_CONDITIONS"
  | "DEFAVORABLE"
  | "AJOURNE";

export const COMMITTEE_OUTCOME_LABELS: Record<CommitteeOutcomeName, string> = {
  FAVORABLE: "Favorable",
  FAVORABLE_CONDITIONS: "Favorable sous conditions",
  DEFAVORABLE: "Défavorable",
  AJOURNE: "Ajourné",
};

/** État cible du dossier selon le sens de la décision (null = reste en comité). */
export function outcomeToState(outcome: CommitteeOutcomeName): WorkflowStateName | null {
  switch (outcome) {
    case "FAVORABLE":
    case "FAVORABLE_CONDITIONS":
      return "APPROVED";
    case "DEFAVORABLE":
      return "REJECTED";
    case "AJOURNE":
      return null;
  }
}

/** Le quorum est atteint si suffisamment de membres sont présents. */
export function quorumReached(quorum: number, presentCount: number): boolean {
  return presentCount > 0 && presentCount >= quorum;
}

/** Cohérence des votes : la somme des voix ne dépasse pas les présents. */
export function votesConsistent(v: {
  presentCount: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
}): boolean {
  return v.votesFor + v.votesAgainst + v.votesAbstain <= v.presentCount;
}
