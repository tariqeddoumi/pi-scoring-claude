"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { PERMISSIONS } from "@/lib/rbac";
import { validateModelForPublish, hasBlockingIssues, type ModelLite } from "@/lib/domain/modelValidation";

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };

async function requireModelWrite(): Promise<{ actor: Awaited<ReturnType<typeof authorize>> } | Err> {
  try {
    const actor = await authorize(PERMISSIONS.MODEL_WRITE);
    return { actor };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
}

function revalidate() {
  revalidatePath("/admin/model");
  revalidatePath("/admin/model/draft");
}

/** Vérifie que la version est un BROUILLON éditable. */
async function assertDraft(versionId: string): Promise<true | Err> {
  const v = await prisma.scoringModelVersion.findUnique({ where: { id: versionId }, select: { status: true } });
  if (!v) return { ok: false as const, error: "Version introuvable." };
  if (v.status !== "DRAFT") return { ok: false as const, error: "Seul un brouillon est éditable. Créez un brouillon depuis la version publiée." };
  return true;
}

const dup = (e: unknown): e is Prisma.PrismaClientKnownRequestError =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// ---------------------------------------------------------------------
//  Cycle de vie du brouillon
// ---------------------------------------------------------------------

/** Crée (ou réutilise) un brouillon éditable cloné de la version publiée. */
export async function createModelDraft(modelCode = "PI_PROMOTION"): Promise<Ok<{ versionId: string; reused: boolean }> | Err> {
  const auth = await requireModelWrite();
  if ("ok" in auth) return auth;

  const model = await prisma.scoringModel.findUnique({ where: { code: modelCode }, select: { id: true } });
  if (!model) return { ok: false as const, error: `Modèle ${modelCode} introuvable.` };

  const existing = await prisma.scoringModelVersion.findFirst({ where: { modelId: model.id, status: "DRAFT" }, select: { id: true } });
  if (existing) return { ok: true as const, versionId: existing.id, reused: true };

  const active = await prisma.scoringModelVersion.findFirst({
    where: { modelId: model.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: { domains: { include: { criteria: { include: { options: true, ranges: true } } } }, redFlags: true },
  });
  if (!active) return { ok: false as const, error: "Aucune version publiée à cloner." };

  const label = `Brouillon ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  let draftId = "";
  await prisma.$transaction(async (tx) => {
    const draft = await tx.scoringModelVersion.create({
      data: {
        modelId: model.id, version: label, status: "DRAFT",
        bamCoefficients: (active.bamCoefficients ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        decisionThresholds: (active.decisionThresholds ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        segmentAdjustments: (active.segmentAdjustments ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        zoneAdjustments: (active.zoneAdjustments ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        scoreScale: active.scoreScale,
      },
    });
    draftId = draft.id;
    for (const d of active.domains) {
      const nd = await tx.scoringDomain.create({ data: { versionId: draft.id, code: d.code, name: d.name, weight: d.weight, orderIndex: d.orderIndex } });
      for (const c of d.criteria) {
        const nc = await tx.scoringCriterion.create({
          data: { domainId: nd.id, code: c.code, name: c.name, description: c.description, type: c.type, weight: c.weight, inputKey: c.inputKey, isGate: c.isGate, gateThreshold: c.gateThreshold, orderIndex: c.orderIndex },
        });
        if (c.options.length) await tx.scoringOption.createMany({ data: c.options.map((o) => ({ criterionId: nc.id, value: o.value, label: o.label, score: o.score, orderIndex: o.orderIndex })) });
        if (c.ranges.length) await tx.scoringRange.createMany({ data: c.ranges.map((r) => ({ criterionId: nc.id, minIncl: r.minIncl, maxExcl: r.maxExcl, score: r.score, label: r.label, orderIndex: r.orderIndex })) });
      }
    }
    for (const rf of active.redFlags) {
      await tx.redFlagRule.create({ data: { versionId: draft.id, code: rf.code, name: rf.name, description: rf.description, rule: rf.rule as Prisma.InputJsonValue, severity: rf.severity, impactDomains: rf.impactDomains, malus: rf.malus, mitigable: rf.mitigable, mitigantHint: rf.mitigantHint } });
    }
    await recordAudit({ actorId: auth.actor.id, action: "CREATE", entity: "ScoringModelVersion", entityId: draft.id, after: { clonedFrom: active.id, label } }, tx);
  });

  revalidate();
  return { ok: true as const, versionId: draftId, reused: false };
}

/** Supprime un brouillon (cascade sur ses domaines/critères/red flags). */
export async function discardModelDraft(versionId: string): Promise<Ok | Err> {
  const auth = await requireModelWrite();
  if ("ok" in auth) return auth;
  const d = await assertDraft(versionId);
  if (d !== true) return d;
  await prisma.scoringModelVersion.delete({ where: { id: versionId } });
  await recordAudit({ actorId: auth.actor.id, action: "DELETE", entity: "ScoringModelVersion", entityId: versionId });
  revalidate();
  return { ok: true as const };
}

/** Publie le brouillon : validation des poids, puis retire l'ancienne version. */
export async function publishModelDraft(versionId: string): Promise<Ok | (Err & { issues?: string[] })> {
  const auth = await requireModelWrite();
  if ("ok" in auth) return auth;
  const dft = await assertDraft(versionId);
  if (dft !== true) return dft;

  const v = await prisma.scoringModelVersion.findUnique({
    where: { id: versionId },
    include: { domains: { include: { criteria: { include: { options: true, ranges: true } } } } },
  });
  if (!v) return { ok: false as const, error: "Brouillon introuvable." };

  const lite: ModelLite = {
    domains: v.domains.map((d) => ({
      code: d.code, weight: d.weight,
      criteria: d.criteria.map((c) => ({ code: c.code, type: c.type, weight: c.weight, optionsCount: c.options.length, rangesCount: c.ranges.length })),
    })),
  };
  const issues = validateModelForPublish(lite);
  if (hasBlockingIssues(issues)) {
    return { ok: false as const, error: "Publication impossible : corrigez les anomalies.", issues: issues.filter((i) => i.level === "ERROR").map((i) => i.message) };
  }

  const label = `Version du ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
  await prisma.$transaction(async (tx) => {
    await tx.scoringModelVersion.updateMany({ where: { modelId: v.modelId, status: "PUBLISHED" }, data: { status: "RETIRED" } });
    await tx.scoringModelVersion.update({ where: { id: versionId }, data: { status: "PUBLISHED", version: label, publishedAt: new Date() } });
    await recordAudit({ actorId: auth.actor.id, action: "UPDATE", entity: "ScoringModelVersion", entityId: versionId, after: { published: true, label } }, tx);
  });
  revalidate();
  revalidatePath("/");
  return { ok: true as const };
}

// ---------------------------------------------------------------------
//  CRUD domaines
// ---------------------------------------------------------------------

const domainSchema = z.object({
  versionId: z.string().min(1), code: z.string().min(1, "Code requis"),
  name: z.string().min(1, "Nom requis"), weight: z.coerce.number().min(0).max(1),
});

export async function addDomain(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = domainSchema.safeParse(raw); if (!p.success) return { ok: false as const, error: "Champs domaine invalides." };
  const d = await assertDraft(p.data.versionId); if (d !== true) return d;
  const max = await prisma.scoringDomain.aggregate({ where: { versionId: p.data.versionId }, _max: { orderIndex: true } });
  try {
    await prisma.scoringDomain.create({ data: { versionId: p.data.versionId, code: p.data.code.trim(), name: p.data.name.trim(), weight: p.data.weight, orderIndex: (max._max.orderIndex ?? -1) + 1 } });
  } catch (e) { if (dup(e)) return { ok: false as const, error: "Ce code de domaine existe déjà." }; throw e; }
  revalidate(); return { ok: true as const };
}

export async function updateDomain(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = z.object({ id: z.string().min(1), name: z.string().min(1), weight: z.coerce.number().min(0).max(1) }).safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Champs domaine invalides." };
  const dom = await prisma.scoringDomain.findUnique({ where: { id: p.data.id }, select: { versionId: true } });
  if (!dom) return { ok: false as const, error: "Domaine introuvable." };
  const d = await assertDraft(dom.versionId); if (d !== true) return d;
  await prisma.scoringDomain.update({ where: { id: p.data.id }, data: { name: p.data.name.trim(), weight: p.data.weight } });
  revalidate(); return { ok: true as const };
}

export async function deleteDomain(id: string): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const dom = await prisma.scoringDomain.findUnique({ where: { id }, select: { versionId: true } });
  if (!dom) return { ok: false as const, error: "Domaine introuvable." };
  const d = await assertDraft(dom.versionId); if (d !== true) return d;
  await prisma.scoringDomain.delete({ where: { id } });
  revalidate(); return { ok: true as const };
}

// ---------------------------------------------------------------------
//  CRUD critères
// ---------------------------------------------------------------------

const criterionSchema = z.object({
  domainId: z.string().min(1), code: z.string().min(1), name: z.string().min(1),
  type: z.enum(["QUAL", "NUM"]), weight: z.coerce.number().min(0).max(1),
  inputKey: z.string().min(1, "Clé d'entrée requise"),
  isGate: z.coerce.boolean().optional().default(false),
  gateThreshold: z.coerce.number().optional().nullable(),
});

async function criterionVersion(criterionId: string) {
  const c = await prisma.scoringCriterion.findUnique({ where: { id: criterionId }, select: { domain: { select: { versionId: true } } } });
  return c?.domain.versionId ?? null;
}

export async function addCriterion(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = criterionSchema.safeParse(raw); if (!p.success) return { ok: false as const, error: "Champs critère invalides." };
  const dom = await prisma.scoringDomain.findUnique({ where: { id: p.data.domainId }, select: { versionId: true } });
  if (!dom) return { ok: false as const, error: "Domaine introuvable." };
  const d = await assertDraft(dom.versionId); if (d !== true) return d;
  const max = await prisma.scoringCriterion.aggregate({ where: { domainId: p.data.domainId }, _max: { orderIndex: true } });
  try {
    await prisma.scoringCriterion.create({ data: {
      domainId: p.data.domainId, code: p.data.code.trim(), name: p.data.name.trim(), type: p.data.type,
      weight: p.data.weight, inputKey: p.data.inputKey.trim(), isGate: p.data.isGate, gateThreshold: p.data.isGate ? (p.data.gateThreshold ?? 0) : null,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    } });
  } catch (e) { if (dup(e)) return { ok: false as const, error: "Ce code de critère existe déjà dans le domaine." }; throw e; }
  revalidate(); return { ok: true as const };
}

export async function updateCriterion(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = criterionSchema.partial({ domainId: true, code: true }).extend({ id: z.string().min(1) }).safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Champs critère invalides." };
  const versionId = await criterionVersion(p.data.id);
  if (!versionId) return { ok: false as const, error: "Critère introuvable." };
  const d = await assertDraft(versionId); if (d !== true) return d;
  await prisma.scoringCriterion.update({ where: { id: p.data.id }, data: {
    name: p.data.name?.trim(), type: p.data.type, weight: p.data.weight, inputKey: p.data.inputKey?.trim(),
    isGate: p.data.isGate, gateThreshold: p.data.isGate ? (p.data.gateThreshold ?? 0) : null,
  } });
  revalidate(); return { ok: true as const };
}

export async function deleteCriterion(id: string): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const versionId = await criterionVersion(id);
  if (!versionId) return { ok: false as const, error: "Critère introuvable." };
  const d = await assertDraft(versionId); if (d !== true) return d;
  await prisma.scoringCriterion.delete({ where: { id } });
  revalidate(); return { ok: true as const };
}

