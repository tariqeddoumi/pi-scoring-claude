"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { gfaVefaSchema, riskCalibrationSchema, visitReportSchema } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/rbac";
import { extractReportFields, type ExtractedReportFields, type ReportDocument } from "@/lib/domain/visitReportExtraction";
import { claudeReportExtractor } from "@/server/services/claudeReportExtractor";

/**
 * Met à jour le mode de vente (VEFA/classique) et la Garantie Financière
 * d'Achèvement d'un dossier. Réservé à project.write, journalisé. Le nouvel
 * effet sur le provisionnement s'applique au prochain calcul.
 */
export async function updateGfaVefa(projectId: string, raw: Record<string, unknown>) {
  const parsed = gfaVefaSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const data = {
    assetType: d.assetType,
    saleMode: d.saleMode,
    hasGFA: d.hasGFA,
    gfaAmount: d.hasGFA ? (d.gfaAmount ?? null) : null,
    gfaProvider: d.hasGFA ? (d.gfaProvider?.trim() || null) : null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.realEstateProject.update({ where: { id: projectId }, data });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "RealEstateProject", entityId: projectId, after: data, metadata: { field: "gfa_vefa" } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

/**
 * Met à jour le calibrage actif des paramètres de risque (PD par catégorie de
 * slotting, LGD, maturité). Réservé à model.write, journalisé. Affecte les
 * métriques Bâle/IFRS 9 au prochain rendu.
 */
export async function updateRiskCalibration(raw: Record<string, unknown>) {
  const parsed = riskCalibrationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  if (d.lgdFloor > d.lgdUnsecured) {
    return { ok: false as const, error: "Le plancher LGD ne peut excéder la LGD non garantie." };
  }

  let actor;
  try {
    actor = await authorize(PERMISSIONS.MODEL_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    // Versionning : on désactive la version courante et on crée une nouvelle
    // version active (instantané historisé), plutôt qu'une mise à jour en place.
    await tx.riskCalibration.updateMany({ where: { active: true }, data: { active: false } });
    const created = await tx.riskCalibration.create({
      data: { ...d, active: true, updatedByEmail: actor.email },
    });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "RiskCalibration", entityId: created.id, after: d },
      tx,
    );
  });

  revalidatePath("/admin/calibration");
  revalidatePath("/risk");
  return { ok: true as const };
}

/**
 * Enregistre un rapport de visite de chantier. Réservé à project.write,
 * journalisé. Si un texte source (collé / OCR) est fourni, on en extrait des
 * champs candidats stockés dans `extracted` (à valider ultérieurement).
 */
export async function createVisitReport(raw: Record<string, unknown>) {
  const parsed = visitReportSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const rawText = d.rawText?.trim() || null;
  const extracted = rawText
    ? (extractReportFields(rawText) as unknown as Prisma.InputJsonValue)
    : undefined;

  const data = {
    projectId: d.projectId,
    authorId: actor.id,
    visitDate: new Date(d.visitDate),
    inspectorName: d.inspectorName?.trim() || null,
    trancheCode: d.trancheCode?.trim() || null,
    status: d.status,
    observedProgressPct: d.observedProgressPct ?? null,
    workforceCount: d.workforceCount ?? null,
    weatherImpact: d.weatherImpact,
    qualityIssue: d.qualityIssue,
    safetyIssue: d.safetyIssue,
    delayRisk: d.delayRisk,
    summary: d.summary?.trim() || null,
    observations: d.observations?.trim() || null,
    recommendations: d.recommendations?.trim() || null,
    rawText,
    extracted,
  };

  let created;
  await prisma.$transaction(async (tx) => {
    created = await tx.visitReport.create({ data });
    await recordAudit(
      { actorId: actor.id, action: "CREATE", entity: "VisitReport", entityId: created.id, after: { ...data, extracted: undefined }, metadata: { projectId: d.projectId } },
      tx,
    );
  });

  revalidatePath(`/projects/${d.projectId}/suivi`);
  return { ok: true as const };
}

/**
 * Extraction assistée par l'IA (Claude) d'un rapport de visite à partir d'un
 * texte collé et/ou de documents scannés (images, PDF). Réservé à
 * project.write. Renvoie des champs CANDIDATS à valider — aucune écriture en
 * base. Repli automatique sur l'heuristique si la clé API est absente.
 */
export async function extractVisitReportWithAI(input: {
  rawText?: string;
  documents?: ReportDocument[];
}): Promise<{ ok: true; fields: ExtractedReportFields } | { ok: false; error: string }> {
  try {
    await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const docs = (input.documents ?? []).slice(0, 5); // borne raisonnable
  const hasContent = (input.rawText?.trim()?.length ?? 0) > 0 || docs.length > 0;
  if (!hasContent) return { ok: false as const, error: "Fournir un texte ou un document à analyser." };

  const fields = await claudeReportExtractor.extract({ rawText: input.rawText, documents: docs });
  return { ok: true as const, fields };
}
