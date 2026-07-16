import { describe, it, expect } from "vitest";
import { computeEcl, lifetimePd, DEFAULT_MATURITY_YEARS } from "@/lib/domain/ifrs9";

describe("ifrs9 — PD lifetime", () => {
  it("1 − (1 − PD)^maturité, croissante avec l'horizon", () => {
    // 1 - (1-0.04)^3 = 0.1153
    expect(lifetimePd(0.04, 3)).toBeCloseTo(0.1153, 4);
    expect(lifetimePd(0.04, 3)).toBeGreaterThan(0.04);
    expect(lifetimePd(0, 5)).toBe(0);
    expect(lifetimePd(1, 5)).toBe(1);
  });
});

describe("ifrs9 — ECL par stage", () => {
  it("Stage 1 : ECL à 12 mois (PD 12m)", () => {
    const r = computeEcl({ stage: 1, pd12m: 0.015, lgd: 0.45, ead: 100_000_000 });
    expect(r.horizon).toBe("12M");
    expect(r.pdUsed).toBe(0.015);
    expect(r.ecl).toBe(675_000); // 0.015 × 0.45 × 100M
  });

  it("Stage 2 : ECL à maturité (PD lifetime > PD 12m)", () => {
    const r = computeEcl({ stage: 2, pd12m: 0.04, lgd: 0.4, ead: 50_000_000, maturityYears: 3 });
    expect(r.horizon).toBe("LIFETIME");
    expect(r.pdUsed).toBeGreaterThan(0.04);
    // 0.1153 × 0.4 × 50M ≈ 2 306 000
    expect(r.ecl).toBeCloseTo(2_306_000, -3);
  });

  it("Stage 3 : créance dépréciée → PD=1, ECL = LGD × EAD", () => {
    const r = computeEcl({ stage: 3, pd12m: 0.5, lgd: 0.36, ead: 50_000_000 });
    expect(r.pdUsed).toBe(1);
    expect(r.ecl).toBe(18_000_000);
  });

  it("maturité par défaut appliquée en Stage 2", () => {
    const r = computeEcl({ stage: 2, pd12m: 0.04, lgd: 0.45, ead: 10_000_000 });
    expect(r.pdUsed).toBe(lifetimePd(0.04, DEFAULT_MATURITY_YEARS));
  });
});

describe("ifrs9 — SICR (augmentation significative du risque)", () => {
  it("classe en défaut → Stage 3 quel que soit le reste", async () => {
    const { assessSicr } = await import("@/lib/domain/ifrs9");
    expect(assessSicr({ cls: "DOUTEUX" }).stage).toBe(3);
  });

  it("classe sensible → Stage 2 (base watch list)", async () => {
    const { assessSicr } = await import("@/lib/domain/ifrs9");
    const r = assessSicr({ cls: "SENSIBLE" });
    expect(r.stage).toBe(2);
    expect(r.sicrTriggered).toBe(false);
  });

  it("arriérés > 30 j dégradent une créance SAINE en Stage 2 (présomption réfutable)", async () => {
    const { assessSicr } = await import("@/lib/domain/ifrs9");
    const r = assessSicr({ cls: "SAIN", dpdDays: 45 });
    expect(r.stage).toBe(2);
    expect(r.sicrTriggered).toBe(true);
  });

  it("dégradation du score ≥ 20 % vs octroi → Stage 2", async () => {
    const { assessSicr } = await import("@/lib/domain/ifrs9");
    const r = assessSicr({ cls: "SAIN", currentScore: 55, initialScore: 75 });
    expect(r.stage).toBe(2);
    expect(r.sicrTriggered).toBe(true);
  });

  it("restructuration (forbearance) → Stage 2 même si la classe est saine", async () => {
    const { assessSicr } = await import("@/lib/domain/ifrs9");
    expect(assessSicr({ cls: "SAIN", restructured: true }).stage).toBe(2);
  });

  it("créance saine sans signal SICR reste en Stage 1", async () => {
    const { assessSicr } = await import("@/lib/domain/ifrs9");
    const r = assessSicr({ cls: "SAIN", dpdDays: 10, currentScore: 72, initialScore: 75 });
    expect(r.stage).toBe(1);
    expect(r.sicrTriggered).toBe(false);
  });
});
