import { describe, it, expect } from "vitest";
import { consolidateProgram } from "@/lib/domain/program";

describe("program — note consolidée", () => {
  it("note = moyenne des scores PROMOTION pondérée par l'exposition", () => {
    const r = consolidateProgram([
      { scoreFinal: 80, exposure: 100, assetType: "PROMOTION", cls: "SAIN" },
      { scoreFinal: 60, exposure: 300, assetType: "PROMOTION", cls: "SENSIBLE" },
    ]);
    // (80*100 + 60*300) / 400 = 65
    expect(r.weightedScore).toBe(65);
    expect(r.totalExposure).toBe(400);
    expect(r.worstClass).toBe("SENSIBLE");
  });

  it("exclut l'actif d'exploitation de la note mais le compte dans l'exposition", () => {
    const r = consolidateProgram([
      { scoreFinal: 80, exposure: 100, assetType: "PROMOTION", cls: "SAIN" },
      { scoreFinal: 40, exposure: 100, assetType: "EXPLOITATION", cls: "COMPROMIS" },
    ]);
    expect(r.weightedScore).toBe(80); // seul le promotion compte
    expect(r.operationalExposure).toBe(100);
    expect(r.promotionExposure).toBe(100);
    expect(r.totalExposure).toBe(200);
    expect(r.operationalComponents).toBe(1);
    // Le risque consolidé reflète quand même l'actif le plus dégradé.
    expect(r.worstClass).toBe("COMPROMIS");
  });

  it("aucune composante promotion scorée → note nulle", () => {
    const r = consolidateProgram([
      { scoreFinal: null, exposure: 100, assetType: "PROMOTION", cls: null },
      { scoreFinal: 50, exposure: 50, assetType: "EXPLOITATION", cls: "SENSIBLE" },
    ]);
    expect(r.weightedScore).toBeNull();
    expect(r.scoredExposure).toBe(0);
  });

  it("programme vide", () => {
    const r = consolidateProgram([]);
    expect(r.weightedScore).toBeNull();
    expect(r.totalExposure).toBe(0);
    expect(r.worstClass).toBeUndefined();
  });
});
