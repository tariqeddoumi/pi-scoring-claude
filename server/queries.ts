// =====================================================================
//  Lectures (read models) pour l'UI. Server-only.
// =====================================================================

import { prisma } from "@/lib/prisma";
import {
  WORKFLOW_LABELS,
  actionableStatesFor,
  roleTransitions,
  type WorkflowStateName,
} from "@/lib/workflow";
import type { RoleName } from "@/lib/rbac";
import {
  migrationMatrixFromSequences,
  type MigrationMatrix,
} from "@/lib/domain/migrationMatrix";
import { mostSevereClass } from "@/lib/domain/groups";
import { consolidateProgram, type ProgramConsolidation, type AssetTypeCode } from "@/lib/domain/program";
import { computeRiskMetrics, DEFAULT_CALIBRATION, type SlottingCategory, type RiskCalibration } from "@/lib/domain/riskMetrics";
import { computeEcl } from "@/lib/domain/ifrs9";
import { classSeverity } from "@/lib/domain/groups";
import { projectEad } from "@/lib/domain/facility";
import { applyStress, STRESS_SCENARIOS, type StressShock } from "@/lib/domain/stress";
import { classify } from "@/server/engines/regulatoryClassificationEngine";
import { runScoring, pdProxy } from "@/server/engines/scoringEngine";
import { buildPdBacktest } from "@/lib/domain/pdBacktest";
import { computeProvision } from "@/server/engines/provisioningEngine";
import {
  PROMOTION_SCORING_MODEL,
  REGIME_1W_2025,
  REGIME_1W_PROVISION_RATES,
} from "@/lib/domain/referenceData";
import { EXPLOITATION_SCORING_MODEL } from "@/lib/domain/exploitationModel";
import { summarizeCommercialisation, type UnitView } from "@/lib/domain/commercialisation";
import { analyzeVisitReports, type VisitReportView } from "@/lib/domain/visitReports";
import { computeBusinessPlanDrift, type UnitBaselineView } from "@/lib/domain/businessPlan";
import { EVENT_TYPES } from "@/lib/domain/referentiels";
import { scoreFreshness } from "@/lib/domain/reviewPolicy";
import { hasMaterialEventSince } from "@/lib/domain/eventSignals";
import type { ProjectInputs, RegulatoryClassCode } from "@/lib/domain/types";

