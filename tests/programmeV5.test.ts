import { describe, it, expect } from "vitest";
import {
  normalizeRegion, parseRegionalMarket, regionalTensionFor, financedPerimeter, inPerimeter, perimeterProgress,
  programmeComposition, cancellationRatePct, assessEquipments, assessDrawdown, certifiedProgress, drawdownScheduleLate,
} from "@/lib/domain/programmeV5";

const NOW = new Date("2026-10-01T00:00:00Z");

describe("Régionalité", () => {
  it("normalise une région saisie en libellé, en code ou sans accents", () => {
    expect(normalizeRegion("Marrakech-Safi")).toBe("marrakech_safi");
    expect(normalizeRegion("marrakech_safi")).toBe("marrakech_safi");
    expect(normalizeRegion("Tanger-Tétouan-Al Hoceïma")).toBe("tanger_tetouan_al_hoceima");
    expect(normalizeRegion("Fes-Meknes")).toBe("fes_meknes");
    expect(normalizeRegion("Atlantide")).toBeNull();
    expect(normalizeRegion(null)).toBeNull();
  });

  it("donne la tension du segment, sinon la valeur par défaut, et signale une appréciation périmée", () => {
    const defs = [parseRegionalMarket("Casablanca-Settat", { segments: { moyen_haut: "surstock", social: "porteur" }, default: "equilibre", assessedAt: "2025-06" })!];
    expect(regionalTensionFor("casablanca_settat", "moyen_haut", defs, NOW)).toMatchObject({ tension: "surstock", stale: true });
    expect(regionalTensionFor("Casablanca-Settat", "villas", defs, NOW).tension).toBe("equilibre");
  });

  it("n'invente rien : région absente du référentiel ou non reconnue → donnée absente", () => {
    expect(regionalTensionFor("souss_massa", "social", [], NOW).tension).toBeUndefined();
    expect(regionalTensionFor("inconnue", "social", [], NOW).region).toBeNull();
  });
});

describe("Périmètre financé (tranche / lot)", () => {
  const tr = [{ id: "T1", financed: true, progressPct: 60, budget: 100 }, { id: "T2", financed: false, progressPct: 0, budget: 300 }];
  it("aucune indication = programme entier (rétro-compatible)", () => {
    const p = financedPerimeter(tr.map((t) => ({ ...t, financed: false })), []);
    expect(p.wholeProgramme).toBe(true);
    expect(inPerimeter(p, "T2")).toBe(true);
  });
  it("tranche marquée financée ou portée par une facilité", () => {
    const p = financedPerimeter(tr, []);
    expect(p.wholeProgramme).toBe(false);
    expect(inPerimeter(p, "T1")).toBe(true);
    expect(inPerimeter(p, "T2")).toBe(false);
    expect(perimeterProgress(tr, p)).toBe(60);
    expect(financedPerimeter(tr.map((t) => ({ ...t, financed: false })), ["T2"]).trancheIds).toEqual(new Set(["T2"]));
  });
});

describe("Programme mixte et désistements", () => {
  it("calcule la part du CA en produits à écoulement lent", () => {
    const c = programmeComposition([
      { type: "APPARTEMENT", status: "VENDU", price: 600 }, { type: "VILLA", status: "DISPONIBLE", price: 200 },
      { type: "COMMERCE", status: "DISPONIBLE", price: 100 }, { type: "HOTEL", status: "DISPONIBLE", price: 100 },
    ]);
    expect(c.slowLiquiditySharePct).toBe(20);
    expect(c.mixed).toBe(true);
    expect(programmeComposition([]).slowLiquiditySharePct).toBeUndefined();
  });
  it("taux de désistement sur les engagements", () => {
    expect(cancellationRatePct([{ status: "VENDU" }, { status: "RESERVE" }, { status: "DESISTE" }, { status: "DISPONIBLE" }])).toBeCloseTo(33.33, 2);
    expect(cancellationRatePct([{ status: "DISPONIBLE" }])).toBeUndefined();
  });
});

