// =====================================================================
//  mainlevee.ts — Mainlevées partielles et prix de désengagement.
//
//  Pratique marocaine du crédit promoteur : la banque consent une mainlevée
//  hypothécaire LOT PAR LOT contre versement d'un PRIX DE DÉSENGAGEMENT
//  (quotité du prix de vente affectée au remboursement). Le diagnostic alerte :
//  « un prix de mainlevée trop faible peut laisser à la banque une dette
//  résiduelle adossée aux lots les moins liquides ».
//
//  Ce module calcule :
//   - le prix de désengagement dû par lot et le remboursement cumulé ;
//   - la dette résiduelle après écoulement des lots déjà vendus ;
//   - la couverture résiduelle par les lots ENCORE GREVÉS (non mainlevés) ;
//   - l'alerte de sous-tarification : la quotité ne suffit pas à éteindre la
//     dette avant l'écoulement des derniers lots.
//  Logique PURE, déterministe, testable — aucune dépendance base.
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface ReleaseUnitView {
  reference: string;
  /** Prix de vente (réalisé si vendu, sinon prix prévisionnel). */
  price: number;
  /** Lot vendu (acte/compromis) ? */
  sold: boolean;
  /** Mainlevée hypothécaire déjà obtenue sur ce lot ? */
  released: boolean;
  /** Montant effectivement affecté au remboursement pour ce lot, si connu. */
  releasedAmount?: number | null;
  /** Indice de liquidité du lot (0..1) : 1 = très liquide. Optionnel. */
  liquidity?: number | null;
}

export interface ReleasePolicy {
  /**
   * Quotité de désengagement : part du prix de vente affectée au remboursement
   * de la dette pour obtenir la mainlevée (ex. 0,7 = 70 %).
   */
  releaseQuotity: number;
  /** Dette à éteindre (encours de crédit promoteur adossé aux lots). */
  outstandingDebt: number;
  /** Coût restant à financer qui doit rester couvert malgré les mainlevées. */
  remainingCostToFund?: number;
}

export interface UnitRelease {
  reference: string;
  price: number;
  sold: boolean;
  released: boolean;
  /** Prix de désengagement théorique = prix × quotité. */
  dueReleasePrice: number;
  /** Montant réellement affecté (si renseigné), sinon le théorique. */
  effectiveReleaseAmount: number;
  /** Écart entre le versé et le dû (négatif = sous-tarification). */
  shortfall: number;
}

export interface ReleaseAnalysis {
  units: UnitRelease[];
  /** Remboursement cumulé obtenu des lots déjà mainlevés. */
  repaidFromReleases: number;
  /** Remboursement attendu des lots vendus non encore mainlevés. */
  expectedFromSoldNotReleased: number;
  /** Dette résiduelle après prise en compte des mainlevées effectuées. */
  residualDebt: number;
  /** Dette résiduelle après encaissement des ventes déjà conclues. */
  residualDebtAfterSold: number;
  /** Valeur des lots encore grevés (non mainlevés). */
  encumberedValue: number;
  /** Prix de désengagement mobilisable sur les lots encore grevés. */
  releasableFromEncumbered: number;
  /** Couverture de la dette résiduelle par les lots encore grevés. */
  residualCoverageRatio: number;
  /** La quotité est-elle insuffisante pour éteindre la dette ? */
  underPriced: boolean;
  /** Quotité minimale qui aurait éteint la dette sur l'ensemble du programme. */
  breakEvenQuotity: number;
  /** Les lots restants sont-ils les moins liquides ? (alerte du diagnostic) */
  residualOnIlliquidUnits: boolean;
  /** Le financement du coût restant est-il préservé après mainlevées ? */
  remainingCostCovered: boolean | null;
  warnings: string[];
}

/**
 * Analyse des mainlevées partielles et du prix de désengagement.
 * `breakEvenQuotity` répond à la question de crédit : « quelle quotité faut-il
 * imposer pour que la dette soit éteinte avant les derniers lots ? »
 */
