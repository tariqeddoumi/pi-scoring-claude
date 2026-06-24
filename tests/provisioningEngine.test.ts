import { describe, it, expect } from "vitest";
import { computeProvision } from "@/server/engines/provisioningEngine";
import { computeEligibleGuarantees } from "@/server/engines/guaranteeEligibilityEngine";
import {
  GUARANTEE_TYPES_1W,
  REGIME_1W_PROVISION_RATES,
  REGIME_19G_PROVISION_RATES,
} from "@/lib/domain/referenceData";

describe("provisioningEngine — taux BKAM", () => {
  it("base provisionnable nette des agios et garanties", () => {
    const r = computeProvision({
      ead: 1_000_000, reservedAgios: 50_000, eligibleGuarantees: 400_000,
      classCode: "DOUTEUX", rate: REGIME_1W_PROVISION_RATES.DOUTEUX!,
    });
    expect(r.provisionBase).toBe(550_000);
    expect(r.provisionAmount).toBe(275_000);
  });

  it("SENSIBLE provisionné à 10% sous 1/W (nouveauté)", () => {
    const r = computeProvision({ ead: 1_000_000, eligibleGuarantees: 0, classCode: "SENSIBLE", rate: REGIME_1W_PROVISION_RATES.SENSIBLE! });
    expect(r.rate).toBe(0.1);
    expect(r.provisionAmount).toBe(100_000);
  });

  it("19/G ne provisionne pas la classe SAIN (et n'a pas de sensible)", () => {
    expect(REGIME_19G_PROVISION_RATES.SENSIBLE).toBeUndefined();
    const r = computeProvision({ ead: 500_000, eligibleGuarantees: 0, classCode: "SAIN", rate: REGIME_19G_PROVISION_RATES.SAIN! });
    expect(r.provisionAmount).toBe(0);
  });

  it("COMPROMIS provisionné à 100% de la base", () => {
    const r = computeProvision({ ead: 500_000, eligibleGuarantees: 0, classCode: "COMPROMIS", rate: 1 });
    expect(r.provisionAmount).toBe(500_000);
  });

  it("base jamais négative en cas de sur-couverture", () => {
    const r = computeProvision({ ead: 100_000, eligibleGuarantees: 300_000, classCode: "DOUTEUX", rate: 0.5 });
    expect(r.provisionBase).toBe(0);
    expect(r.provisionAmount).toBe(0);
  });

  it("créance irrégulière : couverture 100% → provision nulle (art.4bis)", () => {
    const elig = computeEligibleGuarantees({ guarantees: [{ typeCode: "GARANTIE_ETAT", marketValue: 1_000_000 }], types: GUARANTEE_TYPES_1W });
    const r = computeProvision({ ead: 1_000_000, eligibleGuarantees: elig.totalEligible, classCode: "DOUTEUX", rate: 0.5, isIrregular: elig.fullyCoveredByTopTier });
    expect(r.provisionAmount).toBe(0);
    expect(r.isIrregular).toBe(true);
  });

  it("chaîne garanties → provisionnement (hyp 50%)", () => {
    const elig = computeEligibleGuarantees({
      guarantees: [{ typeCode: "HYP_RANG1", marketValue: 1_000_000, rank: 1 }],
      types: GUARANTEE_TYPES_1W,
    });
    expect(elig.totalEligible).toBe(500_000);
    const prov = computeProvision({ ead: 1_000_000, eligibleGuarantees: elig.totalEligible, classCode: "DOUTEUX", rate: 0.5 });
    expect(prov.provisionBase).toBe(500_000);
    expect(prov.provisionAmount).toBe(250_000);
  });
});
