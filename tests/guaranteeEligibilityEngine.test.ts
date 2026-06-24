import { describe, it, expect } from "vitest";
import { computeEligibleGuarantees, applyAbatement } from "@/server/engines/guaranteeEligibilityEngine";
import { GUARANTEE_TYPES_1W } from "@/lib/domain/referenceData";

const T = GUARANTEE_TYPES_1W;

describe("guaranteeEligibilityEngine — quotités BKAM", () => {
  it("hypothèque 1er rang : quotité réglementaire 50%", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "HYP_RANG1", marketValue: 1_000_000, rank: 1 }], types: T });
    expect(r.lines[0]!.eligibleValue).toBe(500_000);
  });

  it("garantie État : quotité 100%, pas d'abattement", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "GARANTIE_ETAT", marketValue: 1_000_000, yearsInSouffrance: 20 }], types: T });
    expect(r.lines[0]!.eligibleValue).toBe(1_000_000);
    expect(r.lines[0]!.abatementApplied).toBe(false);
  });

  it("garantie bancaire 1er ordre : quotité 80%", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "GARANTIE_BANCAIRE", marketValue: 1_000_000 }], types: T });
    expect(r.lines[0]!.eligibleValue).toBe(800_000);
  });

  it("caution personnelle non admise en déduction", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "CAUTION_PERSO", marketValue: 1_000_000 }], types: T });
    expect(r.lines[0]!.eligible).toBe(false);
    expect(r.totalEligible).toBe(0);
  });

  it("hypothèque ≥ seuil sans évaluation récente est écartée (art.39)", () => {
    const r = computeEligibleGuarantees({
      guarantees: [{ typeCode: "HYP_RANG1", marketValue: 6_000_000, rank: 1, recentlyEvaluated: false }],
      types: T,
      hypEvaluationThreshold: 5_000_000,
    });
    expect(r.lines[0]!.eligible).toBe(false);
    expect(r.lines[0]!.note).toContain("évaluation récente");
  });

  it("hypothèque 1er rang exigée mais rang 2 → écartée", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "HYP_RANG1", marketValue: 1_000_000, rank: 2 }], types: T });
    expect(r.lines[0]!.eligible).toBe(false);
  });

  it("fullyCoveredByTopTier détecté pour les garanties 100%", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "DEPOT_GARANTIE", marketValue: 500_000 }], types: T });
    expect(r.fullyCoveredByTopTier).toBe(true);
  });
});

describe("abattement progressif (art.41/21)", () => {
  it("hypothécaire : 50% → 25% après 5 ans → 0% après 10 ans", () => {
    expect(applyAbatement(0.5, "HYPOTHECAIRE", 4).quotity).toBe(0.5);
    expect(applyAbatement(0.5, "HYPOTHECAIRE", 5).quotity).toBe(0.25);
    expect(applyAbatement(0.5, "HYPOTHECAIRE", 10).quotity).toBe(0);
  });
  it("titres : 80% → 25% après 2 ans → 0% après 5 ans", () => {
    expect(applyAbatement(0.8, "TITRES", 1).quotity).toBe(0.8);
    expect(applyAbatement(0.8, "TITRES", 2).quotity).toBe(0.25);
    expect(applyAbatement(0.8, "TITRES", 5).quotity).toBe(0);
  });
  it("quotité 100% n'est jamais abattue", () => {
    expect(applyAbatement(1, "NONE", 30).quotity).toBe(1);
  });
  it("une hypothèque de 1 MMAD en souffrance depuis 6 ans est abattue à 25%", () => {
    const r = computeEligibleGuarantees({ guarantees: [{ typeCode: "HYP_RANG1", marketValue: 1_000_000, rank: 1, yearsInSouffrance: 6 }], types: T });
    expect(r.lines[0]!.eligibleValue).toBe(250_000);
    expect(r.lines[0]!.abatementApplied).toBe(true);
  });
});
