import { describe, it, expect } from "vitest";
import { PROMOTION_SCORING_MODEL } from "@/lib/domain/referenceData";
import { validateModelForPublish } from "@/lib/domain/modelValidation";

// Invariants du modèle PI_PROMOTION V2.0 (échelle critère 1..10). Verrouille la
// migration : échelle, somme des poids = 100%, barèmes bornés 1..10, gates à 1.
const M = PROMOTION_SCORING_MODEL;

describe("modèle PI_PROMOTION V2.0 — échelle 1..10", () => {
  it("est versionné v2.x sur une échelle critère de 10", () => {
    expect(M.version.startsWith("v2")).toBe(true);
    expect(M.scoreScale).toBe(10);
  });

  it("a des poids de domaines qui totalisent 100% (corrige l'incohérence des 90%)", () => {
    const sum = M.domains.reduce((s, d) => s + d.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("a des poids de critères qui totalisent 100% par domaine", () => {
    for (const d of M.domains) {
      const sum = d.criteria.reduce((s, c) => s + c.weight, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    }
  });

  it("borne tous les barèmes (ranges) et modalités (options) entre 1 et l'échelle", () => {
    for (const d of M.domains) {
      for (const c of d.criteria) {
        for (const r of c.ranges ?? []) {
          expect(r.score).toBeGreaterThanOrEqual(1);
          expect(r.score).toBeLessThanOrEqual(M.scoreScale);
        }
        for (const o of c.options ?? []) {
          expect(o.score).toBeGreaterThanOrEqual(1);
          expect(o.score).toBeLessThanOrEqual(M.scoreScale);
        }
      }
    }
  });

  it("relève le seuil de gate à 1 (la pire note vaut 1, plus 0)", () => {
    for (const d of M.domains) {
      for (const c of d.criteria) {
        if (c.isGate) expect(c.gateThreshold).toBe(1);
      }
    }
  });

  it("passe la validation de publication (poids cohérents, barèmes présents)", () => {
    const lite = {
      domains: M.domains.map((d) => ({
        code: d.code,
        weight: d.weight,
        criteria: d.criteria.map((c) => ({
          code: c.code,
          type: c.type,
          weight: c.weight,
          optionsCount: c.options?.length ?? 0,
          rangesCount: c.ranges?.length ?? 0,
        })),
      })),
    };
    expect(validateModelForPublish(lite)).toHaveLength(0);
  });
});
