// =====================================================================
//  ifrs9.ts — Pertes de crédit attendues (ECL) IFRS 9, en complément de la
//  provision prudentielle BKAM. Les banques marocaines tiennent les deux :
//    - BKAM : provision réglementaire (assiette × taux par classe) ;
//    - IFRS 9 : ECL comptable, à 12 mois en Stage 1, à maturité (lifetime)
//      en Stage 2 et 3.
//  ECL = PD × LGD × EAD, la PD retenue dépendant de l'horizon du stage.
//  Logique pure et testable. Maturité par défaut indicative (à paramétrer).
// =====================================================================

import { ifrs9Stage, type IFRS9Stage } from "@/lib/domain/riskMetrics";
import type { RegulatoryClassCode } from "@/lib/domain/types";

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Maturité moyenne d'un crédit de promotion (années) pour la PD lifetime.
export const DEFAULT_MATURITY_YEARS = 3;

/** PD lifetime à partir de la PD à 12 mois : 1 − (1 − PD)^maturité. */
export function lifetimePd(pd12m: number, years: number = DEFAULT_MATURITY_YEARS): number {
  return round4(1 - Math.pow(1 - clamp01(pd12m), Math.max(1, years)));
}

export interface EclInput {
  stage: IFRS9Stage;
  pd12m: number;
  lgd: number;
  ead: number;
  maturityYears?: number;
}

export interface EclResult {
  stage: IFRS9Stage;
  horizon: "12M" | "LIFETIME";
  pdUsed: number;
  ecl: number;
}

/**
 * ECL IFRS 9 :
 *  - Stage 1 → ECL 12 mois (PD à 12 mois) ;
 *  - Stage 2 → ECL à maturité (PD lifetime) ;
 *  - Stage 3 → créance dépréciée : PD = 100% → ECL = LGD × EAD.
 */
export function computeEcl(i: EclInput): EclResult {
  const ead = Math.max(0, i.ead);
  const lgd = clamp01(i.lgd);
  const years = i.maturityYears ?? DEFAULT_MATURITY_YEARS;

  let pdUsed: number;
  let horizon: "12M" | "LIFETIME";
  if (i.stage === 1) {
    pdUsed = clamp01(i.pd12m);
    horizon = "12M";
  } else if (i.stage === 2) {
    pdUsed = lifetimePd(i.pd12m, years);
    horizon = "LIFETIME";
  } else {
    pdUsed = 1; // Stage 3 : défaut avéré
    horizon = "LIFETIME";
  }

  return { stage: i.stage, horizon, pdUsed, ecl: round2(pdUsed * lgd * ead) };
}

// ---------------------------------------------------------------------
//  SICR — augmentation significative du risque de crédit (IFRS 9 §5.5).
//  Le staging de base suit la classe BKAM (SAIN→1, SENSIBLE→2, défaut→3),
//  mais IFRS 9 exige des critères COMPLÉMENTAIRES qui peuvent dégrader en
//  Stage 2 AVANT que la classe réglementaire ne bouge :
//   - présomption réfutable : arriérés > 30 jours ;
//   - dégradation relative significative du score depuis l'octroi ;
//   - créance restructurée (forbearance) en période d'observation.
// ---------------------------------------------------------------------

/** Chute relative de score (vs octroi) considérée comme significative. */
export const SICR_SCORE_DROP_PCT = 20;
/** Présomption réfutable IFRS 9 : plus de 30 jours d'arriérés. */
export const SICR_DPD_DAYS = 30;

export interface SicrInput {
  cls: RegulatoryClassCode | null;
  /** Retard courant (jours), si connu. */
  dpdDays?: number | null;
  /** Score courant (0-100), si connu. */
  currentScore?: number | null;
  /** Score à l'octroi / premier score (0-100), si connu. */
  initialScore?: number | null;
  /** Créance restructurée en observation (forbearance). */
  restructured?: boolean;
}

export interface SicrResult {
  stage: IFRS9Stage;
  /** Le stage a été dégradé par un critère SICR (vs le stage classe BKAM). */
  sicrTriggered: boolean;
  reasons: string[];
}

/** Stage IFRS 9 final = stage « classe BKAM » aggravé par les critères SICR. */
export function assessSicr(i: SicrInput): SicrResult {
  const baseStage = ifrs9Stage(i.cls);
  const reasons: string[] = [];

  if (baseStage === 3) {
    return { stage: 3, sicrTriggered: false, reasons: ["Créance dépréciée (classe BKAM en défaut)."] };
  }

  if ((i.dpdDays ?? 0) > SICR_DPD_DAYS) {
    reasons.push(`Arriérés de ${i.dpdDays} j > ${SICR_DPD_DAYS} j (présomption réfutable IFRS 9).`);
  }
  if (
    i.currentScore != null &&
    i.initialScore != null &&
    i.initialScore > 0 &&
    ((i.initialScore - i.currentScore) / i.initialScore) * 100 >= SICR_SCORE_DROP_PCT
  ) {
    const dropPct = Math.round(((i.initialScore - i.currentScore) / i.initialScore) * 100);
    reasons.push(`Score dégradé de ${dropPct} % depuis l'octroi (${i.initialScore} → ${i.currentScore}).`);
  }
  if (i.restructured) {
    reasons.push("Créance restructurée en période d'observation (forbearance).");
  }

  const sicrTriggered = baseStage === 1 && reasons.length > 0;
  if (baseStage === 2) reasons.unshift("Classe BKAM sensible (watch list).");
  return { stage: sicrTriggered ? 2 : baseStage, sicrTriggered, reasons };
}
