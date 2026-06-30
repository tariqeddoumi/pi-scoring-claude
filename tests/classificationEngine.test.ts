import { describe, it, expect } from "vitest";
import { classify, restructuringFloor } from "@/server/engines/regulatoryClassificationEngine";
import { REGIME_19G_2002, REGIME_1W_2025 } from "@/lib/domain/referenceData";

describe("classification — 19/G/2002", () => {
  it("classes a current loan as SAIN", () => {
    expect(classify({ regime: REGIME_19G_2002, inputs: { dpd_days: 0 } }).resultClass).toBe("SAIN");
  });
  it("90j → PRE_DOUTEUX, 200j → DOUTEUX, 400j → COMPROMIS", () => {
    expect(classify({ regime: REGIME_19G_2002, inputs: { dpd_days: 120 } }).resultClass).toBe("PRE_DOUTEUX");
    expect(classify({ regime: REGIME_19G_2002, inputs: { dpd_days: 200 } }).resultClass).toBe("DOUTEUX");
    expect(classify({ regime: REGIME_19G_2002, inputs: { dpd_days: 400 } }).resultClass).toBe("COMPROMIS");
  });
  it("litigation forces CTX (blocking)", () => {
    const r = classify({ regime: REGIME_19G_2002, inputs: { dpd_days: 0, legal_exposure: "litigation" } });
    expect(r.resultClass).toBe("CTX");
    expect(r.blocksGo).toBe(true);
  });
  it("19/G has no SENSIBLE class: a watch-only project stays SAIN", () => {
    const r = classify({ regime: REGIME_19G_2002, inputs: { dpd_days: 0, commercialization_below_50_1y: true } });
    expect(r.resultClass).toBe("SAIN");
  });
});

describe("classification — 1/W/2025 (sensible + triggers immobiliers)", () => {
  it("commercialisation < 50% un an après travaux → SENSIBLE (art.5.3)", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, commercialization_below_50_1y: true } });
    expect(r.resultClass).toBe("SENSIBLE");
    expect(r.isWatchList).toBe(true);
  });
  it("retard chantier > 1 an → SENSIBLE", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { construction_delay_over_1y: true } }).resultClass).toBe("SENSIBLE");
  });
  it("projet à l'arrêt > 1 an → COMPROMIS (art.12.7)", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { project_stopped_over_1y: true } }).resultClass).toBe("COMPROMIS");
  });
  it("projet finalisé 2 ans sans ventes → COMPROMIS (art.12.6)", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { finished_2y_no_sales: true } }).resultClass).toBe("COMPROMIS");
  });
  it("debt/equity > 3 → SENSIBLE (art.5.5)", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { debt_equity_ratio: 4 } }).resultClass).toBe("SENSIBLE");
  });
  it("retains the most severe class among multiple triggers", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 200, commercialization_below_50_1y: true } });
    expect(r.resultClass).toBe("DOUTEUX");
    expect(r.triggeredBy.length).toBeGreaterThan(1);
  });
});

describe("classification — 1/W/2025 (complétude art.10-12, §6.2)", () => {
  it("crédit in fine impayé > 90 / 180 / 360j après terme → PRE_DOUTEUX / DOUTEUX / COMPROMIS", () => {
    const inFine = (days: number) => classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, credit_type: "in_fine", days_after_maturity: days } }).resultClass;
    expect(inFine(100)).toBe("PRE_DOUTEUX");
    expect(inFine(200)).toBe("DOUTEUX");
    expect(inFine(400)).toBe("COMPROMIS");
  });
  it("crédit amortissable non concerné par le déclencheur in fine", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, credit_type: "amortissable", days_after_maturity: 400 } }).resultClass).toBe("SAIN");
  });
  it("dépassement de ligne > 10% non régularisé > 180j → DOUTEUX (art.11)", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, overdraft_excess_pct: 15, overdraft_excess_days: 200 } });
    expect(r.resultClass).toBe("DOUTEUX");
  });
  it("compte débiteur sans mouvements créditeurs > 360j → COMPROMIS (art.12)", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, debit_no_credit_movements_days: 400 } }).resultClass).toBe("COMPROMIS");
  });
  it("information d'avancement/commercialisation non fiable → SENSIBLE (art.5.3)", () => {
    expect(classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, unreliable_commercialization_info: true } }).resultClass).toBe("SENSIBLE");
  });
  it("qualité des données : dpd_days manquant → INCOMPLETE_BLOCKING", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { legal_exposure: "clear", financials_unavailable: false } });
    expect(r.dataQuality.status).toBe("INCOMPLETE_BLOCKING");
    expect(r.dataQuality.missingCriticalData).toContain("dpd_days");
  });
  it("qualité des données : toutes les clés critiques/importantes présentes → COMPLETE", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0, legal_exposure: "clear", financials_unavailable: false } });
    expect(r.dataQuality.status).toBe("COMPLETE");
    expect(r.dataQuality.missingCriticalData).toHaveLength(0);
  });
});

describe("restructuration (1/W art.17-31)", () => {
  it("1ère restructuration avec différé ≥ 12 mois → SENSIBLE (art.22)", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: {}, restructuring: { restructured: true, count: 1, deferralMonths: 12 } });
    expect(r.resultClass).toBe("SENSIBLE");
    expect(r.restructuringNote).toContain("différé");
  });
  it("2nde restructuration en période d'observation → DOUTEUX (art.25)", () => {
    const f = restructuringFloor({ restructured: true, count: 2, secondDuringObservation: true }, "BKAM_1W");
    expect(f?.floor).toBe("DOUTEUX");
  });
  it("impayé > 90j sur créance restructurée → DOUTEUX (art.29)", () => {
    const f = restructuringFloor({ restructured: true, dpdOnRestructured: 100 }, "BKAM_1W");
    expect(f?.floor).toBe("DOUTEUX");
  });
  it("restructuration non viable → DOUTEUX (art.18)", () => {
    const f = restructuringFloor({ restructured: true, viable: false }, "BKAM_1W");
    expect(f?.floor).toBe("DOUTEUX");
  });
});

describe("effet groupe (art.33/50)", () => {
  it("a clean project is contaminated by a worse group peer", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 0 }, groupPeerClass: "DOUTEUX" });
    expect(r.resultClass).toBe("DOUTEUX");
    expect(r.groupContagionClass).toBe("DOUTEUX");
  });
  it("a less severe peer does not improve the project class", () => {
    const r = classify({ regime: REGIME_1W_2025, inputs: { dpd_days: 200 }, groupPeerClass: "SENSIBLE" });
    expect(r.resultClass).toBe("DOUTEUX");
    expect(r.groupContagionClass).toBeUndefined();
  });
});
