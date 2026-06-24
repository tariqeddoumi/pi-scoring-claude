import { describe, it, expect } from "vitest";
import { runScoring, pdProxy } from "@/server/engines/scoringEngine";
import { PROMOTION_SCORING_MODEL } from "@/lib/domain/referenceData";
import type { ProjectInputs } from "@/lib/domain/types";

const strong: ProjectInputs = {
  promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire",
  mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
  land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard",
  progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible", land_cost_ratio: 22,
  pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0,
  stock_rotation_months: 16, stressed_margin_pct: 18,
  gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
  dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
};

const weak: ProjectInputs = {
  promoter_completed_projects: 1, promoter_gearing: 160, governance_quality: "partielle",
  mono_project_concentration: 70, promoter_type: "opportuniste", equity_injected_ratio: 70,
  land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne",
  progress_vs_plan: 75, sav_litigation: "moyen", macro_sensitivity: "elevee", land_cost_ratio: 32,
  pre_sale_rate: 18, sales_vs_plan: 70, dso_days: 260, cash_coverage: 0.85, funding_gap_pct: 15,
  stock_rotation_months: 32, stressed_margin_pct: 9,
  gross_margin_pct: 13, ltc: 84, ltv_stressed: 88, guarantee_coverage: 60, first_rank: "non", interest_coverage: 1.2,
  dpd_days: 110, construction_delay_months: 8, project_stopped_months: 0, restructured: "yes", legal_exposure: "watch",
  funding_gap_persistent: true,
};

const M = PROMOTION_SCORING_MODEL;

describe("scoringEngine V1.0", () => {
  it("scores a strong project as GO (Sain) with a high economic score", () => {
    const r = runScoring({ model: M, inputs: strong });
    expect(r.scoreEco).toBeGreaterThan(85);
    expect(r.totalMalus).toBe(0);
    expect(r.decision).toBe("GO");
    expect(r.internalClass).toBe("Sain");
  });

  it("produces 4 scored domain outcomes D1..D4 capped 0..100 (D5 = couche red-flags)", () => {
    const r = runScoring({ model: M, inputs: strong });
    expect(r.domains.map((d) => d.domainCode)).toEqual(["D1", "D2", "D3", "D4"]);
    r.domains.forEach((d) => {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    });
  });

  it("applies segment/zone adjustment (S_adj = S_eco × (1+α+β))", () => {
    const base = runScoring({ model: M, inputs: strong });
    const adj = runScoring({ model: M, inputs: strong, segment: "touristique", zone: "marrakech" });
    expect(adj.alphaSeg).toBe(-0.07);
    expect(adj.betaZone).toBe(-0.07);
    expect(adj.scoreAdjusted).toBeLessThan(base.scoreEco);
  });

  it("blocks GO via the equity gate when apport effectif < 80%", () => {
    const r = runScoring({ model: M, inputs: { ...strong, equity_injected_ratio: 50 } });
    expect(r.gateBlocked).toBe(true);
    expect(r.decision).toBe("NO_GO");
  });

  it("triggers souffrance automatically on impayé ≥ 90j (hors score)", () => {
    const r = runScoring({ model: M, inputs: { ...strong, dpd_days: 120 } });
    expect(r.souffranceTriggered).toBe(true);
    expect(r.decision).toBe("NO_GO");
    expect(r.internalClass).toBe("Souffrance");
  });

  it("CTX class forces NO_GO and score 0 (règle bloquante)", () => {
    const r = runScoring({ model: M, inputs: strong, regulatoryClass: "CTX", classBlocksGo: true });
    expect(r.scoreFinal).toBe(0);
    expect(r.decision).toBe("NO_GO");
  });

  it("subtracts D5 malus from the adjusted score", () => {
    const r = runScoring({ model: M, inputs: weak });
    expect(r.totalMalus).toBeGreaterThan(0);
    expect(r.scoreAfterPenalties).toBeLessThan(r.scoreAdjusted);
  });

  it("applies CoeffBAM to degrade the final score for a degraded class", () => {
    const clean = runScoring({ model: M, inputs: strong });
    const douteux = runScoring({ model: M, inputs: strong, regulatoryClass: "DOUTEUX" });
    expect(douteux.coeffBAM).toBe(0.4);
    expect(douteux.scoreFinal).toBeLessThan(clean.scoreFinal);
  });

  it("computes a monotonic PD proxy (higher score → lower PD)", () => {
    expect(pdProxy(85)).toBeLessThan(pdProxy(45));
  });

  it("is deterministic for identical inputs", () => {
    expect(runScoring({ model: M, inputs: strong }).scoreFinal).toBe(
      runScoring({ model: M, inputs: strong }).scoreFinal,
    );
  });
});
