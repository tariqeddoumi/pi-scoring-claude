// =====================================================================
//  riskMetrics.ts — Traduction des sorties BKAM vers les standards
//  internationaux de risque de crédit (Bâle & IFRS 9), pour un démarrage
//  simple et lisible par un comité de risque / régulateur.
//
//  - Slotting supervisé (Bâle, "specialised lending" / immobilier de rapport) :
//    catégories Strong/Good/Satisfactory/Weak/Default quand la banque n'a pas
//    l'historique pour un IRB complet — adapté au contexte marocain.
//  - PD/LGD/EAD → Expected Loss = PD × LGD × EAD (cadre IRB / pertes attendues).
//  - Staging IFRS 9 (Stage 1/2/3) aligné sur les classes BKAM 1/W
//    (SAIN → 1, SENSIBLE → 2, souffrance → 3).
//
//  Les paramètres (PD, RW, LGD) sont des points d'ancrage indicatifs, à
//  CALIBRER sur l'historique de la banque. Logique pure et testable.
// =====================================================================

import type { RegulatoryClassCode } from "@/lib/domain/types";

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type SlottingCategory = "STRONG" | "GOOD" | "SATISFACTORY" | "WEAK" | "DEFAULT";
export type IFRS9Stage = 1 | 2 | 3;

// Classes en souffrance (défaut) au sens BKAM 1/W.
const DEFAULT_CLASSES: RegulatoryClassCode[] = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];

export const SLOTTING_LABELS: Record<SlottingCategory, string> = {
  STRONG: "Strong (solide)",
  GOOD: "Good (bon)",
  SATISFACTORY: "Satisfactory (satisfaisant)",
  WEAK: "Weak (faible)",
  DEFAULT: "Default (défaut)",
};

// PD indicative par catégorie de slotting (point d'ancrage à calibrer).
export const SLOTTING_PD: Record<SlottingCategory, number> = {
  STRONG: 0.005,
  GOOD: 0.015,
  SATISFACTORY: 0.04,
  WEAK: 0.12,
  DEFAULT: 1,
};

// Pondération de risque Bâle (slotting financement spécialisé, immobilier de
// rapport, maturité longue) — indicative.
export const SLOTTING_RW: Record<SlottingCategory, number> = {
  STRONG: 0.7,
  GOOD: 0.9,
  SATISFACTORY: 1.15,
  WEAK: 2.5,
  DEFAULT: 0,
};

// LGD senior non garantie (référence FIRB Bâle) et plancher prudentiel.
export const UNSECURED_LGD = 0.45;
export const LGD_FLOOR = 0.05;

/** Stage IFRS 9 à partir de la classe BKAM. */
export function ifrs9Stage(cls: RegulatoryClassCode | null | undefined): IFRS9Stage {
  if (cls && DEFAULT_CLASSES.includes(cls)) return 3;
  if (cls === "SENSIBLE") return 2;
  return 1; // SAIN ou inconnu
}

/** Catégorie de slotting à partir du score final et de la classe. */
export function slottingCategory(
  score: number | null | undefined,
  cls: RegulatoryClassCode | null | undefined,
): SlottingCategory {
  if (cls && DEFAULT_CLASSES.includes(cls)) return "DEFAULT";
  if (score == null) return "WEAK";
  if (score >= 75) return "STRONG";
  if (score >= 60) return "GOOD";
  if (score >= 45) return "SATISFACTORY";
  return "WEAK";
}

/** LGD = max(plancher, LGD non garantie × (1 − taux de couverture)). */
export function lgd(ead: number, eligibleGuarantees: number): number {
  if (ead <= 0) return 0;
  const coverage = clamp01(Math.max(0, eligibleGuarantees) / ead);
  return round4(Math.max(LGD_FLOOR, UNSECURED_LGD * (1 - coverage)));
}

export interface RiskMetricsInput {
  score: number | null;
  cls: RegulatoryClassCode | null;
  ead: number;
  eligibleGuarantees: number;
}

export interface RiskMetrics {
  slotting: SlottingCategory;
  stage: IFRS9Stage;
  pd: number;
  lgd: number;
  ead: number;
  expectedLoss: number; // PD × LGD × EAD
  riskWeight: number;
  rwa: number; // actifs pondérés du risque
}

/** Métriques Bâle/IFRS 9 à partir des sorties BKAM. */
export function computeRiskMetrics(i: RiskMetricsInput): RiskMetrics {
  const slotting = slottingCategory(i.score, i.cls);
  const ead = Math.max(0, i.ead);
  const pd = SLOTTING_PD[slotting];
  const l = lgd(ead, i.eligibleGuarantees);
  const riskWeight = SLOTTING_RW[slotting];
  return {
    slotting,
    stage: ifrs9Stage(i.cls),
    pd,
    lgd: l,
    ead: round2(ead),
    expectedLoss: round2(pd * l * ead),
    riskWeight,
    rwa: round2(riskWeight * ead),
  };
}
