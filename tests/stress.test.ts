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

  it("prix −10 % : identités comptables exactes (F08) — marge et LTV recalculées", () => {
    const inputs: ProjectInputs = { gross_margin_pct: 25, stressed_margin_pct: 18, ltv_stressed: 70, pre_sale_rate: 60 };
    const out = applyStress(inputs, { ...NO_SHOCK, priceDrop: 10 });
    // marge 25 % avec CA=100/coût=75 → CA=90 → (90−75)/90 = 16,67 % (et non 15).
    expect(out.gross_margin_pct).toBe(16.67);
    expect(out.stressed_margin_pct).toBe(8.89);
    // LTV = dette/valeur ; valeur ×0,9 → 70/0,9 = 77,78 % (et non 80).
    expect(out.ltv_stressed).toBe(77.78);
    expect(out.pre_sale_rate).toBe(55);
  });

  it("coût +10 % : marge et LTC recalculés par identité (F08)", () => {
    const inputs: ProjectInputs = { gross_margin_pct: 25, ltc: 60, funding_gap_pct: 0 };
    const out = applyStress(inputs, { ...NO_SHOCK, costOverrun: 10 });
    // coût ×1,1 → 1 − 0,75×1,1 = 17,5 %.
    expect(out.gross_margin_pct).toBe(17.5);
    // LTC' = (60+10)/1,1 = 63,64 %.
    expect(out.ltc).toBe(63.64);
    expect(out.funding_gap_pct).toBe(10);
  });

  it("conserve les marges NÉGATIVES (pas de plancher masquant la perte — F08)", () => {
    const out = applyStress({ gross_margin_pct: 5 }, { ...NO_SHOCK, priceDrop: 15 });
    // marge 5 % avec CA=100/coût=95 → CA=85 → (85−95)/85 = −11,76 %.
    expect(out.gross_margin_pct).toBeLessThan(0);
    expect(out.gross_margin_pct).toBe(-11.76);
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