/** Historique des versions de calibrage (la plus récente d'abord). */
export async function getCalibrationHistory(limit = 20) {
  return prisma.riskCalibration.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Calibrage actif des paramètres de risque (PD/LGD/maturité). */
export async function getActiveCalibration(): Promise<RiskCalibration & { id: string; label: string }> {
  const row = await prisma.riskCalibration.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return { id: "default", label: "Calibrage par défaut", ...DEFAULT_CALIBRATION };
  return {
    id: row.id,
    label: row.label,
    pd: {
      STRONG: row.pdStrong,
      GOOD: row.pdGood,
      SATISFACTORY: row.pdSatisfactory,
      WEAK: row.pdWeak,
      DEFAULT: 1,
    },
    lgdUnsecured: row.lgdUnsecured,
    lgdFloor: row.lgdFloor,
    maturityYears: row.maturityYears,
  };
}

const SLOTTING_ORDER: SlottingCategory[] = ["STRONG", "GOOD", "SATISFACTORY", "WEAK", "DEFAULT"];

export async function getProjectsWithLatestRun() {
  const projects = await prisma.realEstateProject.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      promoter: true,
      rm: true,
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return projects;
}

export async function getProjectDetail(id: string) {
  return prisma.realEstateProject.findUnique({
    where: { id },
    include: {
      promoter: true,
      rm: true,
      inputs: true,
      guarantees: { include: { type: true } },
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      attachments: true,
      group: true,
      facilities: {
        orderBy: { createdAt: "asc" },
        include: { installments: { orderBy: { seq: "asc" } } },
      },
      workflowSteps: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      committeeDecisions: { include: { chair: true }, orderBy: { createdAt: "desc" } },
      scoringRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          criterionResults: { include: { criterion: { include: { domain: true } } } },
          domainResults: { include: { domain: true } },
        },
      },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { regime: true } },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      regulatoryOverrides: { include: { requestedBy: true, decidedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

/**
 * Exposition consolidée d'une contrepartie (promoteur) : ses projets avec leur
 * dernière classe et exposition (EAD), la classe la plus sévère (contagion
 * contrepartie art.33/50) et l'exposition totale. Sert à expliciter le risque
 * multi-projets/facilités de la contrepartie (1/W §6.2 #9).
 */
export async function getCounterpartyExposure(promoterId: string) {
  const promoter = await prisma.promoter.findUnique({ where: { id: promoterId }, select: { id: true, name: true } });
  if (!promoter) return null;
  const projects = await prisma.realEstateProject.findMany({
    where: { promoterId },
    select: {
      id: true, reference: true, name: true, loanAmount: true,
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { resultClass: true } },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { ead: true } },
      facilities: { select: { authorizedAmount: true, drawnAmount: true, ccf: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const members = projects.map((p) => ({
    id: p.id, reference: p.reference, name: p.name,
    cls: (p.classificationRuns[0]?.resultClass ?? null) as RegulatoryClassCode | null,
    exposure: p.provisionRuns[0]?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead,
  }));
  return {
    promoter,
    members,
    count: members.length,
    severeClass: mostSevereClass(members.map((m) => m.cls ?? undefined)),
    totalExposure: members.reduce((s, m) => s + m.exposure, 0),
  };
}

// ---------------------------------------------------------------------
//  Suivi de projet de promotion : commercialisation par tranche / lot.
//  Lit les tranches + lots et calcule la synthèse (ventes, CA, décalage
//  business plan, déclassements de standing, mainlevées) via la logique
//  pure de lib/domain/commercialisation.
// ---------------------------------------------------------------------

export async function getProjectMonitoring(id: string) {
  const project = await prisma.realEstateProject.findUnique({
    where: { id },
    select: { id: true, reference: true, name: true, assetType: true },
  });
  if (!project) return null;

  const tranches = await prisma.tranche.findMany({
    where: { projectId: id },
    orderBy: { orderIndex: "asc" },
    include: { units: { orderBy: { reference: "asc" } } },
  });

  const units: UnitView[] = tranches.flatMap((t) =>
    t.units.map((unit) => ({
      reference: unit.reference,
      trancheCode: t.code,
      type: unit.type as UnitView["type"],
      status: unit.status as UnitView["status"],
      plannedStanding: unit.plannedStanding as UnitView["plannedStanding"],
      standing: unit.standing as UnitView["standing"],
      plannedPrice: unit.plannedPrice,
      listPrice: unit.listPrice,
      soldPrice: unit.soldPrice,
      plannedSaleDate: unit.plannedSaleDate,
      soldAt: unit.soldAt,
      mortgageReleased: unit.mortgageReleased,
      releasedAmount: unit.releasedAmount,
    })),
  );

  // Rapports de visite (récents d'abord) + analyse en amont.
  const reports = await prisma.visitReport.findMany({
    where: { projectId: id },
    orderBy: { visitDate: "desc" },
    include: { author: true },
  });

  // Avancement officiel de référence : moyenne des tranches pondérée par budget
  // (sinon moyenne simple), pour situer l'avancement constaté sur site.
  const budgetSum = tranches.reduce((s, t) => s + (t.budget ?? 0), 0);
  const plannedProgressPct =
    tranches.length === 0
      ? null
      : budgetSum > 0
        ? tranches.reduce((s, t) => s + t.progressPct * (t.budget ?? 0), 0) / budgetSum
        : tranches.reduce((s, t) => s + t.progressPct, 0) / tranches.length;

  const reportViews: VisitReportView[] = reports.map((r) => ({
    id: r.id,
    visitDate: r.visitDate,
    trancheCode: r.trancheCode,
    observedProgressPct: r.observedProgressPct,
    workforceCount: r.workforceCount,
    weatherImpact: r.weatherImpact,
    qualityIssue: r.qualityIssue,
    safetyIssue: r.safetyIssue,
    delayRisk: r.delayRisk,
    status: r.status as VisitReportView["status"],
  }));

  // Dérive du business plan vs origine (v0) + historique des révisions.
  const baselines: UnitBaselineView[] = tranches.flatMap((t) =>
    t.units.map((unit) => ({
      reference: unit.reference,
      trancheCode: t.code,
      originalStanding: unit.originalStanding as UnitBaselineView["originalStanding"],
      originalPrice: unit.originalPrice,
      originalSaleDate: unit.originalSaleDate,
      plannedStanding: unit.plannedStanding as UnitBaselineView["plannedStanding"],
      plannedPrice: unit.plannedPrice,
      plannedSaleDate: unit.plannedSaleDate,
    })),
  );
  const bpDrift = computeBusinessPlanDrift(baselines);
  const bpRevisions = await prisma.businessPlanRevision.findMany({
    where: { projectId: id },
    orderBy: { version: "desc" },
  });

  // Lots (avec id) pour le formulaire de révision du BP.
  const unitsForRevision = tranches.flatMap((t) =>
    t.units.map((unit) => ({
      id: unit.id,
      reference: unit.reference,
      trancheCode: t.code,
      plannedStanding: unit.plannedStanding as string,
      plannedPrice: unit.plannedPrice,
      plannedSaleDate: unit.plannedSaleDate,
    })),
  );

  // Journal d'événements + timeline chronologique unifiée du projet
  // (événements, visites, révisions BP, étapes workflow, scorings).
  const events = await prisma.projectEvent.findMany({
    where: { projectId: id },
    orderBy: { eventDate: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  const [workflowSteps, scoringRuns] = await Promise.all([
    prisma.workflowStep.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    prisma.scoringRun.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, scoreFinal: true, decision: true },
    }),
  ]);

  const timeline: TimelineEntry[] = [
    ...events.map((e) => ({
      kind: "EVENT" as const,
      id: e.id,
      date: e.eventDate,
      title: e.title ?? EVENT_TYPES.labelOf(e.type),
      type: e.type,
      severity: e.severity,
      detail: e.note,
      amount: e.amount,
      actor: e.createdBy.name,
      resolved: e.resolved,
      affectsScoring: e.affectsScoring,
    })),
    ...reports.map((r) => ({
      kind: "VISIT" as const,
      id: r.id,
      date: r.visitDate,
      title: `Visite de chantier${r.trancheCode ? ` (${r.trancheCode})` : ""}`,
      detail: r.summary,
      severity: r.delayRisk || r.safetyIssue ? "WARNING" : "INFO",
      actor: r.author?.name ?? r.inspectorName,
      amount: null,
    })),
    ...bpRevisions.map((b) => ({
      kind: "BP_REVISION" as const,
      id: b.id,
      date: b.createdAt,
      title: `Révision business plan v${b.version}`,
      detail: b.reason,
      severity: "WARNING",
      actor: b.requestedByName,
      amount: null,
    })),
    ...workflowSteps.map((s) => ({
      kind: "WORKFLOW" as const,
      id: s.id,
      date: s.createdAt,
      title: `Circuit : ${WORKFLOW_LABELS[s.toState as WorkflowStateName]}`,
      detail: s.comment,
      severity: "INFO",
      actor: s.actor?.name ?? null,
      amount: null,
    })),
    ...scoringRuns.map((r) => ({
      kind: "SCORING" as const,
      id: r.id,
      date: r.createdAt,
      title: `Scoring : ${r.scoreFinal ?? "—"} · ${r.decision ?? ""}`,
      detail: null,
      severity: "INFO",
      actor: null,
      amount: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    project,
    tranches,
    summary: summarizeCommercialisation(units),
    reports,
    visitAnalysis: analyzeVisitReports(reportViews, { plannedProgressPct }),
    plannedProgressPct,
    bpDrift,
    bpRevisions,
    unitsForRevision,
    events,
    timeline,
  };
}

export interface TimelineEntry {
  kind: "EVENT" | "VISIT" | "BP_REVISION" | "WORKFLOW" | "SCORING";
  id: string;
  date: Date;
  title: string;
  detail?: string | null;
  severity?: string;
  actor?: string | null;
  amount?: number | null;
  type?: string;
  resolved?: boolean;
  affectsScoring?: boolean;
}

/**
 * Fraîcheur du score d'un projet : périodicité par classe (revue régulière)
 * + déclenchement immédiat sur événement matériel postérieur au dernier calcul.
 */
export async function getScoreFreshness(projectId: string) {
  const [lastRun, lastCls, events] = await Promise.all([
    prisma.scoringRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.classificationRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { resultClass: true },
    }),
    prisma.projectEvent.findMany({
      where: { projectId },
      select: { type: true, eventDate: true, endDate: true, resolved: true, affectsScoring: true },
    }),
  ]);
  return scoreFreshness({
    lastScoredAt: lastRun?.createdAt ?? null,
    cls: (lastCls?.resultClass as RegulatoryClassCode | undefined) ?? null,
    materialEventSince: hasMaterialEventSince(events, lastRun?.createdAt ?? null),
  });
}

/**
 * File des re-scorings : projets dont le score doit être recalculé (revue
 * périodique dépassée, événement matériel, ou jamais scoré). Alimente les
 * tableaux de bord (front et risque).
 */
export async function getRescoringQueue() {
  const projects = await prisma.realEstateProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      promoter: { select: { name: true } },
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { resultClass: true } },
      events: { select: { type: true, eventDate: true, endDate: true, resolved: true, affectsScoring: true } },
    },
  });

  const items = projects
    .map((p) => {
      const lastRun = p.scoringRuns[0]?.createdAt ?? null;
      const f = scoreFreshness({
        lastScoredAt: lastRun,
        cls: (p.classificationRuns[0]?.resultClass as RegulatoryClassCode | undefined) ?? null,
        materialEventSince: hasMaterialEventSince(p.events, lastRun),
      });
      return {
        id: p.id,
        reference: p.reference,
        name: p.name,
        promoter: p.promoter.name,
        exposure: p.loanAmount ?? 0,
        cls: (p.classificationRuns[0]?.resultClass as RegulatoryClassCode | undefined) ?? null,
        freshness: f,
      };
    })
    .filter((it) => it.freshness.needsRescoring)
    .sort((a, b) => {
      // Événements matériels d'abord, puis retard décroissant.
      const rank = (s: string) => (s === "EVENT_TRIGGERED" ? 0 : s === "OVERDUE" ? 1 : 2);
      const r = rank(a.freshness.status) - rank(b.freshness.status);
      if (r !== 0) return r;
      return (b.freshness.overdueDays ?? 0) - (a.freshness.overdueDays ?? 0);
    });

  return { items, total: items.length };
}

/** Historique des scores d'un projet (du plus ancien au plus récent). */
export async function getScoringHistory(projectId: string) {
  const runs = await prisma.scoringRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, scoreFinal: true, decision: true },
  });
  return runs;
}

/** Options pour le formulaire projet : promoteurs + chargés d'affaires. */
export async function getProjectFormOptions() {
  const [promoters, managers, groups] = await Promise.all([
    prisma.promoter.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { promoters, managers, groups };
}

/** Projet pour pré-remplir le formulaire d'édition. */
export async function getProjectForEdit(id: string) {
  return prisma.realEstateProject.findUnique({
    where: { id },
    select: {
      id: true, reference: true, name: true, promoterId: true, rmId: true,
      assetType: true, city: true, region: true, projectType: true, segment: true,
      zone: true, status: true, saleMode: true, totalUnits: true, totalCost: true,
      loanAmount: true, ownEquity: true,
      groupId: true, address: true, landAreaSqm: true, builtAreaSqm: true,
      landTitleRef: true, landStatus: true, buildPermitRef: true, buildPermitDate: true,
      startDate: true, expectedDeliveryDate: true, description: true,
    },
  });
}

// ---------------------------------------------------------------------
//  Promoteurs : liste, fiche signalétique et liens (parties liées).
// ---------------------------------------------------------------------

export async function getPromoters() {
  return prisma.promoter.findMany({
    orderBy: { name: "asc" },
    include: {
      group: { select: { id: true, name: true } },
      _count: { select: { projects: true, linksFrom: true, linksTo: true } },
    },
  });
}

export async function getPromoterDetail(id: string) {
  const promoter = await prisma.promoter.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, name: true } },
      projects: {
        orderBy: { updatedAt: "desc" },
        include: {
          scoringRuns: { orderBy: { createdAt: "desc" }, take: 1 },
          classificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      linksFrom: { include: { to: { select: { id: true, name: true } } } },
      linksTo: { include: { from: { select: { id: true, name: true } } } },
    },
  });
  if (!promoter) return null;

  const others = await prisma.promoter.findMany({
    where: { id: { not: id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const groups = await prisma.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return { promoter, others, groups };
}

// ---------------------------------------------------------------------
//  Tableau de bord FRONT (chargé d'affaires / directeur de centre / région) :
//  mon portefeuille, dossiers en attente de mon action, pipeline global.
// ---------------------------------------------------------------------

export async function getFrontDashboard(userId: string, role: RoleName) {
  const projects = await prisma.realEstateProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      promoter: { select: { name: true } },
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      workflowSteps: { orderBy: { createdAt: "desc" }, take: 1, include: { actor: { select: { name: true } } } },
    },
  });

  const stateOf = (p: (typeof projects)[number]) =>
    (p.workflowSteps[0]?.toState ?? "DRAFT") as WorkflowStateName;

  // Pipeline global par état du circuit.
  const pipeline: { state: WorkflowStateName; label: string; count: number; exposure: number }[] = [];
  const byState = new Map<WorkflowStateName, { count: number; exposure: number }>();
  for (const p of projects) {
    const s = stateOf(p);
    const acc = byState.get(s) ?? { count: 0, exposure: 0 };
    acc.count += 1;
    acc.exposure += p.loanAmount ?? 0;
    byState.set(s, acc);
  }
  for (const s of Object.keys(WORKFLOW_LABELS) as WorkflowStateName[]) {
    const v = byState.get(s);
    if (v) pipeline.push({ state: s, label: WORKFLOW_LABELS[s], count: v.count, exposure: v.exposure });
  }

  // Dossiers en attente d'une action de MON rôle.
  const actionable = actionableStatesFor(role);
  const toProcess = projects
    .filter((p) => actionable.includes(stateOf(p)))
    .map((p) => ({
      id: p.id,
      reference: p.reference,
      name: p.name,
      promoter: p.promoter.name,
      state: stateOf(p),
      stateLabel: WORKFLOW_LABELS[stateOf(p)],
      exposure: p.loanAmount ?? 0,
      since: p.workflowSteps[0]?.createdAt ?? p.createdAt,
    }));

  // Mon portefeuille (dossiers dont je suis le chargé d'affaires).
  const mine = projects
    .filter((p) => p.rmId === userId)
    .map((p) => ({
      id: p.id,
      reference: p.reference,
      name: p.name,
      promoter: p.promoter.name,
      state: stateOf(p),
      stateLabel: WORKFLOW_LABELS[stateOf(p)],
      exposure: p.loanAmount ?? 0,
      score: p.scoringRuns[0]?.scoreFinal ?? null,
      decision: p.scoringRuns[0]?.decision ?? null,
    }));

  const myExposure = mine.reduce((n, p) => n + p.exposure, 0);
  return { pipeline, toProcess, mine, myExposure, totalCount: projects.length };
}

export async function getPortfolioStats() {
  const projects = await getProjectsWithLatestRun();
  const total = projects.length;
  const byClass: Record<string, number> = {};
  const byDecision: Record<string, number> = {};
  let totalProvision = 0;
  let totalExposure = 0;

  for (const p of projects) {
    const cls = p.classificationRuns[0]?.resultClass;
    if (cls) byClass[cls] = (byClass[cls] ?? 0) + 1;
    const dec = p.scoringRuns[0]?.decision;
    if (dec) byDecision[dec] = (byDecision[dec] ?? 0) + 1;
    totalProvision += p.provisionRuns[0]?.provisionAmount ?? 0;
    totalExposure += p.loanAmount ?? 0;
  }
  return { total, byClass, byDecision, totalProvision, totalExposure, projects };
}

// ---------------------------------------------------------------------
//  Vue risque portefeuille (V2) : heatmap classe×décision, concentrations
//  et top expositions. Agrégation en mémoire sur les derniers runs.
// ---------------------------------------------------------------------

const CLASS_ORDER = ["SAIN", "SENSIBLE", "PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"] as const;
const DECISION_ORDER = ["GO", "GO_WITH_CONDITIONS", "WATCH_LIST", "NO_GO"] as const;

export interface ConcentrationRow {
  key: string;
  count: number;
  exposure: number;
  provision: number;
  coverage: number; // provision / exposure (%)
}

function aggregateConcentration(
  rows: { key: string | null | undefined; exposure: number; provision: number }[],
): ConcentrationRow[] {
  const map = new Map<string, { count: number; exposure: number; provision: number }>();
  for (const r of rows) {
    const key = r.key && r.key.length > 0 ? r.key : "—";
    const acc = map.get(key) ?? { count: 0, exposure: 0, provision: 0 };
    acc.count += 1;
    acc.exposure += r.exposure;
    acc.provision += r.provision;
    map.set(key, acc);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      count: v.count,
      exposure: v.exposure,
      provision: v.provision,
      coverage: v.exposure > 0 ? (v.provision / v.exposure) * 100 : 0,
    }))
    .sort((a, b) => b.exposure - a.exposure);
}

