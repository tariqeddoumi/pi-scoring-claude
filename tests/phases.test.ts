import { describe, it, expect } from "vitest";
import { derivePhase, phaseWeightsFor, PHASE_WEIGHT_PROFILES } from "@/lib/domain/phases";
import { runScoring } from "@/server/engines/scoringEngine";
import { PROMOTION_SCORING_MODEL } from "@/lib/domain/referenceData";
import type { ProjectInputs } from "@/lib/domain/types";

describe("Grilles par phase (diagnostic F11)", () => {
  it("dérive la phase depuis l'état/avancement", () => {
    expect(derivePhase({ progressPct: 0 })).toBe("PRE_DEVELOPMENT");
    expect(derivePhase({ progressPct: 45 })).toBe("CONSTRUCTION");
    expect(derivePhase({ commercialisationLaunched: true })).toBe("CONSTRUCTION");
    expect(derivePhase({ progressPct: 100 })).toBe("ECOULEMENT");
    expect(derivePhase({ delivered: true })).toBe("ECOULEMENT");
    expect(derivePhase({ status: "En travaux" })).toBe("CONSTRUCTION");
    expect(derivePhase({ status: "Achevé" })).toBe("ECOULEMENT");
  });

  it("chaque profil de phase somme à 1", () => {
    for (const phase of Object.keys(PHASE_WEIGHT_PROFILES) as (keyof typeof PHASE_WEIGHT_PROFILES)[]) {
      const total = Object.values(PHASE_WEIGHT_PROFILES[phase]).reduce((s, w) => s + w, 0);
      expect(total).toBeCloseTo(1, 5);
    }
  });

  it("phaseWeightsFor renormalise sur les domaines présents", () => {
    const w = phaseWeightsFor("ECOULEMENT", ["D1", "D2", "D3", "D4"]);
    expect(Object.values(w).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 4);
    expect(w.D4).toBeGreaterThan(w.D2!); // écoulement privilégie liquidité/structure
  });

  it("le moteur applique des poids de domaines de substitution sans changer les notes de domaine", () => {
    const inputs: ProjectInputs = {
      promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire",
      mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
      land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard",
      progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible", land_cost_ratio: 22,
      pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0,
      stock_rotation_months: 16, stressed_margin_pct: 18,
      gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
      dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
    };
    const official = runScoring({ model: PROMOTION_SCORING_MODEL, inputs });
    const phased = runScoring({ model: PROMOTION_SCORING_MODEL, inputs, domainWeights: phaseWeightsFor("ECOULEMENT", ["D1", "D2", "D3", "D4"]) });
    // Les notes de domaine sont identiques ; seule la pondération change.
    expect(phased.domains.map((d) => d.score)).toEqual(official.domains.map((d) => d.score));
    // Les poids appliqués reflètent la phase.
    const d4 = phased.domains.find((d) => d.domainCode === "D4")!;
    expect(d4.weight).toBeCloseTo(0.4, 4);
  });
});
