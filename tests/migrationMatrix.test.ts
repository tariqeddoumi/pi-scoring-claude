import { describe, it, expect } from "vitest";
import {
  buildMigrationMatrix,
  migrationMatrixFromSequences,
  pairConsecutive,
  severityRank,
  MIGRATION_CLASS_ORDER,
} from "@/lib/domain/migrationMatrix";

describe("migrationMatrix — pure", () => {
  it("ordonne les classes par sévérité croissante", () => {
    expect(severityRank("SAIN")).toBe(0);
    expect(severityRank("CTX")).toBe(MIGRATION_CLASS_ORDER.length - 1);
    expect(severityRank("INCONNU")).toBe(-1);
  });

  it("paire les transitions consécutives et ignore les classes inconnues", () => {
    expect(pairConsecutive(["SAIN", "SENSIBLE", "DOUTEUX"])).toEqual([
      { from: "SAIN", to: "SENSIBLE" },
      { from: "SENSIBLE", to: "DOUTEUX" },
    ]);
    expect(pairConsecutive(["SAIN"])).toEqual([]);
    expect(pairConsecutive(["SAIN", "???", "DOUTEUX"])).toEqual([
      { from: "SAIN", to: "DOUTEUX" },
    ]);
  });

  it("classe stable / amélioration / dégradation", () => {
    const m = buildMigrationMatrix([
      { from: "SAIN", to: "SAIN" }, // stable
      { from: "SAIN", to: "SENSIBLE" }, // dégradation
      { from: "DOUTEUX", to: "SENSIBLE" }, // amélioration
    ]);
    expect(m.stable).toBe(1);
    expect(m.downgrades).toBe(1);
    expect(m.upgrades).toBe(1);
    expect(m.totalTransitions).toBe(3);
  });

  it("calcule les taux par ligne (somme = 100% si la ligne est peuplée)", () => {
    const m = buildMigrationMatrix([
      { from: "SAIN", to: "SAIN" },
      { from: "SAIN", to: "SAIN" },
      { from: "SAIN", to: "SENSIBLE" },
    ]);
    expect(m.counts.SAIN.SAIN).toBe(2);
    expect(m.rowTotals.SAIN).toBe(3);
    expect(Math.round(m.rates.SAIN.SAIN)).toBe(67);
    expect(Math.round(m.rates.SAIN.SENSIBLE)).toBe(33);
    // Ligne vide → taux nuls, pas de division par zéro.
    expect(m.rates.CTX.CTX).toBe(0);
  });

  it("agrège plusieurs dossiers via leurs séquences", () => {
    const m = migrationMatrixFromSequences([
      ["SAIN", "SENSIBLE", "SENSIBLE"], // 1 dégradation + 1 stable
      ["DOUTEUX", "PRE_DOUTEUX"], // 1 amélioration
    ]);
    expect(m.totalTransitions).toBe(3);
    expect(m.downgrades).toBe(1);
    expect(m.stable).toBe(1);
    expect(m.upgrades).toBe(1);
  });
});
