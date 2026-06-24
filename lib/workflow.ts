// =====================================================================
//  Workflow crédit — machine à états (V2).
//  Définit les transitions autorisées entre états du dossier, la permission
//  requise pour chacune, et le cas échéant la séparation des tâches (SoD).
//  Logique pure (importable serveur et client). L'application réelle des
//  droits se fait côté serveur (server/actions/workflow.ts).
// =====================================================================

import { PERMISSIONS, type PermissionCode } from "@/lib/rbac";

export type WorkflowStateName =
  | "DRAFT"
  | "SUBMITTED"
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
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  ANALYST_REVIEW: "Revue analyste",
  MANAGER_VALIDATION: "Validation responsable",
  COMMITTEE: "Comité de crédit",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

export const WORKFLOW_TRANSITIONS: Record<WorkflowStateName, TransitionDef[]> = {
  DRAFT: [
    { to: "SUBMITTED", label: "Soumettre", permission: PERMISSIONS.PROJECT_WRITE, kind: "advance" },
  ],
  SUBMITTED: [
    { to: "ANALYST_REVIEW", label: "Prendre en revue", permission: PERMISSIONS.SCORING_RUN, kind: "advance" },
    { to: "REJECTED", label: "Rejeter", permission: PERMISSIONS.SCORING_RUN, kind: "reject" },
  ],
  ANALYST_REVIEW: [
    { to: "MANAGER_VALIDATION", label: "Transmettre au responsable", permission: PERMISSIONS.SCORING_RUN, kind: "advance" },
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
