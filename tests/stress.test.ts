import { describe, it, expect } from "vitest";
import { applyStress, NO_SHOCK } from "@/lib/domain/stress";
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
});
