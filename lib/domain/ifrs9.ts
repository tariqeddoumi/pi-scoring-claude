// =====================================================================
//  ifrs9.ts — Pertes de crédit attendues (ECL) IFRS 9, en complément de la
//  provision prudentielle BKAM. Les banques marocaines tiennent les deux :
//    - BKAM : provision réglementaire (assiette × taux par classe) ;
//    - IFRS 9 : ECL comptable, à 12 mois en Stage 1, à maturité (lifetime)
//      en Stage 2 et 3.
//  ECL = PD × LGD × EAD, la PD retenue dépendant de l'horizon du stage.
//  Logique pure et testable. Maturité par défaut indicative (à paramétrer).
// =====================================================================

import type { IFRS9Stage } from "@/lib/domain/riskMetrics";

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
