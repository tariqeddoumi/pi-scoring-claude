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