export async function getRiskDashboard() {
  const projects = await getProjectsWithLatestRun();
  const calib = await getActiveCalibration();

  // Heatmap classe (lignes) × décision (colonnes).
  const heatmap: Record<string, Record<string, number>> = {};
  for (const cls of CLASS_ORDER) {
    heatmap[cls] = {};
    for (const dec of DECISION_ORDER) heatmap[cls][dec] = 0;
  }
  let classified = 0;

  const flat = projects.map((p) => {
    const cls = p.classificationRuns[0]?.resultClass ?? null;
    const dec = p.scoringRuns[0]?.decision ?? null;
    const exposure = p.loanAmount ?? 0;
    const provision = p.provisionRuns[0]?.provisionAmount ?? 0;
    const row = cls ? heatmap[cls] : undefined;
    if (dec && row && dec in row) {
      row[dec] = (row[dec] ?? 0) + 1;
      classified += 1;
    }
    return {
      id: p.id,
      reference: p.reference,
      name: p.name,
      promoter: p.promoter.name,
      segment: p.segment,
      zone: p.zone,
      cls,
      dec,
      exposure,
      provision,
    };
  });

  // Métriques internationales (Bâle/IFRS 9) agrégées au portefeuille.
  const slotting = Object.fromEntries(
    SLOTTING_ORDER.map((s) => [s, { count: 0, ead: 0, el: 0 }]),
  ) as Record<SlottingCategory, { count: number; ead: number; el: number }>;
  const stageDist: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  let totalExpectedLoss = 0;
  let totalRwa = 0;
  let totalEad = 0;
  let totalEcl = 0; // ECL IFRS 9
  let totalProvisionBkam = 0; // provision prudentielle BKAM

  for (const p of projects) {
    const ead = p.provisionRuns[0]?.ead ?? p.loanAmount ?? 0;
    const m = computeRiskMetrics({
      score: p.scoringRuns[0]?.scoreFinal ?? null,
      cls: (p.classificationRuns[0]?.resultClass ?? null) as RegulatoryClassCode | null,
      ead,
      eligibleGuarantees: p.provisionRuns[0]?.eligibleGuarantees ?? 0,
    }, calib);
    const ecl = computeEcl({ stage: m.stage, pd12m: m.pd, lgd: m.lgd, ead: m.ead, maturityYears: calib.maturityYears });
    slotting[m.slotting].count += 1;
    slotting[m.slotting].ead += m.ead;
    slotting[m.slotting].el += m.expectedLoss;
    stageDist[m.stage] = (stageDist[m.stage] ?? 0) + 1;
    totalExpectedLoss += m.expectedLoss;
    totalRwa += m.rwa;
    totalEad += m.ead;
    totalEcl += ecl.ecl;
    totalProvisionBkam += p.provisionRuns[0]?.provisionAmount ?? 0;
  }

  const bySegment = aggregateConcentration(flat.map((f) => ({ key: f.segment, exposure: f.exposure, provision: f.provision })));
  const byZone = aggregateConcentration(flat.map((f) => ({ key: f.zone, exposure: f.exposure, provision: f.provision })));
  const byPromoter = aggregateConcentration(flat.map((f) => ({ key: f.promoter, exposure: f.exposure, provision: f.provision })));

  const totalExposure = flat.reduce((s, f) => s + f.exposure, 0);
  const topExposures = [...flat].sort((a, b) => b.exposure - a.exposure).slice(0, 10);
  // Indice de concentration (Herfindahl-Hirschman) sur l'exposition par promoteur.
  const hhi = totalExposure > 0
    ? byPromoter.reduce((s, r) => s + Math.pow(r.exposure / totalExposure, 2), 0)
    : 0;

  return {
    classOrder: CLASS_ORDER,
    decisionOrder: DECISION_ORDER,
    heatmap,
    classified,
    total: projects.length,
    totalExposure,
    bySegment,
    byZone,
    byPromoter,
    topExposures,
    hhi,
    slottingOrder: SLOTTING_ORDER,
    slotting,
    stageDist,
    totalExpectedLoss,
    totalRwa,
    totalEad,
    totalEcl,
    totalProvisionBkam,
  };
}

