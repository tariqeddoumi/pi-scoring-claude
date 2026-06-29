import { describe, it, expect } from "vitest";
import { deriveScoringInputs, type MonitoringSignals } from "@/lib/domain/scoringSignals";
import { computeBusinessPlanDeviation, type UnitView } from "@/lib/domain/commercialisation";

const base: MonitoringSignals = {
  preSaleRatePct: 60,
  salesVsPlanPct: 90,
  caDeltaPct: -2,
  unitsLate: 0,
  totalUnits: 10,
  observedProgressPct: 70,
  plannedProgressPct: 72,
};

describe("ventes vs planning à date (commercialisation)", () => {
  const u = (over: Partial<UnitView>): UnitView => ({
    reference: "x", trancheCode: "T1", type: "APPARTEMENT", status: "DISPONIBLE",
    plannedStanding: "HAUT", standing: "HAUT", plannedPrice: 1_000_000, listPrice: 1_000_000,
    soldPrice: null, plannedSaleDate: null, soldAt: null, mortgageReleased: false, releasedAmount: null, ...over,
  });
  it("rapporte ventes fermes / planifiées à date", () => {
    const bp = computeBusinessPlanDeviation([
      u({ reference: "a", status: "VENDU", soldPrice: 1_000_000, plannedSaleDate: "2026-01-01" }),
      u({ reference: "b", status: "DISPONIBLE", plannedSaleDate: "2026-02-01" }), // planifié, pas vendu
      u({ reference: "c", status: "DISPONIBLE", plannedSaleDate: "2026-12-01" }), // futur
    ], new Date("2026-06-28"));
    expect(bp.plannedUnitsToDate).toBe(2); // a + b
    expect(bp.firmUnits).toBe(1); // a
    expect(bp.salesVsPlanPct).toBe(50);
  });
  it("renvoie null si rien n'est planifié à date", () => {
    const bp = computeBusinessPlanDeviation([u({ plannedSaleDate: "2026-12-01" })], new Date("2026-06-28"));
    expect(bp.salesVsPlanPct).toBeNull();
  });
});

describe("pont suivi → inputs de scoring", () => {
  it("dérive prévente, ventes vs plan et avancement vs plan", () => {
    const d = deriveScoringInputs(base);
    expect(d.values.pre_sale_rate).toBe(60);
    expect(d.values.sales_vs_plan).toBe(90);
    expect(d.values.progress_vs_plan).toBeCloseTo((70 / 72) * 100, 1);
    expect(d.values.bp_significant_gap).toBe(false);
  });

  it("omet les clés non calculables sans écraser une saisie manuelle", () => {
    const d = deriveScoringInputs({ ...base, salesVsPlanPct: null, observedProgressPct: null });
    expect("sales_vs_plan" in d.values).toBe(false);
    expect("progress_vs_plan" in d.values).toBe(false);
    expect("pre_sale_rate" in d.values).toBe(true);
  });

  it("déclenche le décalage BP sur sous-performance de CA", () => {
    const d = deriveScoringInputs({ ...base, caDeltaPct: -15 });
    expect(d.values.bp_significant_gap).toBe(true);
  });

  it("déclenche le décalage BP sur retard d'avancement", () => {
    const d = deriveScoringInputs({ ...base, observedProgressPct: 50, plannedProgressPct: 70 });
    expect(d.values.bp_significant_gap).toBe(true); // 20 pts de retard ≥ seuil 10
  });

  it("déclenche le décalage BP sur part de lots en retard", () => {
    const d = deriveScoringInputs({ ...base, unitsLate: 3, totalUnits: 10 }); // 30% ≥ 20%
    expect(d.values.bp_significant_gap).toBe(true);
  });
});
