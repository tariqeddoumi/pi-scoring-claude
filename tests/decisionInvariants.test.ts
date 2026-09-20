import { describe, it, expect } from "vitest";
import { runScoring } from "@/server/engines/scoringEngine";
import { PROMOTION_SCORING_MODEL } from "@/lib/domain/referenceData";
import { criticalInputKeys, worstCaseScore } from "@/lib/domain/decisionInvariants";
import type { ProjectInputs } from "@/lib/domain/types";

const M = PROMOTION_SCORING_MODEL;

const base: ProjectInputs = {
  promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire",
  mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
  land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard",
  progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible", land_cost_ratio: 22,
  pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 0.99, funding_gap_pct: 0,
  stock_rotation_months: 16, stressed_margin_pct: 18,
  gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
  dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
};

describe("Invariants de décision (diagnostic F01/F02/F03/F09)", () => {
  it("F01 : supprimer une donnée défavorable n'améliore JAMAIS la décision", () => {
    // cash_coverage 0,99 déclenche l'alerte RF_CASH_LT_ECH (−25) et une note faible.
    const present = runScoring({ model: M, inputs: base });
    // En retirant cash_coverage, l'ancienne implémentation regagnait ~24 points
    // (l'alerte disparaissait). Désormais : dossier incomplet, pas d'amélioration.
    const removed = runScoring({ model: M, inputs: { ...base, cash_coverage: null } });
    expect(removed.dataIncomplete).toBe(true);
    expect(removed.missingCriticalInputs).toContain("cash_coverage");
    expect(removed.decision).toBe("DOSSIER_INCOMPLET");
    // Le score final ne peut pas être supérieur après omission.
    expect(removed.scoreFinal).toBeLessThanOrEqual(present.scoreFinal);
  });

  it("F02 : qualité des données bloquante verrouille la décision officielle", () => {
    const r = runScoring({ model: M, inputs: base, dataQualityBlocking: true });
    expect(r.decision).toBe("DOSSIER_INCOMPLET");
    expect(r.internalClass).toBe("Dossier incomplet");
  });

  it("F02 : dpd_days manquant (clé critique) → dossier incomplet", () => {
    const r = runScoring({ model: M, inputs: { ...base, dpd_days: null }, extraCriticalKeys: ["dpd_days"] });
    expect(r.missingCriticalInputs).toContain("dpd_days");
    expect(r.decision).toBe("DOSSIER_INCOMPLET");
  });

  it("F03 : une classe en défaut avéré force NO_GO et « Défaut avéré »", () => {
    const r = runScoring({ model: M, inputs: base, regulatoryClass: "PRE_DOUTEUX", isDefault: true });
    expect(r.defaultAsserted).toBe(true);
    expect(r.decision).toBe("NO_GO");
    expect(r.internalClass).toBe("Défaut avéré");
    expect(r.pdIndicative).toBe(true);
  });

  it("F09 : note économique et note de sûretés sont distinctes", () => {
    const r = runScoring({ model: M, inputs: base });
    expect(r.economicScore).toBeGreaterThanOrEqual(0);
    expect(r.economicScore).toBeLessThanOrEqual(100);
    // Sans métadonnée `family` en v2, la note de sûretés est nulle (non séparée).
    expect(r.guaranteeScore).toBeNull();
  });

  it("F13 : signale un segment/zone inconnu et neutralise les ajustements en challenger", () => {
    const inputs: ProjectInputs = { ...base, cash_coverage: 1.35 };
    // Segment/zone connus : ajustements appliqués.
    const known = runScoring({ model: M, inputs, segment: "touristique", zone: "marrakech" });
    expect(known.unknownSegment).toBe(false);
    expect(known.unknownZone).toBe(false);
    expect(known.alphaSeg).toBeLessThan(0);
    // Neutralisation (challenger) : coefficients à zéro.
    const neutral = runScoring({ model: M, inputs, segment: "touristique", zone: "marrakech", neutralizeAdjustments: true });
    expect(neutral.alphaSeg).toBe(0);
    expect(neutral.betaZone).toBe(0);
    expect(neutral.scoreTechnique).toBeGreaterThanOrEqual(known.scoreTechnique);
    // Segment/zone inconnus : signalés (plus de neutralité tacite).
    const unknown = runScoring({ model: M, inputs, segment: "zone_libre_xyz", zone: "atlantide" });
    expect(unknown.unknownSegment).toBe(true);
    expect(unknown.unknownZone).toBe(true);
  });

  it("worstCaseScore = note plancher du barème (jamais 0 neutre)", () => {
    const cash = M.domains.flatMap((d) => d.criteria).find((c) => c.inputKey === "cash_coverage")!;
    expect(worstCaseScore(cash)).toBe(1);
  });

  it("criticalInputKeys inclut les clés numériques des alertes et les gates", () => {
    const keys = criticalInputKeys(M, ["dpd_days"]);
    expect(keys).toContain("cash_coverage"); // alerte numérique
    expect(keys).toContain("equity_injected_ratio"); // gate
    expect(keys).toContain("land_permits_status"); // gate
    expect(keys).toContain("dpd_days");
    // Une clé booléenne d'alerte n'est PAS critique (absence = non affirmé).
    expect(keys).not.toContain("funding_gap_persistent");
  });
});
