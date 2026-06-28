import { describe, it, expect } from "vitest";
import {
  aggregateSales,
  aggregateRevenue,
  breakdownByTranche,
  breakdownByStanding,
  computeBusinessPlanDeviation,
  detectStandingChanges,
  trackMainlevees,
  summarizeCommercialisation,
  type UnitView,
} from "@/lib/domain/commercialisation";

// Fabrique de lot avec des valeurs par défaut raisonnables.
const u = (over: Partial<UnitView>): UnitView => ({
  reference: "A1",
  trancheCode: "T1",
  type: "APPARTEMENT",
  status: "DISPONIBLE",
  plannedStanding: "HAUT",
  standing: "HAUT",
  plannedPrice: 1_000_000,
  listPrice: 1_000_000,
  soldPrice: null,
  plannedSaleDate: null,
  soldAt: null,
  mortgageReleased: false,
  releasedAmount: null,
  ...over,
});

const asOf = new Date("2026-06-28");

describe("commercialisation — agrégats de ventes", () => {
  const units: UnitView[] = [
    u({ reference: "A1", status: "DISPONIBLE" }),
    u({ reference: "A2", status: "RESERVE" }),
    u({ reference: "A3", status: "COMPROMIS" }),
    u({ reference: "A4", status: "VENDU", soldPrice: 1_000_000 }),
    u({ reference: "A5", status: "LIVRE", soldPrice: 1_000_000 }),
    u({ reference: "A6", status: "DESISTE" }), // hors parc actif
  ];

  it("compte les statuts et exclut les désistements du parc actif", () => {
    const s = aggregateSales(units);
    expect(s.totalUnits).toBe(5); // 6 - 1 désistement
    expect(s.withdrawn).toBe(1);
    expect(s.committedUnits).toBe(4); // RESERVE+COMPROMIS+VENDU+LIVRE
    expect(s.firmUnits).toBe(2); // VENDU+LIVRE
  });

  it("calcule les taux de prévente et de vente ferme", () => {
    const s = aggregateSales(units);
    expect(s.preSaleRatePct).toBe(80); // 4/5
    expect(s.firmSaleRatePct).toBe(40); // 2/5
  });
});

describe("commercialisation — chiffre d'affaires", () => {
  it("ventile le CA réalisé, réservé et prévu", () => {
    const units: UnitView[] = [
      u({ status: "VENDU", soldPrice: 1_200_000, plannedPrice: 1_000_000 }),
      u({ status: "RESERVE", listPrice: 900_000, plannedPrice: 1_000_000 }),
      u({ status: "DISPONIBLE", plannedPrice: 1_000_000 }),
    ];
    const r = aggregateRevenue(units);
    expect(r.caRealise).toBe(1_200_000);
    expect(r.caReserve).toBe(900_000);
    expect(r.caPrevu).toBe(3_000_000);
    expect(r.caEngage).toBe(2_100_000);
    expect(r.tauxRealisationPct).toBe(40); // 1.2M / 3M
  });
});

describe("commercialisation — ventilations", () => {
  const units: UnitView[] = [
    u({ reference: "T1-A", trancheCode: "T1", status: "VENDU", soldPrice: 1_000_000 }),
    u({ reference: "T1-B", trancheCode: "T1", status: "DISPONIBLE" }),
    u({ reference: "T2-A", trancheCode: "T2", status: "VENDU", soldPrice: 1_000_000 }),
  ];

  it("ventile par tranche", () => {
    const bt = breakdownByTranche(units);
    expect(bt.map((b) => b.key)).toEqual(["T1", "T2"]);
    expect(bt.find((b) => b.key === "T1")!.firmSaleRatePct).toBe(50);
    expect(bt.find((b) => b.key === "T2")!.firmSaleRatePct).toBe(100);
  });

  it("ventile par standing avec libellés FR", () => {
    const bs = breakdownByStanding([u({ standing: "MOYEN" }), u({ standing: "MOYEN" })]);
    expect(bs[0]!.label).toBe("Moyen standing");
    expect(bs[0]!.totalUnits).toBe(2);
  });
});