// ---------------------------------------------------------------------
//  File d'attente workflow : dossiers en attente d'une action du rôle.
//  L'état courant = dernière étape workflow (ou DRAFT par défaut).
// ---------------------------------------------------------------------

export interface QueueItem {
  id: string;
  reference: string;
  name: string;
  promoter: string;
  exposure: number;
  since: Date;
  lastActor: string | null;
  actions: string[];
}

export interface QueueGroup {
  state: WorkflowStateName;
  label: string;
  items: QueueItem[];
}

export async function getWorkflowQueue(role: RoleName): Promise<{
  groups: QueueGroup[];
  total: number;
}> {
  const states = actionableStatesFor(role);
  if (states.length === 0) return { groups: [], total: 0 };

  const projects = await prisma.realEstateProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      promoter: true,
      workflowSteps: { orderBy: { createdAt: "desc" }, take: 1, include: { actor: true } },
    },
  });

  const groups = new Map<WorkflowStateName, QueueItem[]>();
  for (const p of projects) {
    const last = p.workflowSteps[0];
    const state = (last?.toState ?? "DRAFT") as WorkflowStateName;
    if (!states.includes(state)) continue;
    const list = groups.get(state) ?? [];
    list.push({
      id: p.id,
      reference: p.reference,
      name: p.name,
      promoter: p.promoter.name,
      exposure: p.loanAmount ?? 0,
      since: last?.createdAt ?? p.createdAt,
      lastActor: last?.actor?.name ?? null,
      actions: roleTransitions(role, state).map((t) => t.label),
    });
    groups.set(state, list);
  }

  const ordered = states
    .filter((s) => groups.has(s))
    .map((s) => ({ state: s, label: WORKFLOW_LABELS[s], items: groups.get(s)! }));
  const total = ordered.reduce((n, g) => n + g.items.length, 0);
  return { groups: ordered, total };
}

