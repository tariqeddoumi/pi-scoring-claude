import { describe, it, expect } from "vitest";
import { analyzeReleases, recommendedReleaseQuotity } from "@/lib/domain/mainlevee";
import { computeDivisionRisques, maxAdditionalExposure } from "@/lib/domain/divisionRisques";

describe("Mainlevées partielles & prix de désengagement", () => {
  const units = [
    { reference: "A1", price: 1000, sold: true, released: true },
    { reference: "A2", price: 1000, sold: true, released: false },
    { reference: "A3", price: 1000, sold: false, released: false },
  ];

  it("calcule le prix de désengagement dû et le remboursement obtenu", () => {
    const r = analyzeReleases(units, { releaseQuotity: 0.7, outstandingDebt: 2000 });
    expect(r.units[0]!.dueReleasePrice).toBe(700);
    expect(r.repaidFromReleases).toBe(700);
    expect(r.expectedFromSoldNotReleased).toBe(700); // A2 vendu non mainlevé
    expect(r.residualDebt).toBe(1300);
    expect(r.residualDebtAfterSold).toBe(600);
  });

  it("détecte une quotité de désengagement sous-tarifée", () => {
    // Dette 2400 sur un CA total de 3000 → il faut 80 %, on applique 50 %.
    const r = analyzeReleases(units, { releaseQuotity: 0.5, outstandingDebt: 2400 });
    expect(r.breakEvenQuotity).toBeCloseTo(0.8, 4);
    expect(r.underPriced).toBe(true);
    expect(r.warnings.join(" ")).toContain("insuffisante");
  });

  it("alerte quand la dette résiduelle est adossée aux lots les moins liquides", () => {
    const r = analyzeReleases(
      [
        { reference: "L1", price: 1000, sold: true, released: true, liquidity: 0.9 },
        { reference: "L2", price: 1000, sold: false, released: false, liquidity: 0.3 },
      ],
      { releaseQuotity: 0.7, outstandingDebt: 1500 },
    );
    expect(r.residualOnIlliquidUnits).toBe(true);
    expect(r.warnings.join(" ")).toContain("moins liquides");
  });

  it("signale une mainlevée accordée sous le prix de désengagement dû", () => {
    const r = analyzeReleases(
      [{ reference: "X", price: 1000, sold: true, released: true, releasedAmount: 400 }],
      { releaseQuotity: 0.7, outstandingDebt: 1000 },
    );
    expect(r.units[0]!.shortfall).toBe(-300);
    expect(r.warnings.join(" ")).toContain("en deçà");
  });

  it("signale que le coût restant n'est plus couvert après mainlevées", () => {
    const r = analyzeReleases(units, {
      releaseQuotity: 0.7, outstandingDebt: 1000, remainingCostToFund: 5000,
    });
    expect(r.remainingCostCovered).toBe(false);
    expect(r.warnings.join(" ")).toContain("coût restant");
  });

  it("recommande une quotité d'équilibre majorée d'une marge de sécurité", () => {
    // dette 2400 / CA 3000 = 80 % ; +10 % de marge → 88 %.
    expect(recommendedReleaseQuotity(2400, 3000, 0.1)).toBeCloseTo(0.88, 4);
    expect(recommendedReleaseQuotity(3000, 3000, 0.1)).toBe(1); // borné à 100 %
  });
});

describe("Division des risques", () => {
  const lines = [
    { label: "Projet A", drawn: 60_000_000, undrawn: 40_000_000, ccf: 0.5 }, // 80 M
    { label: "Projet B", drawn: 20_000_000 },                                // 20 M
  ];

  it("agrège l'encours et le hors-bilan pondéré par le CCF", () => {
    const r = computeDivisionRisques(lines, { ownFunds: 1_000_000_000 });
    expect(r.grossExposure).toBe(100_000_000);
    expect(r.exposureRatio).toBeCloseTo(0.1, 4);
    expect(r.breach).toBe(false);
  });

  it("détecte un dépassement de la limite de division des risques", () => {
    const r = computeDivisionRisques(lines, { ownFunds: 300_000_000, limitPct: 0.2 });
    expect(r.limitAmount).toBe(60_000_000);
    expect(r.excess).toBe(40_000_000);
    expect(r.breach).toBe(true);
    expect(r.warnings.join(" ")).toContain("délégation");
  });

  it("qualifie un grand risque au-delà du seuil de déclaration", () => {
    const r = computeDivisionRisques(lines, { ownFunds: 1_000_000_000, largeExposurePct: 0.05 });
    expect(r.isLargeExposure).toBe(true); // 100 M ≥ 50 M
  });

  it("déduit les garanties admises quand la politique le prévoit", () => {
    const r = computeDivisionRisques(
      [{ label: "P", drawn: 100_000_000, eligibleGuarantees: 30_000_000 }],
      { ownFunds: 1_000_000_000, netOfGuarantees: true },
    );
    expect(r.netExposure).toBe(70_000_000);
  });

  it("calcule le montant maximal octroyable sans dépasser la limite", () => {
    const base = computeDivisionRisques(lines, { ownFunds: 600_000_000, limitPct: 0.2 });
    expect(base.headroom).toBe(20_000_000); // 120 M limite − 100 M exposé
    const ask = maxAdditionalExposure(base, 50_000_000);
    expect(ask.admissible).toBe(false);
    expect(ask.maxGrantable).toBe(20_000_000);
    expect(ask.shortfall).toBe(30_000_000);
  });

  it("signale l'absence de fonds propres renseignés", () => {
    const r = computeDivisionRisques(lines, { ownFunds: 0 });
    expect(r.warnings.join(" ")).toContain("Fonds propres non renseignés");
  });
});
