// =====================================================================
//  pdBacktest.ts — Backtesting PUR du PD proxy (diagnostic §9.1).
//  Confronte la PD prédite par le modèle à la fréquence de défaut OBSERVÉE
//  sur le portefeuille, par tranche de score. Produit une courbe de calibration
//  (prédite vs observée), l'écart de calibration et un score de Brier.
//  Aucune IO : reçoit des observations déjà agrégées. Testable unitairement.
//  NB : indicatif — significatif uniquement sur un historique de défauts réel.
// =====================================================================

export interface PdObservation {
  scoreFinal: number; // 0..100
  predictedPd: number; // 0..1 (PD proxy du modèle)
  isDefault: boolean; // classe réglementaire en défaut (PRE_DOUTEUX+)
}

export interface PdBand {
  label: string;
  count: number;
  avgScore: number;
  avgPredictedPd: number; // moyenne des PD prédites de la tranche
  observedDefaultRate: number; // fréquence de défaut observée
}

export interface PdBacktestResult {
  bands: PdBand[];
  total: number;
  defaults: number;
  meanPredictedPd: number;
  observedDefaultRate: number;
  calibrationGap: number; // prédite − observée (>0 = modèle prudent)
  brier: number; // erreur quadratique moyenne (0 = parfait)
}

const BANDS: { label: string; min: number; max: number }[] = [
  { label: "< 50", min: -Infinity, max: 50 },
  { label: "50–64", min: 50, max: 65 },
  { label: "65–74", min: 65, max: 75 },
  { label: "75–84", min: 75, max: 85 },
  { label: "≥ 85", min: 85, max: Infinity },
];

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Construit la courbe de calibration + indicateurs à partir des observations. */
export function buildPdBacktest(obs: PdObservation[]): PdBacktestResult {
  const bands: PdBand[] = BANDS.map((b) => {
    const inBand = obs.filter((o) => o.scoreFinal >= b.min && o.scoreFinal < b.max);
    return {
      label: b.label,
      count: inBand.length,
      avgScore: Math.round(mean(inBand.map((o) => o.scoreFinal)) * 10) / 10,
      avgPredictedPd: r4(mean(inBand.map((o) => o.predictedPd))),
      observedDefaultRate: r4(mean(inBand.map((o) => (o.isDefault ? 1 : 0)))),
    };
  });

  const total = obs.length;
  const defaults = obs.filter((o) => o.isDefault).length;
  const meanPredictedPd = r4(mean(obs.map((o) => o.predictedPd)));
  const observedDefaultRate = r4(total ? defaults / total : 0);
  const brier = r4(mean(obs.map((o) => (o.predictedPd - (o.isDefault ? 1 : 0)) ** 2)));

  return {
    bands,
    total,
    defaults,
    meanPredictedPd,
    observedDefaultRate,
    calibrationGap: r4(meanPredictedPd - observedDefaultRate),
    brier,
  };
}
