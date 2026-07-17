import { describe, it, expect } from "vitest";
import { computeCompleteness } from "@/lib/domain/completeness";

const STEPS = [
  { id: "a", title: "Étape A", fields: [{ key: "x" }, { key: "y" }] },
  { id: "b", title: "Étape B", fields: [{ key: "dpd_days" }, { key: "z" }] },
];

describe("completeness — complétude de la saisie", () => {
  it("mesure le taux global et par étape", () => {
    const c = computeCompleteness(STEPS, { x: 1, dpd_days: 0 });
    expect(c.total).toBe(4);
    expect(c.filled).toBe(2);
    expect(c.pct).toBe(50);
    expect(c.steps[0]!.missingKeys).toEqual(["y"]);
    expect(c.steps[1]!.missingKeys).toEqual(["z"]);
  });

  it("0, false et chaînes non vides comptent comme renseignés ; '' / null / undefined non", () => {
    const c = computeCompleteness(STEPS, { x: 0, y: false, dpd_days: "", z: null });
    expect(c.filled).toBe(2);
  });

  it("signale les champs critiques manquants (dpd_days)", () => {
    expect(computeCompleteness(STEPS, {}).missingCritical).toEqual(["dpd_days"]);
    expect(computeCompleteness(STEPS, { dpd_days: 15 }).missingCritical).toEqual([]);
  });

  it("dossier complet à 100 %", () => {
    const c = computeCompleteness(STEPS, { x: 1, y: 2, dpd_days: 0, z: "ok" });
    expect(c.pct).toBe(100);
    expect(c.complete).toBe(true);
  });
});
