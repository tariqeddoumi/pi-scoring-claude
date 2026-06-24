import { describe, it, expect } from "vitest";
import { computeGfaRelief } from "@/lib/domain/gfaVefa";

describe("gfaVefa — valeur admise de la GFA", () => {
  it("aucune GFA → aucun effet", () => {
    const r = computeGfaRelief({ saleMode: "VEFA", hasGFA: false, gfaAmount: 50, exposure: 100 });
    expect(r.applicable).toBe(false);
    expect(r.admittedValue).toBe(0);
  });

  it("GFA en cadre VEFA → admise à 100% (quotité pleine)", () => {
    const r = computeGfaRelief({ saleMode: "VEFA", hasGFA: true, gfaAmount: 40_000_000, exposure: 100_000_000 });
    expect(r.quotity).toBe(1);
    expect(r.admittedValue).toBe(40_000_000);
    expect(r.applicable).toBe(true);
  });

  it("GFA hors VEFA → abattement prudentiel 25% par défaut", () => {
    const r = computeGfaRelief({ saleMode: "CLASSIC", hasGFA: true, gfaAmount: 40_000_000, exposure: 100_000_000 });
    expect(r.quotity).toBeCloseTo(0.75);
    expect(r.admittedValue).toBe(30_000_000);
  });

  it("la valeur admise est plafonnée à l'exposition", () => {
    const r = computeGfaRelief({ saleMode: "VEFA", hasGFA: true, gfaAmount: 80_000_000, exposure: 50_000_000 });
    expect(r.admittedValue).toBe(50_000_000);
    expect(r.cappedByExposure).toBe(true);
  });

  it("garant non éligible → GFA non admise", () => {
    const r = computeGfaRelief({ saleMode: "VEFA", hasGFA: true, gfaAmount: 40_000_000, exposure: 100_000_000, gfaEligible: false });
    expect(r.applicable).toBe(false);
    expect(r.admittedValue).toBe(0);
  });

  it("abattement hors VEFA paramétrable", () => {
    const r = computeGfaRelief({ saleMode: "CLASSIC", hasGFA: true, gfaAmount: 100, exposure: 1000, nonVefaHaircut: 0.4 });
    expect(r.quotity).toBeCloseTo(0.6);
    expect(r.admittedValue).toBe(60);
  });
});
