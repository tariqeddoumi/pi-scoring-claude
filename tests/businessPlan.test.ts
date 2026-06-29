import { describe, it, expect } from "vitest";
import { computeBusinessPlanDrift, type UnitBaselineView } from "@/lib/domain/businessPlan";

const u = (over: Partial<UnitBaselineView>): UnitBaselineView => ({
  reference: "A1", trancheCode: "T1",
  originalStanding: null, originalPrice: null, originalSaleDate: null,
  plannedStanding: "HAUT", plannedPrice: 1_000_000, plannedSaleDate: "2026-06-01",
  ...over,
});

describe("dérive du business plan vs origine", () => {
  it("sans baseline d'origine, aucune dérive", () => {
    const d = computeBusinessPlanDrift([u({}), u({ reference: "A2" })]);
    expect(d.hasOriginalBaseline).toBe(false);
    expect(d.items).toHaveLength(0);
    expect(d.targetCaDeltaAmount).toBe(0);
  });

  it("détecte un déclassement du plan (TRES_HAUT → MOYEN)", () => {
    const d = computeBusinessPlanDrift([
      u({ originalStanding: "TRES_HAUT", plannedStanding: "MOYEN" }),
    ]);
    expect(d.restandinged).toBe(1);
    expect(d.downgraded).toBe(1);
    const it0 = d.items.find((i) => i.field === "standing")!;
    expect(it0.direction).toBe("DOWNGRADE");
    expect(it0.rankDelta).toBe(3);
  });

  it("mesure la révision du prix cible et l'impact CA", () => {
    const d = computeBusinessPlanDrift([
      u({ originalPrice: 1_000_000, plannedPrice: 800_000 }),
      u({ reference: "A2", originalPrice: null, plannedPrice: 500_000 }), // non révisé
    ]);
    expect(d.priceRevised).toBe(1);
    expect(d.targetCaOriginal).toBe(1_500_000); // 1.0M (orig) + 0.5M (inchangé)
    expect(d.targetCaCurrent).toBe(1_300_000); // 0.8M + 0.5M
    expect(d.targetCaDeltaAmount).toBe(-200_000);
    const it0 = d.items.find((i) => i.field === "price")!;
    expect(it0.deltaPct).toBe(-20);
  });

  it("détecte un report de calendrier", () => {
    const d = computeBusinessPlanDrift([
      u({ originalSaleDate: "2026-01-01", plannedSaleDate: "2026-04-01" }),
    ]);
    expect(d.scheduleShifted).toBe(1);
    const it0 = d.items.find((i) => i.field === "saleDate")!;
    expect(it0.daysShift).toBeGreaterThan(80);
  });
});