// ---------------------------------------------------------------------
//  CRUD modalités (options QUAL) & barèmes (ranges NUM)
// ---------------------------------------------------------------------

export async function addOption(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = z.object({ criterionId: z.string().min(1), value: z.string().min(1), label: z.string().min(1), score: z.coerce.number() }).safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Champs modalité invalides." };
  const versionId = await criterionVersion(p.data.criterionId);
  if (!versionId) return { ok: false as const, error: "Critère introuvable." };
  const d = await assertDraft(versionId); if (d !== true) return d;
  const max = await prisma.scoringOption.aggregate({ where: { criterionId: p.data.criterionId }, _max: { orderIndex: true } });
  try {
    await prisma.scoringOption.create({ data: { criterionId: p.data.criterionId, value: p.data.value.trim(), label: p.data.label.trim(), score: p.data.score, orderIndex: (max._max.orderIndex ?? -1) + 1 } });
  } catch (e) { if (dup(e)) return { ok: false as const, error: "Cette valeur de modalité existe déjà." }; throw e; }
  revalidate(); return { ok: true as const };
}

export async function deleteOption(id: string): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const o = await prisma.scoringOption.findUnique({ where: { id }, select: { criterion: { select: { domain: { select: { versionId: true } } } } } });
  if (!o) return { ok: false as const, error: "Modalité introuvable." };
  const d = await assertDraft(o.criterion.domain.versionId); if (d !== true) return d;
  await prisma.scoringOption.delete({ where: { id } });
  revalidate(); return { ok: true as const };
}

