// =====================================================================
//  reviewPolicy.ts — Politique de revue régulière du scoring.
//  Le score d'un projet doit être rafraîchi :
//   1. périodiquement, selon la classe réglementaire (une créance saine se
//      revoit au moins annuellement ; une sensible/watch-list trimestriellement ;
//      une créance en souffrance mensuellement — revue resserrée 1/W) ;
//   2. immédiatement quand un ÉVÉNEMENT MATÉRIEL (affectsScoring) survient
//      après le dernier calcul.
//  Logique PURE et testable ; périodicités paramétrables.
// =====================================================================

import type { RegulatoryClassCode } from "@/lib/domain/types";

/** Périodicité de revue (jours) par classe réglementaire. */
export const REVIEW_PERIOD_DAYS: Record<RegulatoryClassCode, number> = {
  SAIN: 365,
  SENSIBLE: 90,
  PRE_DOUTEUX: 30,
  DOUTEUX: 30,
  COMPROMIS: 30,
  CTX: 30,
};

/** Période par défaut quand la classe est inconnue (jamais classé). */
export const DEFAULT_REVIEW_PERIOD_DAYS = 90;

export type ScoreFreshnessStatus =
  | "NEVER_SCORED" // aucun scoring exécuté
  | "FRESH" // à jour
  | "DUE_SOON" // échéance de revue < 30 jours
  | "OVERDUE" // périodicité dépassée
  | "EVENT_TRIGGERED"; // événement matériel postérieur au dernier score

export interface ScoreFreshnessInput {
  lastScoredAt: Date | string | null;
  cls: RegulatoryClassCode | null;
  /** Un événement matériel est survenu après lastScoredAt. */
  materialEventSince?: boolean;
  now?: Date;
}

export interface ScoreFreshness {
  status: ScoreFreshnessStatus;
  /** Date limite de la prochaine revue (null si jamais scoré). */
  nextReviewAt: Date | null;
  /** Jours de retard (positif) ou restants (négatif) vs l'échéance. */
  overdueDays: number | null;
  periodDays: number;
  /** Le score doit être recalculé maintenant. */
  needsRescoring: boolean;
  reason: string;
}

const DAY_MS = 24 * 3600 * 1000;

export function scoreFreshness(i: ScoreFreshnessInput): ScoreFreshness {
  const now = i.now ?? new Date();
  const periodDays = i.cls ? REVIEW_PERIOD_DAYS[i.cls] : DEFAULT_REVIEW_PERIOD_DAYS;

  if (!i.lastScoredAt) {
    return {
      status: "NEVER_SCORED",
      nextReviewAt: null,
      overdueDays: null,
      periodDays,
      needsRescoring: true,
      reason: "Aucun scoring n'a encore été exécuté.",
    };
  }

  const last = new Date(i.lastScoredAt);
  const nextReviewAt = new Date(last.getTime() + periodDays * DAY_MS);
  const overdueDays = Math.floor((now.getTime() - nextReviewAt.getTime()) / DAY_MS);

  if (i.materialEventSince) {
    return {
      status: "EVENT_TRIGGERED",
      nextReviewAt,
      overdueDays,
      periodDays,
      needsRescoring: true,
      reason: "Événement matériel survenu après le dernier scoring — re-scorer sans attendre l'échéance.",
    };
  }

  if (overdueDays >= 0) {
    return {
      status: "OVERDUE",
      nextReviewAt,
      overdueDays,
      periodDays,
      needsRescoring: true,
      reason: `Revue périodique dépassée de ${overdueDays} j (périodicité ${periodDays} j).`,
    };
  }

  if (overdueDays >= -30) {
    return {
      status: "DUE_SOON",
      nextReviewAt,
      overdueDays,
      periodDays,
      needsRescoring: false,
      reason: `Revue à prévoir sous ${-overdueDays} j.`,
    };
  }

  return {
    status: "FRESH",
    nextReviewAt,
    overdueDays,
    periodDays,
    needsRescoring: false,
    reason: `Score à jour (prochaine revue dans ${-overdueDays} j).`,
  };
}

export const FRESHNESS_LABELS: Record<ScoreFreshnessStatus, string> = {
  NEVER_SCORED: "Jamais scoré",
  FRESH: "À jour",
  DUE_SOON: "Revue à prévoir",
  OVERDUE: "Revue dépassée",
  EVENT_TRIGGERED: "Événement matériel — re-scorer",
};
