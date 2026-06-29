// =====================================================================
//  visitReports.ts — Analyse en amont des RAPPORTS DE VISITE de chantier.
//  Logique PURE et testable : tendance d'avancement constatée sur site,
//  écart par rapport au plan, agrégation des anomalies (qualité, sécurité,
//  retard, intempéries) et synthèse d'un niveau de risque terrain. Sert à
//  transformer une suite de rapports en informations pertinentes exploitables
//  (avant toute extraction documentaire).
// =====================================================================

const round1 = (v: number) => Math.round(v * 10) / 10;

export interface VisitReportView {
  id: string;
  visitDate: Date | string;
  trancheCode: string | null;
  observedProgressPct: number | null;
  workforceCount: number | null;
  weatherImpact: boolean;
  qualityIssue: boolean;
  safetyIssue: boolean;
  delayRisk: boolean;
  status: "DRAFT" | "FINALIZED";
}

const toDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
const MS_PER_MONTH = 30 * 86_400_000;

export type RiskLevel = "FAIBLE" | "MODERE" | "ELEVE";

export interface ProgressTrend {
  /** Avancement constaté le plus récent (%). */
  latestProgressPct: number | null;
  /** Avancement constaté précédent (%). */
  previousProgressPct: number | null;
  /** Variation entre les deux derniers rapports (points de %). */
  deltaPct: number | null;
  /** Vitesse moyenne d'avancement (points de % par mois) sur l'historique. */
  velocityPctPerMonth: number | null;
  /** L'avancement stagne ou recule (delta <= 0 avec >= 2 rapports). */
  stalled: boolean;
}

export interface AnomalyTally {
  reportsWithWeather: number;
  reportsWithQuality: number;
  reportsWithSafety: number;
  reportsWithDelay: number;
  /** Anomalies encore ouvertes au dernier rapport. */
  openIssues: ("weather" | "quality" | "safety" | "delay")[];
}

export interface VisitReportAnalysis {
  totalReports: number;
  latestVisitDate: Date | null;
  /** Jours écoulés depuis la dernière visite (à la date d'observation). */
  daysSinceLastVisit: number | null;
  trend: ProgressTrend;
  /** Écart au plan : plannedProgressPct − observé (positif = en retard). */
  planGapPct: number | null;
  anomalies: AnomalyTally;
  riskLevel: RiskLevel;
  /** Messages d'alerte/synthèse en français, prêts à afficher. */
  findings: string[];
}

export interface AnalyzeOptions {
  /** Avancement planifié de référence (%) à la date d'observation. */
  plannedProgressPct?: number | null;
  /** Date d'observation (par défaut : maintenant). */
  asOf?: Date;
}

const ANOMALY_LABELS: Record<"weather" | "quality" | "safety" | "delay", string> = {
  weather: "intempéries impactant le planning",
  quality: "non-conformité / malfaçon",
  safety: "incident ou risque sécurité (HSE)",
  delay: "risque de retard signalé",
};

/**
 * Analyse une série de rapports de visite et en extrait les informations
 * pertinentes : tendance d'avancement, écart au plan, anomalies et niveau de
 * risque terrain. Robuste aux rapports incomplets (champs nuls ignorés).
 */
