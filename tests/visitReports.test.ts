import { describe, it, expect } from "vitest";
import { analyzeVisitReports, type VisitReportView } from "@/lib/domain/visitReports";
import { extractReportFields, heuristicExtractor } from "@/lib/domain/visitReportExtraction";

const r = (over: Partial<VisitReportView>): VisitReportView => ({
  id: "x",
  visitDate: "2026-01-01",
  trancheCode: "T1",
  observedProgressPct: null,
  workforceCount: null,
  weatherImpact: false,
  qualityIssue: false,
  safetyIssue: false,
  delayRisk: false,
  status: "FINALIZED",
  ...over,
});

const asOf = new Date("2026-06-28");

describe("analyse des rapports de visite", () => {
  it("gère l'absence de rapport", () => {
    const a = analyzeVisitReports([], { asOf });
    expect(a.totalReports).toBe(0);
    expect(a.riskLevel).toBe("FAIBLE");
    expect(a.findings[0]).toMatch(/Aucun rapport/);
  });

  it("calcule la tendance d'avancement et la vitesse mensuelle", () => {
    const a = analyzeVisitReports(
      [
        r({ id: "1", visitDate: "2026-01-01", observedProgressPct: 20 }),
        r({ id: "2", visitDate: "2026-03-01", observedProgressPct: 40 }),
      ],
      { asOf },
    );
    expect(a.trend.latestProgressPct).toBe(40);
    expect(a.trend.previousProgressPct).toBe(20);
    expect(a.trend.deltaPct).toBe(20);
    expect(a.trend.velocityPctPerMonth).toBeGreaterThan(9); // ~20pts sur ~2 mois
    expect(a.trend.stalled).toBe(false);
  });

  it("détecte une stagnation de l'avancement", () => {
    const a = analyzeVisitReports(
      [
        r({ id: "1", visitDate: "2026-01-01", observedProgressPct: 50 }),
        r({ id: "2", visitDate: "2026-03-01", observedProgressPct: 50 }),
      ],
      { asOf },
    );
    expect(a.trend.stalled).toBe(true);
    expect(a.riskLevel).toBe("MODERE");
  });

  it("calcule l'écart au plan et déclenche un risque élevé si gros retard", () => {
    const a = analyzeVisitReports(
      [r({ id: "1", visitDate: "2026-05-01", observedProgressPct: 30 })],
      { asOf, plannedProgressPct: 60 },
    );
    expect(a.planGapPct).toBe(30); // 60 - 30
    expect(a.riskLevel).toBe("ELEVE");
    expect(a.findings.some((f) => /retard de 30 pts/.test(f))).toBe(true);
  });

  it("un incident sécurité ouvert force un risque élevé", () => {
    const a = analyzeVisitReports(
      [r({ id: "1", visitDate: "2026-05-01", observedProgressPct: 80, safetyIssue: true })],
      { asOf, plannedProgressPct: 82 },
    );
    expect(a.riskLevel).toBe("ELEVE");
    expect(a.anomalies.openIssues).toContain("safety");
  });

  it("agrège les anomalies sur l'historique et liste celles ouvertes", () => {
    const a = analyzeVisitReports(
      [
        r({ id: "1", visitDate: "2026-01-01", weatherImpact: true }),
        r({ id: "2", visitDate: "2026-03-01", weatherImpact: true, delayRisk: true }),
      ],
      { asOf },
    );
    expect(a.anomalies.reportsWithWeather).toBe(2);
    expect(a.anomalies.openIssues).toEqual(expect.arrayContaining(["weather", "delay"]));
  });

  it("signale une visite trop ancienne", () => {
    const a = analyzeVisitReports([r({ id: "1", visitDate: "2026-01-01", observedProgressPct: 50 })], { asOf });
    expect(a.daysSinceLastVisit).toBeGreaterThan(90);
    expect(a.findings.some((f) => /actualiser/.test(f))).toBe(true);
  });
});

describe("extraction des champs depuis le texte", () => {
  it("extrait date, avancement, effectif et tranche", () => {
    const txt = "Visite du 15/05/2026 sur la tranche T2. Avancement des travaux : 45%. Effectif présent : 12 ouvriers.";
    const f = extractReportFields(txt);
    expect(f.visitDate).toBe("2026-05-15");
    expect(f.observedProgressPct).toBe(45);
    expect(f.workforceCount).toBe(12);
    expect(f.trancheCode).toBe("T2");
    expect(f.detected).toEqual(expect.arrayContaining(["visitDate", "observedProgressPct", "workforceCount", "trancheCode"]));
  });

  it("détecte les anomalies par mots-clés (accents ignorés)", () => {
    const txt = "Des intempéries ont retardé le chantier. Fissures constatées. Problème de sécurité signalé.";
    const f = extractReportFields(txt);
    expect(f.weatherImpact).toBe(true);
    expect(f.qualityIssue).toBe(true);
    expect(f.safetyIssue).toBe(true);
    expect(f.delayRisk).toBe(true);
  });

  it("retourne des champs vides sur texte vide", () => {
    const f = extractReportFields("");
    expect(f.detected).toHaveLength(0);
    expect(f.observedProgressPct).toBeNull();
    expect(f.weatherImpact).toBe(false);
  });

  it("expose une interface d'extracteur pluggable (seam IA)", () => {
    expect(heuristicExtractor.name).toMatch(/Heuristique/);
    const custom = {
      name: "Stub",
      extract: () => ({ ...extractReportFields(""), observedProgressPct: 99, detected: ["observedProgressPct"] }),
    };
    expect(extractReportFields("ignoré", custom).observedProgressPct).toBe(99);
  });
});