// ---------------------------------------------------------------------
//  Matrice de migration des notes : transitions de classe réglementaire
//  entre runs de classification successifs, par dossier.
// ---------------------------------------------------------------------

export async function getMigrationMatrix(): Promise<{
  matrix: MigrationMatrix;
  projectsTracked: number;
  projectsWithHistory: number;
}> {
  const runs = await prisma.classificationRun.findMany({
    orderBy: [{ projectId: "asc" }, { createdAt: "asc" }],
    select: { projectId: true, resultClass: true, createdAt: true },
  });

  const byProject = new Map<string, string[]>();
  for (const r of runs) {
    const list = byProject.get(r.projectId) ?? [];
    list.push(r.resultClass);
    byProject.set(r.projectId, list);
  }

  const sequences = [...byProject.values()];
  const projectsWithHistory = sequences.filter((s) => s.length >= 2).length;
  const matrix = migrationMatrixFromSequences(sequences);

  return { matrix, projectsTracked: byProject.size, projectsWithHistory };
}

/**
 * Backtesting du PD proxy (diagnostic §9.1) : confronte la PD prédite par le
 * modèle (pdProxy sur le score final) à la fréquence de défaut OBSERVÉE (classe
 * réglementaire en défaut : PRE_DOUTEUX+), par tranche de score. Indicatif sur
 * le portefeuille courant ; significatif avec un historique de défauts réel.
 */
