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
import { computeRiskMetrics, type SlottingCategory } from "@/lib/domain/riskMetrics";
import type { RegulatoryClassCode } from "@/lib/domain/types";

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
    },
  });
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

  for (const p of projects) {
    const ead = p.provisionRuns[0]?.ead ?? p.loanAmount ?? 0;
    const m = computeRiskMetrics({
      score: p.scoringRuns[0]?.scoreFinal ?? null,
      cls: (p.classificationRuns[0]?.resultClass ?? null) as RegulatoryClassCode | null,
      ead,
      eligibleGuarantees: p.provisionRuns[0]?.eligibleGuarantees ?? 0,
    });
    slotting[m.slotting].count += 1;
    slotting[m.slotting].ead += m.ead;
    slotting[m.slotting].el += m.expectedLoss;
    stageDist[m.stage] = (stageDist[m.stage] ?? 0) + 1;
    totalExpectedLoss += m.expectedLoss;
    totalRwa += m.rwa;
    totalEad += m.ead;
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
