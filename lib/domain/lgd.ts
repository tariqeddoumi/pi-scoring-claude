// =====================================================================
//  lgd.ts — Waterfall de recouvrement et LGD (diagnostic F14).
//
//  Le diagnostic relève qu'une quotité de garantie, un rang et une LTV ne
//  mesurent PAS une perte après défaut : la valeur d'un projet achevé diffère de
//  sa valeur en l'état ; le coût d'achèvement, les créanciers prioritaires, les
//  délais et frais de réalisation, puis l'actualisation, peuvent absorber la
//  couverture apparente. Ce module construit un WATERFALL de recouvrement par
//  actif et en dérive :
//   - la valeur économique nette de réalisation (recouvrement attendu) ;
//   - la valeur admissible à déduction prudentielle (après abattements) ;
//   - la sûreté juridiquement opposable (éligible + rang) ;
//   - la LGD = 1 − recouvrement net / EAD.
//  Anti-double comptage : chaque lot/actif n'est valorisé qu'une fois (le prix
//  des mêmes lots ne peut pas servir deux fois — F09/F14).
//  Logique PURE, déterministe, testable — aucune dépendance base.
// =====================================================================

export interface RecoveryAsset {
  label: string;
  /** Valeur à dire d'expert de l'actif ACHEVÉ (ou en l'état si déjà livré). */
  grossValue: number;
  /** Coût restant d'achèvement à engager pour atteindre la valeur ci-dessus. */
  costToComplete?: number;
  /** Encours des créanciers PRIORITAIRES (rangs antérieurs) sur cet actif. */
  priorClaims?: number;
  /** Quotité revenant à la banque en cas de partage (0..1 ; défaut 1). */
  bankShare?: number;
  /** Décote de réalisation forcée (0..1) appliquée à la valeur brute. */
  saleDiscount?: number;
  /** Frais de procédure et de réalisation (0..1) sur le produit de vente. */
  procedureCosts?: number;
  /** Délai de réalisation en mois (pour l'actualisation). */
  monthsToSale?: number;
  /** Éligible en garantie prudentielle et juridiquement opposable ? */
  eligible?: boolean;
  /** Sûreté de 1er rang opposable (pour la vue « opposable »). */
  rank1?: boolean;
}

export interface LgdParams {
  ead: number; // exposition au défaut
  assets: RecoveryAsset[];
  /** Taux d'actualisation annuel (défaut 8 %). */
  annualDiscountRate?: number;
  /** Recouvrements hors sûretés (cash, cautions personnelles activées…). */
  otherRecoveries?: number;
  /** Abattement prudentiel additionnel sur la valeur éligible (0..1). */
  prudentialHaircut?: number;
}

export interface AssetRecovery {
  label: string;
  grossValue: number;
  afterCompletion: number; // valeur − coût d'achèvement
  afterDiscount: number; // × (1 − décote de réalisation)
  afterPriorAndShare: number; // − créanciers prioritaires, × quotité banque
  afterCosts: number; // × (1 − frais de procédure)
  netRecovery: number; // actualisé — recouvrement net attribuable à la banque
  eligible: boolean;
  rank1: boolean;
}