export async function addRange(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = z.object({
    criterionId: z.string().min(1),
    minIncl: z.union([z.coerce.number(), z.literal("")]).optional(),
    maxExcl: z.union([z.coerce.number(), z.literal("")]).optional(),
    score: z.coerce.number(), label: z.string().optional(),
  }).safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Champs barème invalides." };
  const versionId = await criterionVersion(p.data.criterionId);
  if (!versionId) return { ok: false as const, error: "Critère introuvable." };
  const d = await assertDraft(versionId); if (d !== true) return d;
  const max = await prisma.scoringRange.aggregate({ where: { criterionId: p.data.criterionId }, _max: { orderIndex: true } });
  await prisma.scoringRange.create({ data: {
    criterionId: p.data.criterionId,
    minIncl: p.data.minIncl === "" || p.data.minIncl === undefined ? null : p.data.minIncl,
    maxExcl: p.data.maxExcl === "" || p.data.maxExcl === undefined ? null : p.data.maxExcl,
    score: p.data.score, label: p.data.label?.trim() || null, orderIndex: (max._max.orderIndex ?? -1) + 1,
  } });
  revalidate(); return { ok: true as const };
}

export async function deleteRange(id: string): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const r = await prisma.scoringRange.findUnique({ where: { id }, select: { criterion: { select: { domain: { select: { versionId: true } } } } } });
  if (!r) return { ok: false as const, error: "Barème introuvable." };
  const d = await assertDraft(r.criterion.domain.versionId); if (d !== true) return d;
  await prisma.scoringRange.delete({ where: { id } });
  revalidate(); return { ok: true as const };
}

