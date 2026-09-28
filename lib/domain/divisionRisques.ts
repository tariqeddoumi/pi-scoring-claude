// =====================================================================
//  divisionRisques.ts — Division des risques et grands risques.
//
//  Les banques marocaines sont tenues de limiter leur exposition sur une même
//  contrepartie ou un même groupe d'intérêt à une fraction de leurs fonds
//  propres (règle de division des risques). L'outil savait propager la classe
//  la plus sévère au sein d'un groupe, mais ne CONTRÔLAIT AUCUNE LIMITE de
//  concentration : un dossier pouvait être décidé sans voir le dépassement.
//
//  Ce module calcule, pour une contrepartie ou un groupe :
//   - l'exposition agrégée (encours + hors-bilan pondéré) ;
//   - le ratio d'exposition sur fonds propres ;
//   - le dépassement éventuel de la limite et la marge disponible ;
//   - la qualification de « grand risque » (seuil de déclaration).
//  Le taux de limite est PARAMÉTRABLE : les valeurs par défaut sont des
//  repères usuels et doivent être calées sur le référentiel réglementaire
//  daté de l'établissement.
//  Logique PURE, déterministe, testable — aucune dépendance base.
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

export interface ExposureLine {
  /** Libellé du concours / projet. */
  label: string;
  /** Encours tiré (MAD). */
  drawn: number;
  /** Autorisé non tiré (MAD). */
  undrawn?: number;
  /** Facteur de conversion du hors-bilan (0..1). */
  ccf?: number;
  /** Garanties admises en déduction (MAD), si la politique le prévoit. */
  eligibleGuarantees?: number;
}

export interface DivisionLimitPolicy {
  /** Fonds propres prudentiels de l'établissement (MAD). */
  ownFunds: number;
  /** Limite par contrepartie / groupe, en fraction des fonds propres. */
  limitPct?: number;
  /** Seuil de qualification « grand risque », en fraction des fonds propres. */
  largeExposurePct?: number;
  /** Déduire les garanties admises de l'exposition avant contrôle ? */
  netOfGuarantees?: boolean;
}

export interface DivisionRisquesResult {
  grossExposure: number;
  /** Exposition après déduction éventuelle des garanties admises. */
  netExposure: number;
  ownFunds: number;
  limitPct: number;
  limitAmount: number;
  /** Exposition rapportée aux fonds propres (fraction). */
  exposureRatio: number;
  /** Marge disponible avant atteinte de la limite (MAD, plancher 0). */
  headroom: number;
  /** Montant du dépassement (MAD, 0 si conforme). */
  excess: number;
  breach: boolean;
  isLargeExposure: boolean;
  lines: { label: string; exposure: number }[];
  warnings: string[];
}

/**
 * Contrôle de division des risques sur une contrepartie ou un groupe.
 * L'exposition additionne l'encours tiré et le non-tiré pondéré par le CCF
 * (un autorisé non tiré reste un engagement).
 */
export function computeDivisionRisques(
  lines: ExposureLine[],
  policy: DivisionLimitPolicy,
): DivisionRisquesResult {
  const limitPct = policy.limitPct ?? 0.2;
  const largePct = policy.largeExposurePct ?? 0.05;
  const ownFunds = Math.max(0, policy.ownFunds);

  const detailed = lines.map((l) => {
    const undrawn = Math.max(0, l.undrawn ?? 0);
    const ccf = l.ccf == null ? 1 : Math.min(1, Math.max(0, l.ccf));
    const exposure = Math.max(0, l.drawn) + undrawn * ccf;
    return { label: l.label, exposure: round2(exposure), guarantees: Math.max(0, l.eligibleGuarantees ?? 0) };
  });

  const grossExposure = round2(detailed.reduce((s, d) => s + d.exposure, 0));
  const totalGuarantees = round2(detailed.reduce((s, d) => s + d.guarantees, 0));
  const netExposure = policy.netOfGuarantees
    ? round2(Math.max(0, grossExposure - totalGuarantees))
    : grossExposure;

  const limitAmount = round2(ownFunds * limitPct);
  const exposureRatio = ownFunds > 0 ? round4(netExposure / ownFunds) : 0;
  const excess = round2(Math.max(0, netExposure - limitAmount));
  const headroom = round2(Math.max(0, limitAmount - netExposure));
  const breach = excess > 0;
  const isLargeExposure = ownFunds > 0 && netExposure >= ownFunds * largePct;

  const warnings: string[] = [];
  if (ownFunds <= 0) {
    warnings.push("Fonds propres non renseignés : le contrôle de division des risques n'est pas exploitable.");
  } else if (breach) {
    warnings.push(
      `Limite de division des risques dépassée de ${excess.toLocaleString("fr-MA")} MAD ` +
        `(${(exposureRatio * 100).toFixed(1)} % des fonds propres pour une limite de ${(limitPct * 100).toFixed(0)} %). ` +
        `Autorisation au niveau de délégation requis — sans modification de la note pour masquer le dépassement.`,
    );
  } else if (headroom < limitAmount * 0.1) {
    warnings.push("Marge résiduelle faible avant la limite de division des risques (< 10 %).");
  }
  if (isLargeExposure) {
    warnings.push(`Exposition qualifiée de « grand risque » (≥ ${(largePct * 100).toFixed(0)} % des fonds propres) — déclaration et suivi renforcé.`);
  }

  return {
    grossExposure,
    netExposure,
    ownFunds,
    limitPct,
    limitAmount,
    exposureRatio,
    headroom,
    excess,
    breach,
    isLargeExposure,
    lines: detailed.map((d) => ({ label: d.label, exposure: d.exposure })),
    warnings,
  };
}

/**
 * Un nouveau concours est-il admissible au regard de la limite ? Renvoie le
 * montant maximal octroyable sans dépasser la limite de division des risques.
 */
export function maxAdditionalExposure(
  current: DivisionRisquesResult,
  requested: number,
): { admissible: boolean; maxGrantable: number; shortfall: number } {
  const maxGrantable = round2(current.headroom);
  const admissible = requested <= maxGrantable;
  return {
    admissible,
    maxGrantable,
    shortfall: round2(Math.max(0, requested - maxGrantable)),
  };
}
