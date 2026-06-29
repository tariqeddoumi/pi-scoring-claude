import { describe, it, expect } from "vitest";
import {
  SEGMENTS, ZONES, STANDINGS, UNIT_STATUSES, REFERENTIELS,
} from "@/lib/domain/referentiels";
import { PROMOTION_SCORING_MODEL } from "@/lib/domain/referenceData";

describe("référentiels — source unique des listes de valeurs", () => {
  it("labelOf renvoie le libellé, sinon le code, sinon tiret", () => {
    expect(SEGMENTS.labelOf("moyen_haut")).toBe("Moyen-haut standing");
    expect(SEGMENTS.labelOf("inconnu")).toBe("inconnu");
    expect(SEGMENTS.labelOf(null)).toBe("—");
  });

  it("expose des options {value,label} pour les listes déroulantes", () => {
    expect(UNIT_STATUSES.options).toContainEqual({ value: "VENDU", label: "Vendu" });
    expect(STANDINGS.options.length).toBe(6);
  });

  it("les segments couvrent les clés d'ajustement du modèle de scoring", () => {
    for (const key of Object.keys(PROMOTION_SCORING_MODEL.segmentAdjustments)) {
      expect(SEGMENTS.has(key)).toBe(true);
    }
  });

  it("les zones couvrent les clés d'ajustement de zone du modèle", () => {
    for (const key of Object.keys(PROMOTION_SCORING_MODEL.zoneAdjustments)) {
      expect(ZONES.has(key)).toBe(true);
    }
  });

  it("tous les référentiels sont indexés et non vides", () => {
    for (const ref of Object.values(REFERENTIELS)) {
      expect(ref.items.length).toBeGreaterThan(0);
    }
  });
});
