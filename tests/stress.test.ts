import { describe, it, expect } from "vitest";
import { applyStress, NO_SHOCK, STRESS_SCENARIOS } from "@/lib/domain/stress";
import type { ProjectInputs } from "@/lib/domain/types";

const base: ProjectInputs = { pre_sale_rate: 60, dpd_days: 0, sales_vs_plan: 100, gross_margin_pct: 25 };

describe("stress — application du choc", () => {
  it("baisse les préventes et augmente le DPD sans muter l'original", () => {
    const out = applyStress(base, { preSaleDrop: 20, dpdAdd: 120 });
    expect(out.pre_sale_rate).toBe(40);
    expect(out.dpd_days).toBe(120);
    expect(out.sales_vs_plan).toBe(80);
    expect(base.pre_sale_rate).toBe(60); // original intact
  });

  it("borne à zéro et part de dpd 0 si absent", () => {
    const out = applyStress({ pre_sale_rate: 10 }, { preSaleDrop: 30, dpdAdd: 90 });
    expect(out.pre_sale_rate).toBe(0);
    expect(out.dpd_days).toBe(90);
  });

  it("NO_SHOCK laisse les entrées inchangées", () => {
    const out = applyStress(base, NO_SHOCK);
    expect(out.pre_sale_rate).toBe(60);
    expect(out.dpd_days).toBe(0);
    expect(out.sales_vs_plan).toBe(100);
  });

  it("prix −10 % réduit les marges et augmente la LTV stressée", () => {
    const inputs: ProjectInputs = { gross_margin_pct: 25, stressed_margin_pct: 18, ltv_stressed: 70, pre_sale_rate: 60 };
    const out = applyStress(inputs, { ...NO_SHOCK, priceDrop: 10 });
    expect(out.gross_margin_pct).toBe(15);
    expect(out.stressed_margin_pct).toBe(8);
    expect(out.ltv_stressed).toBe(80);
    expect(out.pre_sale_rate).toBe(55);
  });

  it("retard +12 mois déclenche le marqueur > 1 an et dégrade l'avancement", () => {
    const out = applyStress({ construction_delay_months: 2, progress_vs_plan: 100 }, { ...NO_SHOCK, delayMonths: 12 });
    expect(out.construction_delay_months).toBe(14);
    expect(out.construction_delay_over_1y).toBe(true);
    expect(out.progress_vs_plan).toBe(64);
  });

  it("la batterie expose les scénarios standard attendus", () => {
    const keys = STRESS_SCENARIOS.map((s) => s.key);
    expect(keys).toContain("price15");
    expect(keys).toContain("rate200");
    expect(keys).toContain("severe");
  });
});
