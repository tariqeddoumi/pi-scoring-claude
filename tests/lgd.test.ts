import { describe, it, expect } from "vitest";
import { computeLgd, computeLgdScenario, LGD_SCENARIOS, type LgdParams } from "@/lib/domain/lgd";

describe("Waterfall de recouvrement / LGD (diagnostic F14)", () => {
  it("le coût d'achèvement et la décote absorbent la couverture apparente", () => {
    // Un actif de valeur 100 « paraît » couvrir une EAD de 80, mais après coût
    // d'achèvement 30, décote 20 %, frais 10 % et délai, le recouvrement chute.
    const p: LgdParams = {
      ead: 80,
      annualDiscountRate: 0.08,
      assets: [{ label: "Programme", grossValue: 100, costToComplete: 30, saleDiscount: 0.2, procedureCosts: 0.1, monthsToSale: 12, eligible: true, rank1: true }],
    };
    const r = computeLgd(p);
    // 100 − 30 = 70 ; ×0,8 = 56 ; frais −10 % = 50,4 ; /1,08 ≈ 46,67.
    expect(r.assets[0]!.afterCompletion).toBe(70);
    expect(r.assets[0]!.afterDiscount).toBe(56);
    expect(r.economicNetRecovery).toBeCloseTo(46.67, 1);
    expect(r.lgd).toBeGreaterThan(0.4); // perte réelle, malgré une « couverture » de 125 %
    expect(r.recoveryRate).toBeCloseTo(1 - r.lgd, 4);
  });

  it("sert les créanciers prioritaires d'abord puis applique la quotité de partage", () => {
    const p: LgdParams = {
      ead: 100,
      assets: [{ label: "Actif partagé", grossValue: 100, priorClaims: 40, bankShare: 0.5, monthsToSale: 0 }],
    };
    const r = computeLgd(p);
    // (100 − 40) × 0,5 = 30.
    expect(r.assets[0]!.afterPriorAndShare).toBe(30);
    expect(r.economicNetRecovery).toBe(30);
    expect(r.lgd).toBe(0.7);
  });

  it("distingue valeur économique, admissible prudentielle et opposable", () => {
    const p: LgdParams = {
      ead: 200,
      prudentialHaircut: 0.2,
      assets: [
        { label: "Hypothèque 1er rang", grossValue: 100, monthsToSale: 0, eligible: true, rank1: true },
        { label: "Nantissement éligible", grossValue: 50, monthsToSale: 0, eligible: true, rank1: false },
        { label: "Sûreté non éligible", grossValue: 40, monthsToSale: 0, eligible: false, rank1: false },
      ],
    };
    const r = computeLgd(p);
    expect(r.economicNetRecovery).toBe(190); // 100 + 50 + 40
    expect(r.prudentialAdmissibleValue).toBe(120); // (100 + 50) × 0,8
    expect(r.enforceableValue).toBe(100); // éligible ET 1er rang
  });

  it("la LGD est bornée [0 ; 1] et l'ELGD = EAD × LGD", () => {
    const covered = computeLgd({ ead: 100, assets: [{ label: "Sur-couvert", grossValue: 300, monthsToSale: 0 }] });
    expect(covered.lgd).toBe(0);
    expect(covered.expectedLossGivenDefault).toBe(0);
    const naked = computeLgd({ ead: 100, assets: [] });
    expect(naked.lgd).toBe(1);
    expect(naked.expectedLossGivenDefault).toBe(100);
  });

  it("les scénarios de sévérité aggravent la LGD (base ≤ adverse ≤ sévère)", () => {
    const p: LgdParams = {
      ead: 100,
      assets: [{ label: "Programme", grossValue: 130, costToComplete: 20, saleDiscount: 0.1, procedureCosts: 0.05, monthsToSale: 6 }],
    };
    const base = computeLgdScenario(p, LGD_SCENARIOS[0]!);
    const adverse = computeLgdScenario(p, LGD_SCENARIOS[1]!);
    const severe = computeLgdScenario(p, LGD_SCENARIOS[2]!);
    expect(adverse.lgd).toBeGreaterThanOrEqual(base.lgd);
    expect(severe.lgd).toBeGreaterThanOrEqual(adverse.lgd);
  });
});