describe("Équipements exigés", () => {
  const base = { label: "Mosquée", kind: "mosquee", estimatedCost: 3_000_000, budgeted: false, fundedBy: "promoteur", progressPct: 10, dueDate: "2026-06-30", conditionsDelivery: true, handedOver: false };
  it("non déclaré → absent ; « aucun » déclaré → 0", () => {
    expect(assessEquipments([], { declared: null, programmeCost: 100e6, programmeProgressPct: 50 }).unbudgetedPct).toBeUndefined();
    expect(assessEquipments([], { declared: false, programmeCost: 100e6, programmeProgressPct: 50 })).toMatchObject({ unbudgetedPct: 0, deliveryAtRisk: false });
  });
  it("coût non budgété rapporté au coût du programme ; équipement de la commune exclu", () => {
    const r = assessEquipments([base, { ...base, label: "École", fundedBy: "commune", estimatedCost: 5e6 }], { declared: true, programmeCost: 100e6, programmeProgressPct: 50, now: NOW });
    expect(r.unbudgetedPct).toBe(3);
  });
  it("retard d'un équipement conditionnant la réception (échéance passée ou décalage > 30 pts)", () => {
    expect(assessEquipments([base], { declared: true, programmeCost: 100e6, programmeProgressPct: 20, now: NOW }).deliveryAtRisk).toBe(true);
    const ok = { ...base, dueDate: "2027-12-31", progressPct: 40 };
    expect(assessEquipments([ok], { declared: true, programmeCost: 100e6, programmeProgressPct: 60, now: NOW }).deliveryAtRisk).toBe(false);
    expect(assessEquipments([ok], { declared: true, programmeCost: 100e6, programmeProgressPct: 80, now: NOW }).deliveryAtRisk).toBe(true);
  });
});

describe("Déblocages selon le calendrier", () => {
  it("tirages en avance sur l'avancement certifié", () => {
    const f = [{ authorizedAmount: 100, drawnAmount: 60, worksFinancing: true }, { authorizedAmount: 50, drawnAmount: 50, worksFinancing: false }];
    const r = assessDrawdown(f, { pct: 40, source: "situation visée" });
    expect(r.drawdownVsProgressPct).toBe(150);
    expect(r.aheadOfWorks).toBe(true);
    expect(assessDrawdown(f, { pct: 60, source: "x" }).aheadOfWorks).toBe(false);
    expect(assessDrawdown(f, { pct: null, source: "x" }).drawdownVsProgressPct).toBeUndefined();
    expect(assessDrawdown([], { pct: 50, source: "x" }).drawdownVsProgressPct).toBeUndefined();
  });
  it("avancement de référence : situation visée en priorité", () => {
    expect(certifiedProgress({ certifiedPcts: [20, 35], perimeterProgressPct: 50, visitProgressPct: 60 }).pct).toBe(35);
    expect(certifiedProgress({ certifiedPcts: [], perimeterProgressPct: 50, visitProgressPct: 60 }).pct).toBe(50);
    expect(certifiedProgress({ certifiedPcts: [], perimeterProgressPct: null, visitProgressPct: null }).pct).toBeNull();
  });
  it("plan de tirage en retard au-delà de 25 % du prévu à date", () => {
    const rows = [{ plannedDate: "2026-03-01", plannedAmount: 100, realizedAmount: 100 }, { plannedDate: "2026-08-01", plannedAmount: 100, realizedAmount: 20 }, { plannedDate: "2027-01-01", plannedAmount: 100, realizedAmount: 0 }];
    expect(drawdownScheduleLate(rows, NOW)).toMatchObject({ late: true, gapPct: 40 });
    expect(drawdownScheduleLate([{ plannedDate: "2027-01-01", plannedAmount: 100, realizedAmount: 0 }], NOW).late).toBeUndefined();
  });
});
