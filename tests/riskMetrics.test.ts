import { describe, it, expect } from "vitest";
import {
  computeRiskMetrics,
  slottingCategory,
  ifrs9Stage,
  lgd,
  SLOTTING_PD,
  DEFAULT_CALIBRATION,
  type RiskCalibration,
} from "@/lib/domain/riskMetrics";

describe("riskMetrics — slotting Bâle", () => {
  it("catégorise selon le score", () => {
    expect(slottingCategory(80, "SAIN")).toBe("STRONG");
    expect(slottingCategory(65, "SAIN")).toBe("GOOD");
    expect(slottingCategory(50, "SENSIBLE")).toBe("SATISFACTORY");
    expect(slottingCategory(30, "SAIN")).toBe("WEAK");
    expect(slottingCategory(null, "SAIN")).toBe("WEAK");
  });

  it("toute classe en souffrance force la catégorie DEFAULT", () => {
    expect(slottingCategory(90, "DOUTEUX")).toBe("DEFAULT");
    expect(slottingCategory(90, "PRE_DOUTEUX")).toBe("DEFAULT");
    expect(slottingCategory(90, "CTX")).toBe("DEFAULT");
  });
});

describe("riskMetrics — staging IFRS 9", () => {
  it("mappe les classes BKAM vers les stages", () => {
    expect(ifrs9Stage("SAIN")).toBe(1);
    expect(ifrs9Stage("SENSIBLE")).toBe(2);
    expect(ifrs9Stage("DOUTEUX")).toBe(3);
    expect(ifrs9Stage("COMPROMIS")).toBe(3);
    expect(ifrs9Stage(null)).toBe(1);
  });
});

describe("riskMetrics — LGD", () => {
  it("LGD = LGD non garantie × (1 − couverture), avec plancher", () => {
    // Non garanti → 45%
    expect(lgd(100, 0)).toBe(0.45);
    // Couvert à 50% → 22,5%
    expect(lgd(100, 50)).toBe(0.225);
    // Couvert à 100% → plancher 5%
    expect(lgd(100, 100)).toBe(0.05);
    // Surcouverture → plancher
    expect(lgd(100, 200)).toBe(0.05);
    expect(lgd(0, 50)).toBe(0);
  });
});

describe("riskMetrics — Expected Loss", () => {
  it("EL = PD × LGD × EAD", () => {
    const m = computeRiskMetrics({ score: 80, cls: "SAIN", ead: 100_000_000, eligibleGuarantees: 0 });
    expect(m.slotting).toBe("STRONG");
    expect(m.stage).toBe(1);
    expect(m.pd).toBe(SLOTTING_PD.STRONG);
    expect(m.lgd).toBe(0.45);
    // 0.005 × 0.45 × 100M = 225 000
    expect(m.expectedLoss).toBe(225_000);
    expect(m.rwa).toBe(70_000_000); // RW 70%
  });

  it("dossier en défaut : PD=1 → EL = LGD × EAD", () => {
    const m = computeRiskMetrics({ score: 20, cls: "COMPROMIS", ead: 50_000_000, eligibleGuarantees: 10_000_000 });
    expect(m.slotting).toBe("DEFAULT");
    expect(m.pd).toBe(1);
    // couverture 20% → LGD 0.45×0.8 = 0.36 ; EL = 1×0.36×50M = 18M
    expect(m.lgd).toBe(0.36);
    expect(m.expectedLoss).toBe(18_000_000);
  });

  it("un calibrage personnalisé modifie PD et LGD", () => {
    const calib: RiskCalibration = {
      pd: { STRONG: 0.01, GOOD: 0.02, SATISFACTORY: 0.05, WEAK: 0.2, DEFAULT: 1 },
      lgdUnsecured: 0.6,
      lgdFloor: 0.1,
      maturityYears: 5,
    };
    const m = computeRiskMetrics({ score: 80, cls: "SAIN", ead: 100_000_000, eligibleGuarantees: 0 }, calib);
    expect(m.pd).toBe(0.01); // au lieu de 0.005 par défaut
    expect(m.lgd).toBe(0.6); // au lieu de 0.45
    expect(m.expectedLoss).toBe(600_000); // 0.01×0.6×100M
    // La catégorie DEFAULT reste à PD=1 même calibrée.
    const def = computeRiskMetrics({ score: 10, cls: "DOUTEUX", ead: 10_000_000, eligibleGuarantees: 0 }, calib);
    expect(def.pd).toBe(1);
    expect(def.lgd).toBe(0.6);
  });
});
