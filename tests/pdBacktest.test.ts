import { describe, it, expect } from "vitest";
import { buildPdBacktest, type PdObservation } from "@/lib/domain/pdBacktest";

const obs: PdObservation[] = [
  { scoreFinal: 90, predictedPd: 0.01, isDefault: false },
  { scoreFinal: 80, predictedPd: 0.03, isDefault: false },
  { scoreFinal: 70, predictedPd: 0.06, isDefault: false },
  { scoreFinal: 55, predictedPd: 0.12, isDefault: true },
  { scoreFinal: 30, predictedPd: 0.35, isDefault: true },
];

describe("backtesting du PD proxy", () => {
  it("répartit les observations par tranche de score", () => {
    const r = buildPdBacktest(obs);
    const byLabel = Object.fromEntries(r.bands.map((b) => [b.label, b.count]));
    expect(byLabel["≥ 85"]).toBe(1);
    expect(byLabel["< 50"]).toBe(1);
    expect(byLabel["50–64"]).toBe(1);
    expect(r.total).toBe(5);
    expect(r.defaults).toBe(2);
  });

  it("calcule taux observé, PD moyenne prédite, écart de calibration et Brier", () => {
    const r = buildPdBacktest(obs);
    expect(r.observedDefaultRate).toBe(0.4); // 2/5
    expect(r.meanPredictedPd).toBeCloseTo((0.01 + 0.03 + 0.06 + 0.12 + 0.35) / 5, 4);
    expect(r.calibrationGap).toBeCloseTo(r.meanPredictedPd - r.observedDefaultRate, 4);
    expect(r.brier).toBeGreaterThan(0);
    expect(r.brier).toBeLessThan(1);
  });

  it("les tranches hautes ont un défaut observé plus faible que les basses", () => {
    const r = buildPdBacktest(obs);
    const high = r.bands.find((b) => b.label === "≥ 85")!;
    const low = r.bands.find((b) => b.label === "< 50")!;
    expect(high.observedDefaultRate).toBeLessThan(low.observedDefaultRate);
  });

  it("gère un portefeuille vide sans erreur", () => {
    const r = buildPdBacktest([]);
    expect(r.total).toBe(0);
    expect(r.observedDefaultRate).toBe(0);
    expect(r.brier).toBe(0);
  });
});
