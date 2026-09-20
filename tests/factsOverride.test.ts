import { describe, it, expect } from "vitest";
import { deriveFacts, detectFactDivergences } from "@/lib/domain/facts";
import {
  canApproveOverride,
  isDerogationAdmissible,
  isDefaultClass,
  classSeverity,
} from "@/lib/domain/overridePolicy";

describe("Faits à source unique (F04)", () => {
  const now = new Date("2026-09-20T00:00:00Z");

  it("dérive arrêt et retard depuis les dates primitives (convention ≥)", () => {
    const d = deriveFacts({ stoppedSince: "2025-09-15T00:00:00Z" }, now);
    expect(d.project_stopped_months).toBeGreaterThanOrEqual(12);
    expect(d.project_stopped_over_1y).toBe(true);
  });

  it("un arrêt de 13 mois ne peut pas coexister avec un booléen à false (divergence)", () => {
    const d = deriveFacts({ stoppedSince: "2025-08-01T00:00:00Z" }, now);
    const div = detectFactDivergences(d, { project_stopped_over_1y: false });
    expect(div.length).toBe(1);
    expect(div[0]!.key).toBe("project_stopped_over_1y");
  });

  it("aucune divergence quand booléen importé = valeur dérivée", () => {
    const d = deriveFacts({ stoppedSince: "2025-08-01T00:00:00Z" }, now);
    expect(detectFactDivergences(d, { project_stopped_over_1y: true })).toHaveLength(0);
  });
});

describe("Garde-fous des dérogations (F05)", () => {
  it("le demandeur ne peut pas approuver sa propre dérogation", () => {
    expect(canApproveOverride("u1", "u1")).toBe(false);
    expect(canApproveOverride("u1", "u2")).toBe(true);
  });

  it("plancher non dérogeable : un défaut avéré ne peut pas devenir SAIN", () => {
    expect(isDerogationAdmissible("DOUTEUX", "SAIN").ok).toBe(false);
    expect(isDerogationAdmissible("PRE_DOUTEUX", "SENSIBLE").ok).toBe(false);
    // Rester dans le défaut ou aggraver reste admissible.
    expect(isDerogationAdmissible("DOUTEUX", "COMPROMIS").ok).toBe(true);
    // Une créance saine peut être forcée vers une classe plus sévère.
    expect(isDerogationAdmissible("SAIN", "SENSIBLE").ok).toBe(true);
  });

  it("classes de défaut et sévérité ordonnée", () => {
    expect(isDefaultClass("PRE_DOUTEUX")).toBe(true);
    expect(isDefaultClass("SAIN")).toBe(false);
    expect(classSeverity("CTX")).toBeGreaterThan(classSeverity("SAIN"));
  });
});
