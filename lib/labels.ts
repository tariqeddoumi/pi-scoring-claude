// Libellés métier centralisés (FR) pour une UX claire et cohérente.

import type { Decision, RegulatoryClassCode, Severity } from "./domain/types";
import { TONE } from "@/lib/tones";
import type { WorkflowStateName } from "@/lib/workflow";

export const DECISION_LABELS: Record<Decision, string> = {
  GO: "Favorable (GO)",
  GO_WITH_CONDITIONS: "Favorable sous conditions",
  WATCH_LIST: "Surveillance (Watch List)",
  NO_GO: "Défavorable (NO GO)",
  DOSSIER_INCOMPLET: "Dossier incomplet",
};

export const DECISION_COLORS: Record<Decision, string> = {
  GO: TONE.success,
  GO_WITH_CONDITIONS: TONE.successSoft,
  WATCH_LIST: TONE.warning,
  NO_GO: TONE.danger,
  DOSSIER_INCOMPLET: "bg-slate-200 text-slate-800 border-slate-400",
};

export const CLASS_LABELS: Record<RegulatoryClassCode, string> = {
  SAIN: "Sain",
  SENSIBLE: "Sensible",
  PRE_DOUTEUX: "Pré-douteux",
  DOUTEUX: "Douteux",
  COMPROMIS: "Compromis",
  CTX: "Contentieux (CTX)",
};

export const CLASS_COLORS: Record<RegulatoryClassCode, string> = {
  SAIN: TONE.success,
  SENSIBLE: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PRE_DOUTEUX: TONE.alert,
  DOUTEUX: "bg-orange-200 text-orange-900 border-orange-400",
  COMPROMIS: TONE.danger,
  CTX: "bg-red-200 text-red-900 border-red-500",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Faible",
  MEDIUM: "Moyenne",
  HIGH: "Élevée",
  BLOCKING: "Bloquante",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: TONE.neutral,
  MEDIUM: TONE.warning,
  HIGH: TONE.alert,
  BLOCKING: "bg-red-100 text-red-800 border-red-400",
};

/** Étape du circuit d'octroi : couleur du badge (une seule définition). */
export const WORKFLOW_STATE_COLORS: Record<WorkflowStateName, string> = {
  DRAFT: TONE.neutral,
  SUBMITTED: TONE.info,
  BRANCH_REVIEW: "bg-cyan-100 text-cyan-800 border-cyan-300",
  ANALYST_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
  MANAGER_VALIDATION: "bg-violet-100 text-violet-800 border-violet-300",
  COMMITTEE: TONE.warning,
  APPROVED: TONE.success,
  REJECTED: TONE.danger,
};
