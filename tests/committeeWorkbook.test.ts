import { describe, it, expect } from "vitest";
import { buildCommitteeWorkbook, type CommitteeData } from "@/lib/domain/committeeWorkbook";

const sample: CommitteeData = {
  project: { reference: "PI-2026-001", name: "Résidence Al Manar", promoter: "Alpha SARL", city: "Casablanca", segment: "moyen_haut", nature: "Promotion" },
  score: 82, decision: "Favorable (GO)",
  regulatory: {
    className: "Créance saine", regimeName: "1/W/2025", isWatchList: false,
    restructuringNote: null, dataQualityStatus: "COMPLETE", missingCriticalData: [],
    triggers: [{ kind: "DPD", targetClass: "PRE_DOUTEUX", reason: "Retard 110j" }],
  },
  metrics: { ead: 120_000_000, slotting: "Strong", stage: 1, pd: 0.02, lgd: 0.45, expectedLoss: 1_080_000, ecl: 900_000, rwa: 84_000_000, riskWeight: 0.7 },
  provision: {
    ead: 120_000_000, reservedAgios: 0, eligibleGuarantees: 60_000_000, provisionBase: 60_000_000,
    rate: 0.1, provisionAmount: 6_000_000, isIrregular: false,
    breakdown: [{ typeCode: "HYP_RANG1", marketValue: 120_000_000, effectiveQuotity: 0.5, eligibleValue: 60_000_000 }],
  },
  domains: [{ code: "D1", name: "Sponsor", score: 90 }],
  criteria: [{ domainCode: "D1", code: "D1C1", name: "Projets livrés", rawValue: "4", score: 10, weighted: 2, matchedRef: "≥3 (OK)", gateBlocked: false }],
  redFlags: [{ name: "Cash coverage < 1", malus: 25 }],
};

describe("classeur Excel du dossier de comité", () => {
  it("produit les quatre feuilles attendues", () => {
    const sheets = buildCommitteeWorkbook(sample);
    expect(sheets.map((s) => s.name)).toEqual(["Synthèse", "Scoring", "Classification 1W", "Provision"]);
  });

  it("convertit les taux 0..1 en pourcentages numériques", () => {
    const sheets = buildCommitteeWorkbook(sample);
    const prov = sheets.find((s) => s.name === "Provision")!;
    const rateRow = prov.rows.find((r) => r[0] === "Taux (%)");
    expect(rateRow?.[1]).toBe(10); // 0.1 -> 10
  });

  it("descend au niveau critère dans la feuille Scoring", () => {
    const scoring = buildCommitteeWorkbook(sample).find((s) => s.name === "Scoring")!;
    const flat = scoring.rows.map((r) => r.join("|"));
    expect(flat.some((l) => l.includes("D1C1") && l.includes("Projets livrés"))).toBe(true);
    expect(flat.some((l) => l.includes("Red flags D5"))).toBe(true);
  });

  it("liste les déclencheurs 1/W et la qualité des données", () => {
    const cls = buildCommitteeWorkbook(sample).find((s) => s.name === "Classification 1W")!;
    const flat = cls.rows.map((r) => r.join("|"));
    expect(flat.some((l) => l.includes("Retard 110j"))).toBe(true);
    expect(flat.some((l) => l.includes("Qualité des données") && l.includes("COMPLETE"))).toBe(true);
  });
});