describe("commercialisation — décalage business plan", () => {
  it("détecte les retards de calendrier (date de vente prévue dépassée)", () => {
    const units: UnitView[] = [
      u({ reference: "late", status: "DISPONIBLE", plannedSaleDate: "2026-01-01" }),
      u({ reference: "ontime", status: "VENDU", soldPrice: 1_000_000, plannedSaleDate: "2026-01-01" }),
      u({ reference: "future", status: "DISPONIBLE", plannedSaleDate: "2026-12-01" }),
    ];
    const bp = computeBusinessPlanDeviation(units, asOf);
    expect(bp.unitsLate).toBe(1);
    expect(bp.scheduleSlips[0]!.reference).toBe("late");
    expect(bp.scheduleSlips[0]!.daysLate).toBeGreaterThan(170);
  });

  it("détecte les écarts de prix vs business plan (décote)", () => {
    const units: UnitView[] = [
      u({ reference: "decote", status: "VENDU", plannedPrice: 1_000_000, soldPrice: 850_000 }),
    ];
    const bp = computeBusinessPlanDeviation(units, asOf);
    expect(bp.priceDeviations).toHaveLength(1);
    expect(bp.priceDeviations[0]!.deltaPct).toBe(-15);
    expect(bp.caDeltaAmount).toBe(-150_000); // 850k réalisé vs 1M prévu
    expect(bp.avgPriceDeviationPct).toBe(-15);
  });
});

describe("commercialisation — changement de standing", () => {
  it("détecte un déclassement (TRES_HAUT → MOYEN)", () => {
    const changes = detectStandingChanges([
      u({ reference: "down", plannedStanding: "TRES_HAUT", standing: "MOYEN" }),
      u({ reference: "stable", plannedStanding: "HAUT", standing: "HAUT" }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.direction).toBe("DOWNGRADE");
    expect(changes[0]!.rankDelta).toBe(3); // TRES_HAUT(0) → MOYEN(3)
    expect(changes[0]!.currentLabel).toBe("Moyen standing");
  });

  it("détecte une montée en gamme (UPGRADE)", () => {
    const changes = detectStandingChanges([
      u({ reference: "up", plannedStanding: "MOYEN", standing: "HAUT" }),
    ]);
    expect(changes[0]!.direction).toBe("UPGRADE");
    expect(changes[0]!.rankDelta).toBe(-2);
  });
});

describe("commercialisation — mainlevées", () => {
  it("distingue les lots vendus avec/sans mainlevée", () => {
    const units: UnitView[] = [
      u({ reference: "rel", status: "VENDU", soldPrice: 1_000_000, mortgageReleased: true, releasedAmount: 600_000 }),
      u({ reference: "pend", status: "LIVRE", soldPrice: 1_000_000, mortgageReleased: false, soldAt: "2026-03-01" }),
      u({ reference: "avail", status: "DISPONIBLE" }), // pas une vente → ignoré
    ];
    const m = trackMainlevees(units);
    expect(m.soldUnits).toBe(2);
    expect(m.releasedUnits).toBe(1);
    expect(m.pendingUnits).toBe(1);
    expect(m.releaseRatePct).toBe(50);
    expect(m.releasedAmount).toBe(600_000);
    expect(m.pendingReferences[0]!.reference).toBe("pend");
  });
});

describe("commercialisation — synthèse", () => {
  it("assemble tous les agrégats sans erreur sur un parc mixte", () => {
    const units: UnitView[] = [
      u({ reference: "A1", trancheCode: "T1", type: "APPARTEMENT", status: "VENDU", soldPrice: 1_000_000 }),
      u({ reference: "V1", trancheCode: "T2", type: "VILLA", status: "DISPONIBLE", plannedSaleDate: "2026-01-01" }),
      u({ reference: "C1", trancheCode: "T1", type: "COMMERCE", status: "DESISTE" }),
    ];
    const sum = summarizeCommercialisation(units, asOf);
    expect(sum.sales.totalUnits).toBe(2);
    expect(sum.businessPlan.unitsLate).toBe(1);
    expect(sum.byType.length).toBeGreaterThan(0);
    expect(sum.mainlevees.soldUnits).toBe(1);
  });
});
