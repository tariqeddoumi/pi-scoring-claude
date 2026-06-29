// =====================================================================
//  scoringSignals.ts — PONT suivi → inputs de scoring. Dérive, à partir des
//  données réelles de suivi (commercialisation + avancement chantier), les
//  valeurs d'entrée du modèle de scoring liées à l'avancement et au décalage
//  business plan. Logique PURE et testable ; les seuils sont paramétrables.
//
//  Objectif métier : pouvoir re-scorer un projet « à mesure de l'avancement »
//  sans ressaisir à la main ce que le suivi mesure déjà (prévente, ventes vs
//  plan, avancement vs plan, décalage significatif vs business plan).
// =====================================================================

const round1 = (v: number) => Math.round(v * 10) / 10;

export interface MonitoringSignals {
  /** Taux de prévente (engagés / parc actif), %. */
  preSaleRatePct: number;
  /** Ventes fermes vs planifiées à date (%), null si rien planifié encore. */
  salesVsPlanPct: number | null;
  /** Écart de CA réalisé vs prévu (%), négatif = sous le BP. */
  caDeltaPct: number;
  /** Nombre de lots en retard de commercialisation. */
  unitsLate: number;
  /** Parc actif total. */
  totalUnits: number;
  /** Avancement physique constaté sur site (%), null si inconnu. */
  observedProgressPct: number | null;
  /** Avancement officiel de référence (%), null si inconnu. */
  plannedProgressPct: number | null;
}

export interface SignalThresholds {
  /** Sous-performance de CA (en points de %) déclenchant le décalage BP. */
  caGapPct: number;
  /** Retard d'avancement (en points de %) déclenchant le décalage BP. */
  progressGapPts: number;
  /** Part de lots en retard (0..1) déclenchant le décalage BP. */
  lateShare: number;
}

export const DEFAULT_SIGNAL_THRESHOLDS: SignalThresholds = {
  caGapPct: 10,
  progressGapPts: 10,
  lateShare: 0.2,
};

export interface DerivedScoringInputs {
  /** Valeurs prêtes à upserter dans ProjectInput (clé du modèle → valeur). */
  values: Record<string, number | boolean>;
  /** Explication lisible par valeur dérivée (pour l'UI / l'audit). */
  notes: { key: string; label: string; value: string; reason: string }[];
}

/**
 * Calcule les inputs de scoring dérivés du suivi réel. Ne renvoie que les clés
 * effectivement calculables (les signaux inconnus sont omis, pour ne pas écraser
 * une saisie manuelle par une valeur vide).
 */
export function deriveScoringInputs(
  s: MonitoringSignals,
  thresholds: SignalThresholds = DEFAULT_SIGNAL_THRESHOLDS,
): DerivedScoringInputs {
  const values: Record<string, number | boolean> = {};
  const notes: DerivedScoringInputs["notes"] = [];

  // pre_sale_rate ← taux de prévente
  values.pre_sale_rate = round1(s.preSaleRatePct);
  notes.push({ key: "pre_sale_rate", label: "Préventes sécurisées", value: `${round1(s.preSaleRatePct)} %`, reason: "Taux d'engagement du parc (réservés + compromis + vendus)." });

  // sales_vs_plan ← ventes fermes vs planifiées à date (si calculable)
  if (s.salesVsPlanPct != null) {
    values.sales_vs_plan = round1(s.salesVsPlanPct);
    notes.push({ key: "sales_vs_plan", label: "Ventes vs planning", value: `${round1(s.salesVsPlanPct)} %`, reason: "Ventes fermes rapportées aux ventes prévues à ce jour." });
  }

  // progress_vs_plan ← avancement constaté / avancement planifié (si calculable)
  let progressGap: number | null = null;
  if (s.observedProgressPct != null && s.plannedProgressPct != null && s.plannedProgressPct > 0) {
    const ratio = round1((s.observedProgressPct / s.plannedProgressPct) * 100);
    values.progress_vs_plan = ratio;
    progressGap = round1(s.plannedProgressPct - s.observedProgressPct);
    notes.push({ key: "progress_vs_plan", label: "Avancement vs planning", value: `${ratio} %`, reason: `Avancement constaté ${s.observedProgressPct}% vs officiel ${s.plannedProgressPct}%.` });
  }

  // bp_significant_gap ← décalage significatif vs business plan (art. 5.3 1/W)
  const caHit = s.caDeltaPct <= -thresholds.caGapPct;
  const progressHit = progressGap != null && progressGap >= thresholds.progressGapPts;
  const lateHit = s.totalUnits > 0 && s.unitsLate / s.totalUnits >= thresholds.lateShare;
  const bpGap = caHit || progressHit || lateHit;
  values.bp_significant_gap = bpGap;
  if (bpGap) {
    const reasons: string[] = [];
    if (caHit) reasons.push(`CA ${round1(s.caDeltaPct)}% vs plan`);
    if (progressHit) reasons.push(`avancement -${progressGap} pts`);
    if (lateHit) reasons.push(`${s.unitsLate}/${s.totalUnits} lots en retard`);
    notes.push({ key: "bp_significant_gap", label: "Décalage business plan significatif", value: "Oui", reason: reasons.join(" · ") });
  } else {
    notes.push({ key: "bp_significant_gap", label: "Décalage business plan significatif", value: "Non", reason: "Sous les seuils de matérialité." });
  }

  return { values, notes };
}
