// Libellés métier centralisés (FR) pour une UX claire et cohérente.

import type { Decision, RegulatoryClassCode, Severity } from "./domain/types";

export const DECISION_LABELS: Record<Decision, string> = {
  GO: "Favorable (GO)",
  GO_WITH_CONDITIONS: "Favorable sous conditions",
  WATCH_LIST: "Surveillance (Watch List)",
  NO_GO: "Défavorable (NO GO)",
};

export const DECISION_COLORS: Record<Decision, string> = {
  GO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  GO_WITH_CONDITIONS: "bg-lime-100 text-lime-800 border-lime-300",
  WATCH_LIST: "bg-amber-100 text-amber-800 border-amber-300",
  NO_GO: "bg-red-100 text-red-800 border-red-300",
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
  SAIN: "bg-emerald-100 text-emerald-800 border-emerald-300",
  SENSIBLE: "bg-yellow-100 text-yellow-800 border-yellow-300",
  PRE_DOUTEUX: "bg-orange-100 text-orange-800 border-orange-300",
  DOUTEUX: "bg-orange-200 text-orange-900 border-orange-400",
  COMPROMIS: "bg-red-100 text-red-800 border-red-300",
  CTX: "bg-red-200 text-red-900 border-red-500",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Faible",
  MEDIUM: "Moyenne",
  HIGH: "Élevée",
  BLOCKING: "Bloquante",
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  BLOCKING: "bg-red-100 text-red-800 border-red-400",
};