export interface LgdResult {
  assets: AssetRecovery[];
  /** Valeur économique nette de réalisation (Σ recouvrements nets actualisés). */
  economicNetRecovery: number;
  /** Valeur admissible à déduction prudentielle (éligibles, après abattement). */
  prudentialAdmissibleValue: number;
  /** Sûreté juridiquement opposable (éligible + 1er rang). */
  enforceableValue: number;
  /** Recouvrement total (économique + autres recouvrements). */
  totalRecovery: number;
  /** LGD = 1 − recouvrement total / EAD, bornée [0 ; 1]. */
  lgd: number;
  /** Taux de recouvrement = 1 − LGD. */
  recoveryRate: number;
  /** Perte attendue en cas de défaut (EAD × LGD). */
  expectedLossGivenDefault: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const n = (v: number | undefined) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

/** Construit le waterfall par actif et en dérive la LGD. */
export function computeLgd(params: LgdParams): LgdResult {
  const rate = params.annualDiscountRate ?? 0.08;
  const haircut = clamp01(n(params.prudentialHaircut));

  const assets: AssetRecovery[] = params.assets.map((a) => {
    const afterCompletion = a.grossValue - n(a.costToComplete);
    const afterDiscount = afterCompletion * (1 - clamp01(n(a.saleDiscount)));
    // Créanciers prioritaires servis d'abord, puis quotité de partage de la banque.
    const share = a.bankShare == null ? 1 : clamp01(a.bankShare);
    const afterPriorAndShare = Math.max(0, afterDiscount - n(a.priorClaims)) * share;
    const afterCosts = afterPriorAndShare * (1 - clamp01(n(a.procedureCosts)));
    // Actualisation sur le délai de réalisation.
    const months = n(a.monthsToSale);
    const discountFactor = months > 0 ? 1 / Math.pow(1 + rate, months / 12) : 1;
    const netRecovery = Math.max(0, round2(afterCosts * discountFactor));
    return {
      label: a.label,
      grossValue: round2(a.grossValue),
      afterCompletion: round2(afterCompletion),
      afterDiscount: round2(afterDiscount),
      afterPriorAndShare: round2(afterPriorAndShare),
      afterCosts: round2(afterCosts),
      netRecovery,
      eligible: a.eligible !== false,
      rank1: a.rank1 === true,
    } as AssetRecovery;
  });

  const economicNetRecovery = round2(assets.reduce((s, a) => s + a.netRecovery, 0));
  const prudentialAdmissibleValue = round2(
    assets.filter((a) => a.eligible).reduce((s, a) => s + a.netRecovery, 0) * (1 - haircut),
  );
  const enforceableValue = round2(
    assets.filter((a) => a.eligible && a.rank1).reduce((s, a) => s + a.netRecovery, 0),
  );

  const totalRecovery = round2(economicNetRecovery + n(params.otherRecoveries));
  const ead = params.ead > 0 ? params.ead : 0;
  const lgd = ead > 0 ? round4(clamp01(1 - totalRecovery / ead)) : 0;
  const recoveryRate = round4(1 - lgd);
  return {
    assets,
    economicNetRecovery,
    prudentialAdmissibleValue,
    enforceableValue,
    totalRecovery,
    lgd,
    recoveryRate,
    expectedLossGivenDefault: round2(ead * lgd),
  };
}

// Scénarios de sévérité pour la LGD (diagnostic : waterfall par scénario).
export interface LgdScenario {
  key: string;
  label: string;
  extraSaleDiscount?: number; // décote additionnelle sur tous les actifs
  costOverrun?: number; // majoration du coût d'achèvement (0..1)
  extraMonths?: number; // allongement du délai de réalisation
}

export const LGD_SCENARIOS: LgdScenario[] = [
  { key: "base", label: "Base" },
  { key: "adverse", label: "Adverse", extraSaleDiscount: 0.1, costOverrun: 0.1, extraMonths: 6 },
  { key: "severe", label: "Sévère", extraSaleDiscount: 0.25, costOverrun: 0.2, extraMonths: 12 },
];

/** Applique un scénario de sévérité au waterfall (décote, surcoût, délai). */
export function computeLgdScenario(params: LgdParams, sc: LgdScenario): LgdResult {
  const assets = params.assets.map((a) => ({
    ...a,
    saleDiscount: clamp01(n(a.saleDiscount) + n(sc.extraSaleDiscount)),
    costToComplete: round2(n(a.costToComplete) * (1 + n(sc.costOverrun))),
    monthsToSale: n(a.monthsToSale) + n(sc.extraMonths),
  }));
  return computeLgd({ ...params, assets });
}
