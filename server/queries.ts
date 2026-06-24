// =====================================================================
//  Lectures (read models) pour l'UI. Server-only.
// =====================================================================

import { prisma } from "@/lib/prisma";

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
  };
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
