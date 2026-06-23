// =====================================================================
//  guaranteeEligibilityEngine.ts
//  Garanties admises en déduction de l'assiette de provisionnement
//  (19/G art.15-22 ; 1/W art.35-41) :
//    valeur admise = valeur réalisable × quotité_effective × (1 − haircut)
//  La quotité effective intègre l'abattement progressif (art.41/21) selon
//  l'ancienneté en souffrance et le profil de la garantie :
//    - HYPOTHECAIRE : base → 25% après 5 ans → 0% après 10 ans
//    - TITRES       : base → 25% après 2 ans → 0% après 5 ans
//    - VEHICULES    : base → 25% après 2 ans → 0% après 3 ans
//  Les garanties de quotité 100% ne subissent pas d'abattement.
// =====================================================================

import type {
  AbatementProfile,
  GuaranteeEligibilityLine,
  GuaranteeEligibilityResult,
  GuaranteeInput,
  GuaranteeTypeConfig,
} from "@/lib/domain/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Quotité après abattement progressif (art.41/21). */
export function applyAbatement(
  baseQuotity: number,
  profile: AbatementProfile,
  years: number,
): { quotity: number; abated: boolean } {
  // Les quotités 100% (deposits, État…) ne sont pas abattues.
  if (profile === "NONE" || baseQuotity >= 1) return { quotity: baseQuotity, abated: false };

  const table: Record<Exclude<AbatementProfile, "NONE">, { to25: number; to0: number }> = {
    HYPOTHECAIRE: { to25: 5, to0: 10 },
    TITRES: { to25: 2, to0: 5 },
    VEHICULES: { to25: 2, to0: 3 },
  };
  const t = table[profile];
  if (years >= t.to0) return { quotity: 0, abated: true };
  if (years >= t.to25) return { quotity: Math.min(baseQuotity, 0.25), abated: true };
  return { quotity: baseQuotity, abated: false };
}

export interface GuaranteeEligibilityParams {
  guarantees: GuaranteeInput[];
  types: GuaranteeTypeConfig[];
  // Seuil au-delà duquel une hypothèque exige une évaluation récente (art.19/39).
  hypEvaluationThreshold?: number;
}

export function computeEligibleGuarantees(
  params: GuaranteeEligibilityParams,
): GuaranteeEligibilityResult {
  const typeByCode = new Map(params.types.map((t) => [t.code, t]));
  const threshold = params.hypEvaluationThreshold ?? Infinity;
  const lines: GuaranteeEligibilityLine[] = [];

  for (const g of params.guarantees) {
    const cfg = typeByCode.get(g.typeCode);
    if (!cfg || !cfg.eligible) {
      lines.push({
        typeCode: g.typeCode,
        marketValue: g.marketValue,
        eligible: false,
        baseQuotity: cfg?.quotity ?? 0,
        effectiveQuotity: 0,
        haircut: cfg?.haircut ?? 0,
        abatementApplied: false,
        eligibleValue: 0,
        note: cfg ? "Garantie non éligible" : "Type de garantie inconnu",
      });
      continue;
    }

    // Hypothèque ≥ seuil sans évaluation récente → écartée (art.19/39).
    if (
      cfg.abatementProfile === "HYPOTHECAIRE" &&
      g.marketValue >= threshold &&
      g.recentlyEvaluated === false
    ) {
      lines.push({
        typeCode: g.typeCode,
        marketValue: g.marketValue,
        eligible: false,
        baseQuotity: cfg.quotity,
        effectiveQuotity: 0,
        haircut: cfg.haircut,
        abatementApplied: false,
        eligibleValue: 0,
        note: `Hypothèque ≥ seuil sans évaluation récente (art.19/39)`,
      });
      continue;
    }

    // Hypothèque de 1er rang exigée mais non respectée → écartée (art.19/39).
    if (cfg.requiresRank1 && (g.rank ?? 1) > 1) {
      lines.push({
        typeCode: g.typeCode,
        marketValue: g.marketValue,
        eligible: false,
        baseQuotity: cfg.quotity,
        effectiveQuotity: 0,
        haircut: cfg.haircut,
        abatementApplied: false,
        eligibleValue: 0,
        note: `Hypothèque non 1er rang (art.19/39)`,
      });
      continue;
    }

    const { quotity, abated } = applyAbatement(
      clamp01(cfg.quotity),
      cfg.abatementProfile,
      g.yearsInSouffrance ?? 0,
    );
    const haircut = clamp01(cfg.haircut);
    const eligibleValue = round2(Math.max(0, g.marketValue) * quotity * (1 - haircut));

    lines.push({
      typeCode: g.typeCode,
      marketValue: g.marketValue,
      eligible: true,
      baseQuotity: clamp01(cfg.quotity),
      effectiveQuotity: quotity,
      haircut,
      abatementApplied: abated,
      eligibleValue,
      note: abated ? "Abattement progressif appliqué (art.41/21)" : undefined,
    });
  }

  const totalEligible = round2(lines.reduce((s, l) => s + l.eligibleValue, 0));
  // Couverture intégrale par garanties 100% → éligible au statut "irrégulière".
  const topTier = lines
    .filter((l) => l.eligible && l.baseQuotity >= 1)
    .reduce((s, l) => s + l.eligibleValue, 0);

  return { lines, totalEligible, fullyCoveredByTopTier: topTier > 0 };
}
