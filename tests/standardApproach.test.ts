import { describe, it, expect } from "vitest";
import { computeStandardApproach, adcCriteriaMet, BAM_SOLVENCY_RATIO } from "@/lib/domain/standardApproach";

describe("standardApproach — méthode standard BAM (promotion immobilière)", () => {
  it("promotion (ADC) cas général : pondération 150 %", () => {
    const r = computeStandardApproach({ assetType: "PROMOTION", isDefault: false, ead: 100, specificProvisions: 0 });
    expect(r.category).toBe("ADC");
    expect(r.riskWeight).toBe(1.5);
    expect(r.rwa).toBe(150);
    expect(r.capitalRequirement).toBe(18); // 12 % × 150
  });

  it("ADC avec critères prudentiels remplis : 100 %", () => {
    const r = computeStandardApproach({ assetType: "PROMOTION", isDefault: false, ead: 100, specificProvisions: 0, adcCriteriaMet: true });
    expect(r.category).toBe("ADC_MITIGATED");
    expect(r.riskWeight).toBe(1.0);
  });

  it("immobilier de rapport (exploitation) : 100 %", () => {
    const r = computeStandardApproach({ assetType: "EXPLOITATION", isDefault: false, ead: 200, specificProvisions: 0 });
    expect(r.category).toBe("INCOME_PRODUCING");
    expect(r.rwa).toBe(200);
  });

  it("défaut peu provisionné (< 20 %) : 150 % sur l'EAD nette", () => {
    const r = computeStandardApproach({ assetType: "PROMOTION", isDefault: true, ead: 100, specificProvisions: 10 });
    expect(r.category).toBe("DEFAULTED_LOW_PROVISION");
    expect(r.eadNet).toBe(90);
    expect(r.rwa).toBe(135);
  });

  it("défaut provisionné (≥ 20 %) : 100 % sur l'EAD nette", () => {
    const r = computeStandardApproach({ assetType: "PROMOTION", isDefault: true, ead: 100, specificProvisions: 50 });
    expect(r.category).toBe("DEFAULTED_PROVISIONED");
    expect(r.eadNet).toBe(50);
    expect(r.rwa).toBe(50);
  });

  it("les provisions sont bornées à l'EAD (jamais d'assiette négative)", () => {
    const r = computeStandardApproach({ assetType: "PROMOTION", isDefault: true, ead: 100, specificProvisions: 150 });
    expect(r.eadNet).toBe(0);
    expect(r.rwa).toBe(0);
  });

  it("le ratio de solvabilité BAM est de 12 %", () => {
    expect(BAM_SOLVENCY_RATIO).toBe(0.12);
  });

  it("critères ADC : pré-ventes ≥ 50 % ET fonds propres ≥ 20 %", () => {
    expect(adcCriteriaMet({ preSaleRatePct: 60, equitySharePct: 25 })).toBe(true);
    expect(adcCriteriaMet({ preSaleRatePct: 40, equitySharePct: 25 })).toBe(false);
    expect(adcCriteriaMet({ preSaleRatePct: 60, equitySharePct: 10 })).toBe(false);
    expect(adcCriteriaMet({ preSaleRatePct: null, equitySharePct: null })).toBe(false);
  });
});