export async function getPdBacktest() {
  const DEFAULT_CLASSES = new Set(["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"]);
  const projects = await prisma.realEstateProject.findMany({
    select: {
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { scoreFinal: true } },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { resultClass: true } },
    },
  });
  const observations = projects
    .map((p) => ({ score: p.scoringRuns[0]?.scoreFinal ?? null, cls: (p.classificationRuns[0]?.resultClass ?? null) as string | null }))
    .filter((o) => typeof o.score === "number")
    .map((o) => ({ scoreFinal: o.score as number, predictedPd: pdProxy(o.score as number), isDefault: o.cls != null && DEFAULT_CLASSES.has(o.cls) }));
  return buildPdBacktest(observations);
}

// ---------------------------------------------------------------------
//  Groupes d'intérêt : membres, exposition consolidée et classe de
//  contagion (la plus sévère du groupe — référence de l'effet groupe).
// ---------------------------------------------------------------------

export interface GroupMember {
  id: string;
  reference: string;
  name: string;
  exposure: number;
  cls: RegulatoryClassCode | null;
  scoreFinal: number | null;
  assetType: AssetTypeCode;
}

export interface GroupView {
  id: string;
  name: string;
  sector: string | null;
  members: GroupMember[];
  exposure: number;
  severeClass: RegulatoryClassCode | undefined;
  consolidation: ProgramConsolidation;
}