export function analyzeVisitReports(
  reports: VisitReportView[],
  options: AnalyzeOptions = {},
): VisitReportAnalysis {
  const asOf = options.asOf ?? new Date();
  // Chronologique croissant.
  const sorted = [...reports].sort((a, b) => toDate(a.visitDate).getTime() - toDate(b.visitDate).getTime());
  const latest = sorted[sorted.length - 1];

  // --- Tendance d'avancement ---
  const withProgress = sorted.filter((r) => r.observedProgressPct != null) as (VisitReportView & { observedProgressPct: number })[];
  const latestProgressPct = withProgress.length ? withProgress[withProgress.length - 1]!.observedProgressPct : null;
  const previousProgressPct = withProgress.length >= 2 ? withProgress[withProgress.length - 2]!.observedProgressPct : null;
  const deltaPct = latestProgressPct != null && previousProgressPct != null ? round1(latestProgressPct - previousProgressPct) : null;

  let velocityPctPerMonth: number | null = null;
  if (withProgress.length >= 2) {
    const first = withProgress[0]!;
    const last = withProgress[withProgress.length - 1]!;
    const months = (toDate(last.visitDate).getTime() - toDate(first.visitDate).getTime()) / MS_PER_MONTH;
    if (months > 0) velocityPctPerMonth = round1((last.observedProgressPct - first.observedProgressPct) / months);
  }
  const stalled = deltaPct != null && deltaPct <= 0;

  const trend: ProgressTrend = { latestProgressPct, previousProgressPct, deltaPct, velocityPctPerMonth, stalled };

  // --- Écart au plan ---
  const planGapPct =
    options.plannedProgressPct != null && latestProgressPct != null
      ? round1(options.plannedProgressPct - latestProgressPct)
      : null;

  // --- Anomalies ---
  const tally = (pick: (r: VisitReportView) => boolean) => sorted.filter(pick).length;
  const openIssues: AnomalyTally["openIssues"] = [];
  if (latest?.weatherImpact) openIssues.push("weather");
  if (latest?.qualityIssue) openIssues.push("quality");
  if (latest?.safetyIssue) openIssues.push("safety");
  if (latest?.delayRisk) openIssues.push("delay");

  const anomalies: AnomalyTally = {
    reportsWithWeather: tally((r) => r.weatherImpact),
    reportsWithQuality: tally((r) => r.qualityIssue),
    reportsWithSafety: tally((r) => r.safetyIssue),
    reportsWithDelay: tally((r) => r.delayRisk),
    openIssues,
  };

  // --- Niveau de risque ---
  let riskLevel: RiskLevel = "FAIBLE";
  const bigGap = planGapPct != null && planGapPct > 20;
  const medGap = planGapPct != null && planGapPct > 5;
  if (openIssues.includes("safety") || bigGap || (openIssues.includes("delay") && medGap)) {
    riskLevel = "ELEVE";
  } else if (openIssues.length > 0 || medGap || (stalled && latest?.status !== undefined)) {
    riskLevel = "MODERE";
  }

  // --- Synthèse (findings) ---
  const findings: string[] = [];
  const latestVisitDate = latest ? toDate(latest.visitDate) : null;
  const daysSinceLastVisit = latestVisitDate ? Math.floor((asOf.getTime() - latestVisitDate.getTime()) / 86_400_000) : null;

  if (sorted.length === 0) {
    findings.push("Aucun rapport de visite enregistré : suivi terrain à initier.");
  } else {
    if (daysSinceLastVisit != null && daysSinceLastVisit > 90) {
      findings.push(`Dernière visite il y a ${daysSinceLastVisit} jours : rapport à actualiser.`);
    }
    if (planGapPct != null && planGapPct > 5) {
      findings.push(`Avancement en retard de ${planGapPct} pts vs plan (${latestProgressPct}% constaté).`);
    } else if (planGapPct != null && planGapPct < -5) {
      findings.push(`Avancement en avance de ${-planGapPct} pts vs plan (${latestProgressPct}% constaté).`);
    }
    if (stalled) {
      findings.push("L'avancement constaté stagne ou recule entre les deux dernières visites.");
    }
    for (const issue of openIssues) {
      findings.push(`Anomalie ouverte : ${ANOMALY_LABELS[issue]}.`);
    }
    if (findings.length === 0) {
      findings.push("Aucune alerte : avancement conforme et pas d'anomalie ouverte.");
    }
  }

  return {
    totalReports: sorted.length,
    latestVisitDate,
    daysSinceLastVisit,
    trend,
    planGapPct,
    anomalies,
    riskLevel,
    findings,
  };
}
