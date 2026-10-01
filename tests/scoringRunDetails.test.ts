import { describe, it, expect } from "vitest";
import { runScoring } from "@/server/engines/scoringEngine";
import { CURRENT_PROMOTION_MODEL } from "@/lib/domain/models/current";
import { buildScoringRunDetails, readScoringRunDetails } from "@/lib/domain/scoringRunDetails";
import type { ProjectInputs } from "@/lib/domain/types";

const M = CURRENT_PROMOTION_MODEL;
const base: ProjectInputs = {
  promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire", mono_project_concentration: 35,
  promoter_type: "structure", equity_injected_ratio: 100, land_permits_status: "definitives", market_positioning: "aligne",
  technical_complexity: "standard", progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible",
  land_cost_ratio: 22, authorization_completeness_pct: 100, pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90,
  cash_coverage: 1.35, funding_gap_pct: 0, stock_rotation_months: 16, stressed_margin_pct: 18, secured_sales_rate: 55,
  gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
  release_quotity_gap_pts: 5, dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0,
  restructured: "no", legal_exposure: "clear",
};

describe("Détail conservé avec le run (ScoringRun.details)", () => {
  it("fige la version, la classe interne et les notes séparées", () => {
    const r = runScoring({ model: M, inputs: base, regulatoryClass: "SAIN", extraCriticalKeys: ["dpd_days"] });
    const d = buildScoringRunDetails(M, r);
    expect(d.modelVersion).toBe("v5.0.0");
    expect(d.internalClass).toBe(r.internalClass);
    expect(d.economicScore).toBe(r.economicScore);
    expect(d.guaranteeScore).toBe(r.guaranteeScore);
    expect(d.dataIncomplete).toBe(false);
    expect(readScoringRunDetails(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it("liste les données décisionnelles manquantes d'un dossier incomplet", () => {
    const { cash_coverage: _omit, ...rest } = base;
    const r = runScoring({ model: M, inputs: rest, regulatoryClass: "SAIN", extraCriticalKeys: ["dpd_days"] });
    const d = buildScoringRunDetails(M, r);
    expect(r.decision).toBe("DOSSIER_INCOMPLET");
    expect(d.missingCriticalInputs).toContain("cash_coverage");
  });

  it("repère les alertes déclenchées qui imposent un retour en comité", () => {
    const r = runScoring({ model: M, inputs: { ...base, construction_delay_months: 8, release_underpriced: true }, regulatoryClass: "SAIN", extraCriticalKeys: ["dpd_days"] });
    const d = buildScoringRunDetails(M, r);
    expect(d.committeeFlags.sort()).toEqual(["RF_MAINLEVEE_SOUS_TARIFEE", "RF_RETARD_6M"]);
  });

  it("tolère les runs antérieurs sans détail", () => {
    expect(readScoringRunDetails(null)).toBeNull();
    expect(readScoringRunDetails({ foo: 1 })).toBeNull();
  });
});