export function analyzeReleases(units: ReleaseUnitView[], policy: ReleasePolicy): ReleaseAnalysis {
  const q = clamp01(policy.releaseQuotity);
  const debt = Math.max(0, policy.outstandingDebt);

  const detailed: UnitRelease[] = units.map((u) => {
    const due = round2(u.price * q);
    const effective = u.releasedAmount != null ? u.releasedAmount : u.released ? due : 0;
    return {
      reference: u.reference,
      price: round2(u.price),
      sold: u.sold,
      released: u.released,
      dueReleasePrice: due,
      effectiveReleaseAmount: round2(effective),
      shortfall: round2(effective - due),
    };
  });

  const repaidFromReleases = round2(
    detailed.filter((d) => d.released).reduce((s, d) => s + d.effectiveReleaseAmount, 0),
  );
  const expectedFromSoldNotReleased = round2(
    detailed.filter((d) => d.sold && !d.released).reduce((s, d) => s + d.dueReleasePrice, 0),
  );

  const residualDebt = round2(Math.max(0, debt - repaidFromReleases));
  const residualDebtAfterSold = round2(
    Math.max(0, debt - repaidFromReleases - expectedFromSoldNotReleased),
  );

  const encumbered = detailed.filter((d) => !d.released);
  const encumberedValue = round2(encumbered.reduce((s, d) => s + d.price, 0));
  const releasableFromEncumbered = round2(encumbered.reduce((s, d) => s + d.dueReleasePrice, 0));
  const residualCoverageRatio =
    residualDebt > 0 ? round2(releasableFromEncumbered / residualDebt) : Infinity;

  // Quotité d'équilibre : part du CA total nécessaire pour éteindre la dette.
  const totalValue = round2(detailed.reduce((s, d) => s + d.price, 0));
  const breakEvenQuotity = totalValue > 0 ? Math.round((debt / totalValue) * 10000) / 10000 : 0;
  const underPriced = q < breakEvenQuotity;

  // Les lots restants sont-ils moins liquides que ceux déjà écoulés ?
  const withLiquidity = units.filter((u) => typeof u.liquidity === "number");
  let residualOnIlliquidUnits = false;
  if (withLiquidity.length > 0) {
    const releasedLiq = withLiquidity.filter((u) => u.released).map((u) => u.liquidity as number);
    const remainingLiq = withLiquidity.filter((u) => !u.released).map((u) => u.liquidity as number);
    if (releasedLiq.length > 0 && remainingLiq.length > 0) {
      const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
      residualOnIlliquidUnits = avg(remainingLiq) < avg(releasedLiq) - 0.1;
    }
  }

  const remainingCostCovered =
    policy.remainingCostToFund == null
      ? null
      : releasableFromEncumbered >= policy.remainingCostToFund;

  const warnings: string[] = [];
  if (underPriced) {
    warnings.push(
      `Quotité de désengagement insuffisante : ${(q * 100).toFixed(0)} % appliqué contre ` +
        `${(breakEvenQuotity * 100).toFixed(0)} % nécessaires pour éteindre la dette sur l'ensemble du programme.`,
    );
  }
  if (residualDebt > 0 && residualCoverageRatio < 1) {
    warnings.push(
      "Les lots encore grevés ne permettent pas d'éteindre la dette résiduelle au prix de mainlevée en vigueur.",
    );
  }
  if (residualOnIlliquidUnits) {
    warnings.push(
      "La dette résiduelle est adossée aux lots les moins liquides : risque de blocage en fin de programme.",
    );
  }
  if (remainingCostCovered === false) {
    warnings.push(
      "Après mainlevées, les lots restants ne couvrent plus le coût restant à financer.",
    );
  }
  const underPaid = detailed.filter((d) => d.released && d.shortfall < -0.01);
  if (underPaid.length > 0) {
    warnings.push(
      `${underPaid.length} mainlevée(s) accordée(s) en deçà du prix de désengagement dû.`,
    );
  }

  return {
    units: detailed,
    repaidFromReleases,
    expectedFromSoldNotReleased,
    residualDebt,
    residualDebtAfterSold,
    encumberedValue,
    releasableFromEncumbered,
    residualCoverageRatio,
    underPriced,
    breakEvenQuotity,
    residualOnIlliquidUnits,
    remainingCostCovered,
    warnings,
  };
}

/**
 * Quotité de désengagement recommandée : quotité d'équilibre majorée d'une
 * marge de sécurité, bornée à 100 %. Sert de garde-fou au comité lors de la
 * fixation du prix de mainlevée.
 */
export function recommendedReleaseQuotity(
  outstandingDebt: number,
  totalSaleableValue: number,
  safetyMargin = 0.1,
): number {
  if (totalSaleableValue <= 0) return 1;
  const breakEven = outstandingDebt / totalSaleableValue;
  return Math.round(clamp01(breakEven * (1 + safetyMargin)) * 10000) / 10000;
}