export async function getGroups(): Promise<GroupView[]> {
  const groups = await prisma.group.findMany({
    orderBy: { name: "asc" },
    include: {
      projects: {
        orderBy: { reference: "asc" },
        select: {
          id: true,
          reference: true,
          name: true,
          loanAmount: true,
          assetType: true,
          classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { resultClass: true } },
          scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { scoreFinal: true } },
        },
      },
    },
  });

  return groups.map((g) => {
    const members: GroupMember[] = g.projects.map((p) => ({
      id: p.id,
      reference: p.reference,
      name: p.name,
      exposure: p.loanAmount ?? 0,
      cls: (p.classificationRuns[0]?.resultClass ?? null) as RegulatoryClassCode | null,
      scoreFinal: p.scoringRuns[0]?.scoreFinal ?? null,
      assetType: p.assetType as AssetTypeCode,
    }));
    return {
      id: g.id,
      name: g.name,
      sector: g.sector,
      members,
      exposure: members.reduce((s, m) => s + m.exposure, 0),
      severeClass: mostSevereClass(members.map((m) => m.cls)),
      consolidation: consolidateProgram(
        members.map((m) => ({ scoreFinal: m.scoreFinal, exposure: m.exposure, assetType: m.assetType, cls: m.cls })),
      ),
    };
  });
}

// ---------------------------------------------------------------------
//  Stress test léger : applique un choc (baisse préventes / hausse DPD) aux
//  entrées, re-exécute classification + scoring + provisionnement, et compare
//  les pertes attendues (EL/ECL) et provisions base vs scénario stressé.
// ---------------------------------------------------------------------

interface StressLeg {
  cls: RegulatoryClassCode;
  el: number;
  ecl: number;
  provision: number;
  stage: number;
}
export interface StressProjectImpact {
  id: string;
  reference: string;
  name: string;
  baseClass: RegulatoryClassCode;
  stressedClass: RegulatoryClassCode;
  elDelta: number;
  downgraded: boolean;
}
export interface StressLegTotals {
  totalEl: number;
  totalEcl: number;
  totalProvision: number;
  stageDist: Record<number, number>;
}