// ---------------------------------------------------------------------
//  CRUD red flags (D5)
// ---------------------------------------------------------------------

const redFlagSchema = z.object({
  versionId: z.string().min(1), code: z.string().min(1), name: z.string().min(1),
  ruleKey: z.string().min(1, "Clé de règle requise"),
  ruleOp: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "isTrue", "isFalse"]),
  ruleValue: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "BLOCKING"]),
  malus: z.coerce.number().min(0).max(100),
  impactDomains: z.string().optional(), // CSV ex "D5,D3"
  mitigable: z.coerce.boolean().optional().default(false),
});

function buildRule(key: string, op: string, value?: string) {
  const clause: Record<string, unknown> = { key, op };
  if (!["isTrue", "isFalse"].includes(op)) {
    const num = value !== undefined && value !== "" && !isNaN(Number(value)) ? Number(value) : undefined;
    clause.value = op === "in" ? (value ?? "").split(",").map((s) => s.trim()) : (num ?? value);
  }
  return { clause };
}

export async function addRedFlag(raw: Record<string, unknown>): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const p = redFlagSchema.safeParse(raw); if (!p.success) return { ok: false as const, error: "Champs red flag invalides." };
  const d = await assertDraft(p.data.versionId); if (d !== true) return d;
  try {
    await prisma.redFlagRule.create({ data: {
      versionId: p.data.versionId, code: p.data.code.trim(), name: p.data.name.trim(),
      rule: buildRule(p.data.ruleKey.trim(), p.data.ruleOp, p.data.ruleValue) as Prisma.InputJsonValue,
      severity: p.data.severity, malus: p.data.malus,
      impactDomains: (p.data.impactDomains ?? "D5").split(",").map((s) => s.trim()).filter(Boolean),
      mitigable: p.data.mitigable,
    } });
  } catch (e) { if (dup(e)) return { ok: false as const, error: "Ce code de red flag existe déjà." }; throw e; }
  revalidate(); return { ok: true as const };
}

export async function deleteRedFlag(id: string): Promise<Ok | Err> {
  const auth = await requireModelWrite(); if ("ok" in auth) return auth;
  const rf = await prisma.redFlagRule.findUnique({ where: { id }, select: { versionId: true } });
  if (!rf) return { ok: false as const, error: "Red flag introuvable." };
  const d = await assertDraft(rf.versionId); if (d !== true) return d;
  await prisma.redFlagRule.delete({ where: { id } });
  revalidate(); return { ok: true as const };
}
