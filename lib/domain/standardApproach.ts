// =====================================================================
//  standardApproach.ts — Exigences prudentielles en MÉTHODE STANDARD
//  (approche retenue par la banque) pour le risque de crédit, appliquée aux
//  financements de promotion immobilière.
//
//  Références : dispositif Bâle III final (CRE20 — expositions immobilières),
//  transposé par Bank Al-Maghrib (circulaire relative au calcul des actifs
//  pondérés en approche standard) :
//   - Financement « acquisition, développement et construction » (ADC /
//     promotion immobilière) : pondération 150 % ;
//   - Réduite à 100 % si des critères prudentiels sont remplis (pré-ventes /
//     pré-locations significatives et fonds propres du promoteur substantiels) ;
//   - Immobilier de rapport (exploitation, non résidentiel) : 100 % (repli
//     conservateur sans LTV documentée) ;
//   - Exposition en DÉFAUT : 150 % si les provisions spécifiques < 20 % de
//     l'encours, 100 % sinon ;
//   - RWA calculés sur l'EAD nette des provisions spécifiques.
//  L'exigence de fonds propres applique le ratio de solvabilité BAM (12 %).
//  Les pondérations sont des PARAMÈTRES exposés — à ajuster si la banque
//  documente des critères plus fins (LTV, pré-ventes contractuelles…).
//  Logique PURE et testable.
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Ratio de solvabilité minimal BAM (coefficient de fonds propres total). */
export const BAM_SOLVENCY_RATIO = 0.12;

/** Pondérations méthode standard (paramètres). */
export const STANDARD_RW = {
  /** Promotion immobilière / ADC — cas général. */
  ADC: 1.5,
  /** ADC avec critères prudentiels remplis (pré-ventes + fonds propres). */
  ADC_MITIGATED: 1.0,
  /** Immobilier de rapport (exploitation) — repli conservateur. */
  INCOME_PRODUCING: 1.0,
  /** Défaut, provisions spécifiques < 20 % de l'encours. */
  DEFAULTED_LOW_PROVISION: 1.5,
  /** Défaut, provisions spécifiques ≥ 20 % de l'encours. */
  DEFAULTED_PROVISIONED: 1.0,
} as const;

export interface StandardApproachInput {
  /** PROMOTION (ADC) ou EXPLOITATION (immobilier de rapport). */
  assetType: "PROMOTION" | "EXPLOITATION";
  /** Exposition en défaut (classe BKAM pré-douteux et au-delà). */
  isDefault: boolean;
  /** EAD brute (encours + hors-bilan pondéré CCF). */
  ead: number;
  /** Provisions spécifiques constituées (BKAM). */
  specificProvisions: number;
  /** Critères prudentiels ADC remplis (pré-ventes significatives + FP substantiels). */
  adcCriteriaMet?: boolean;
}

export interface StandardApproachResult {
  /** Catégorie d'exposition retenue. */
  category: "ADC" | "ADC_MITIGATED" | "INCOME_PRODUCING" | "DEFAULTED_LOW_PROVISION" | "DEFAULTED_PROVISIONED";
  label: string;
  riskWeight: number;
  /** EAD nette des provisions spécifiques (assiette des RWA). */
  eadNet: number;
  rwa: number;
  /** Exigence de fonds propres (ratio BAM 12 %). */
  capitalRequirement: number;
  reason: string;
}

const CATEGORY_LABELS: Record<StandardApproachResult["category"], string> = {
  ADC: "Promotion immobilière (ADC) — 150 %",
  ADC_MITIGATED: "Promotion (ADC, critères prudentiels remplis) — 100 %",
  INCOME_PRODUCING: "Immobilier de rapport — 100 %",
  DEFAULTED_LOW_PROVISION: "Exposition en défaut (provisions < 20 %) — 150 %",
  DEFAULTED_PROVISIONED: "Exposition en défaut (provisions ≥ 20 %) — 100 %",
};

/** Pondération et RWA en méthode standard pour une exposition projet. */
export function computeStandardApproach(i: StandardApproachInput): StandardApproachResult {
  const ead = Math.max(0, i.ead);
  const prov = Math.min(Math.max(0, i.specificProvisions), ead);
  const eadNet = round2(ead - prov);

  let category: StandardApproachResult["category"];
  let reason: string;

  if (i.isDefault) {
    const provRate = ead > 0 ? prov / ead : 0;
    if (provRate < 0.2) {
      category = "DEFAULTED_LOW_PROVISION";
      reason = `Défaut avec provisions spécifiques ${(provRate * 100).toFixed(0)} % < 20 % de l'encours.`;
    } else {
      category = "DEFAULTED_PROVISIONED";
      reason = `Défaut avec provisions spécifiques ${(provRate * 100).toFixed(0)} % ≥ 20 % de l'encours.`;
    }
  } else if (i.assetType === "EXPLOITATION") {
    category = "INCOME_PRODUCING";
    reason = "Actif d'exploitation (immobilier de rapport) — pondération conservatrice sans LTV documentée.";
  } else if (i.adcCriteriaMet) {
    category = "ADC_MITIGATED";
    reason = "Financement de promotion avec pré-ventes significatives et fonds propres substantiels du promoteur.";
  } else {
    category = "ADC";
    reason = "Financement d'acquisition, développement et construction (cas général).";
  }

  const riskWeight = STANDARD_RW[category];
  const rwa = round2(riskWeight * eadNet);
  return {
    category,
    label: CATEGORY_LABELS[category],
    riskWeight,
    eadNet,
    rwa,
    capitalRequirement: round2(rwa * BAM_SOLVENCY_RATIO),
    reason,
  };
}

/**
 * Critères prudentiels ADC (indicatifs, paramétrables) : part significative de
 * pré-ventes sécurisées ET apport en fonds propres substantiel du promoteur.
 */
export function adcCriteriaMet(params: {
  preSaleRatePct: number | null | undefined;
  equitySharePct: number | null | undefined;
  preSaleThresholdPct?: number;
  equityThresholdPct?: number;
}): boolean {
  const preSaleOk = (params.preSaleRatePct ?? 0) >= (params.preSaleThresholdPct ?? 50);
  const equityOk = (params.equitySharePct ?? 0) >= (params.equityThresholdPct ?? 20);
  return preSaleOk && equityOk;
}