export async function getStressTest(shock: StressShock) {
  const calib = await getActiveCalibration();
  const projects = await prisma.realEstateProject.findMany({
    include: {
      inputs: true,
      facilities: { select: { authorizedAmount: true, drawnAmount: true, ccf: true } },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { ead: true, eligibleGuarantees: true } },
    },
  });

  const evaluate = (p: (typeof projects)[number], inputs: ProjectInputs): StressLeg => {
    const restructuring = { restructured: inputs.restructured === "yes" };
    const classification = classify({ regime: REGIME_1W_2025, inputs, restructuring });
    const scoring = runScoring({
      model: p.assetType === "EXPLOITATION" ? EXPLOITATION_SCORING_MODEL : PROMOTION_SCORING_MODEL,
      inputs,
      segment: p.segment,
      zone: p.zone,
      regulatoryClass: classification.resultClass,
      classBlocksGo: classification.blocksGo,
    });
    const ead = p.provisionRuns[0]?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead;
    const eligible = p.provisionRuns[0]?.eligibleGuarantees ?? 0;
    const rate = REGIME_1W_PROVISION_RATES[classification.resultClass] ?? 0;
    const provision = computeProvision({
      ead, reservedAgios: 0, eligibleGuarantees: eligible, classCode: classification.resultClass, rate,
    });
    const m = computeRiskMetrics({ score: scoring.scoreFinal ?? null, cls: classification.resultClass, ead, eligibleGuarantees: eligible }, calib);
    const ecl = computeEcl({ stage: m.stage, pd12m: m.pd, lgd: m.lgd, ead: m.ead, maturityYears: calib.maturityYears });
    return { cls: classification.resultClass, el: m.expectedLoss, ecl: ecl.ecl, provision: provision.provisionAmount, stage: m.stage };
  };

  const emptyTotals = (): StressLegTotals => ({ totalEl: 0, totalEcl: 0, totalProvision: 0, stageDist: { 1: 0, 2: 0, 3: 0 } });
  const base = emptyTotals();
  const stressed = emptyTotals();
  const impacts: StressProjectImpact[] = [];
  let downgrades = 0;
  let newDefaults = 0;

  for (const p of projects) {
    const inputs: ProjectInputs = {};
    for (const i of p.inputs) inputs[i.key] = i.valueNum ?? i.valueStr ?? i.valueBool ?? null;

    const b = evaluate(p, inputs);
    const s = evaluate(p, applyStress(inputs, shock));

    for (const leg of [[b, base], [s, stressed]] as const) {
      const [r, agg] = leg;
      agg.totalEl += r.el;
      agg.totalEcl += r.ecl;
      agg.totalProvision += r.provision;
      agg.stageDist[r.stage] = (agg.stageDist[r.stage] ?? 0) + 1;
    }

    const downgraded = classSeverity(s.cls) > classSeverity(b.cls);
    if (downgraded) downgrades += 1;
    if (b.stage < 3 && s.stage === 3) newDefaults += 1;
    impacts.push({ id: p.id, reference: p.reference, name: p.name, baseClass: b.cls, stressedClass: s.cls, elDelta: Math.round((s.el - b.el) * 100) / 100, downgraded });
  }

  impacts.sort((a, b) => b.elDelta - a.elDelta);
  return { shock, base, stressed, downgrades, newDefaults, total: projects.length, impacts: impacts.slice(0, 10) };
}

/**
 * Batterie de stress (diagnostic §9.1) : exécute chaque scénario standard sur
 * tout le portefeuille et renvoie, par scénario, l'impact agrégé (pertes,
 * provisions, dégradations, nouveaux défauts). La base est identique d'un
 * scénario à l'autre (mêmes entrées) : renvoyée une fois séparément.
 */
export async function getStressBattery() {
  const runs = await Promise.all(STRESS_SCENARIOS.map((sc) => getStressTest(sc.shock)));
  const base = runs[0]?.base ?? { totalEl: 0, totalEcl: 0, totalProvision: 0, stageDist: { 1: 0, 2: 0, 3: 0 } };
  const total = runs[0]?.total ?? 0;
  const scenarios = STRESS_SCENARIOS.map((sc, i) => {
    const r = runs[i]!;
    return {
      key: sc.key, label: sc.label,
      downgrades: r.downgrades, newDefaults: r.newDefaults,
      totalEl: r.stressed.totalEl, totalProvision: r.stressed.totalProvision,
      elDelta: Math.round((r.stressed.totalEl - base.totalEl) * 100) / 100,
      provDelta: Math.round((r.stressed.totalProvision - base.totalProvision) * 100) / 100,
      stage3: r.stressed.stageDist[3] ?? 0,
    };
  });
  return { base, total, scenarios };
}

export async function getAuditLog(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });
}

export async function getActiveModel() {
  return prisma.scoringModelVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      model: true,
      domains: { orderBy: { orderIndex: "asc" }, include: { criteria: { orderBy: { orderIndex: "asc" }, include: { options: true, ranges: true } } } },
      redFlags: true,
    },
  });
}

/** Brouillon éditable du modèle (status DRAFT), arbre complet, ou null. */
export async function getModelDraft(modelCode = "PI_PROMOTION") {
  return prisma.scoringModelVersion.findFirst({
    where: { status: "DRAFT", model: { code: modelCode } },
    orderBy: { createdAt: "desc" },
    include: {
      model: true,
      domains: { orderBy: { orderIndex: "asc" }, include: { criteria: { orderBy: { orderIndex: "asc" }, include: { options: { orderBy: { orderIndex: "asc" } }, ranges: { orderBy: { orderIndex: "asc" } } } } } },
      redFlags: { orderBy: { code: "asc" } },
    },
  });
}

/** Historique des lots d'import (les plus récents d'abord). */
export async function getImportBatches(limit = 20) {
  return prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { importedBy: { select: { name: true } } },
  });
}

export async function getRegimes() {
  return prisma.regulatoryRegime.findMany({
    orderBy: { effectiveFrom: "desc" },
    include: {
      classes: { orderBy: { orderIndex: "asc" }, include: { provisionRates: true } },
      triggers: true,
      guaranteeTypes: true,
    },
  });
}

export async function getDemoActor() {
  // En l'absence d'auth branchée, on retient l'analyste comme acteur par défaut.
  return prisma.user.findFirst({ where: { role: { name: "RISK_ANALYST" } } });
}
