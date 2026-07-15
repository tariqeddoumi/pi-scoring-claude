"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { gfaVefaSchema, riskCalibrationSchema, visitReportSchema, projectUpsertSchema, bpRevisionSchema } from "@/lib/validation";
import { redirect } from "next/navigation";
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

/**
 * Crée ou met à jour un projet de promotion depuis le formulaire à listes
 * déroulantes. Réservé à project.write, journalisé. Sur création, redirige vers
 * la fiche du projet ; sur édition, revalide les écrans concernés.
 */
export async function upsertProject(raw: Record<string, unknown>) {
  const parsed = projectUpsertSchema.safeParse(raw);
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

  const toDate = (v?: string) => {
    if (!v?.trim()) return null;
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const data = {
    reference: d.reference.trim(),
    name: d.name.trim(),
    promoterId: d.promoterId,
    rmId: d.rmId || null,
    assetType: d.assetType,
    city: d.city?.trim() || null,
    region: d.region?.trim() || null,
    projectType: d.projectType || null,
    segment: d.segment || null,
    zone: d.zone || null,
    status: d.status || "PROSPECT",
    saleMode: d.saleMode,
    totalUnits: d.totalUnits ?? null,
    totalCost: d.totalCost ?? null,
    loanAmount: d.loanAmount ?? null,
    ownEquity: d.ownEquity ?? null,
    // Saisie complète (V2.1)
    groupId: d.groupId || null,
    address: d.address?.trim() || null,
    landAreaSqm: d.landAreaSqm ?? null,
    builtAreaSqm: d.builtAreaSqm ?? null,
    landTitleRef: d.landTitleRef?.trim() || null,
    landStatus: d.landStatus || null,
    buildPermitRef: d.buildPermitRef?.trim() || null,
    buildPermitDate: toDate(d.buildPermitDate),
    startDate: toDate(d.startDate),
    expectedDeliveryDate: toDate(d.expectedDeliveryDate),
    description: d.description?.trim() || null,
  };

  let projectId = d.id;
  try {
    if (d.id) {
      await prisma.$transaction(async (tx) => {
        await tx.realEstateProject.update({ where: { id: d.id }, data });
        await recordAudit({ actorId: actor.id, action: "UPDATE", entity: "RealEstateProject", entityId: d.id!, after: data }, tx);
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const created = await tx.realEstateProject.create({ data });
        projectId = created.id;
        await recordAudit({ actorId: actor.id, action: "CREATE", entity: "RealEstateProject", entityId: created.id, after: data }, tx);
      });
    }
  } catch (e) {
    // Conflit de référence unique le plus souvent.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false as const, error: "Cette référence de projet existe déjà." };
    }
    throw e;
  }

  revalidatePath("/projects");
  if (d.id) revalidatePath(`/projects/${d.id}`);
  redirect(`/projects/${projectId}`);
}

/**
 * Révise le business plan d'un projet (changement de standing, de prix cible
 * ou de calendrier sur un ou plusieurs lots). Bonne pratique : le BP d'origine
 * (v0) est figé sur chaque lot la première fois qu'il est touché (champs
 * original*), la baseline courante est mise à jour, et la révision est tracée
 * comme un événement de gouvernance (version, motif, auteur, détail). Réservé à
 * project.write, journalisé.
 */
export async function reviseBusinessPlan(raw: Record<string, unknown>) {
  const parsed = bpRevisionSchema.safeParse(raw);
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

  const unitIds = d.changes.map((c) => c.unitId);
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds }, tranche: { projectId: d.projectId } },
    select: {
      id: true, reference: true,
      plannedStanding: true, plannedPrice: true, plannedSaleDate: true,
      originalStanding: true, originalPrice: true, originalSaleDate: true,
    },
  });
  const byId = new Map(units.map((u) => [u.id, u]));
  if (units.length !== new Set(unitIds).size) {
    return { ok: false as const, error: "Certains lots sont introuvables pour ce projet." };
  }

  const changeLog: { reference: string; field: string; before: string; after: string }[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      const last = await tx.businessPlanRevision.findFirst({
        where: { projectId: d.projectId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (last?.version ?? 0) + 1;

      for (const ch of d.changes) {
        const u = byId.get(ch.unitId)!;
        const data: Record<string, unknown> = {};
        // Fige la baseline d'origine (une seule fois par lot).
        if (u.originalStanding == null) data.originalStanding = u.plannedStanding;
        if (u.originalPrice == null) data.originalPrice = u.plannedPrice;
        if (u.originalSaleDate == null) data.originalSaleDate = u.plannedSaleDate;

        if (ch.newStanding && ch.newStanding !== u.plannedStanding) {
          changeLog.push({ reference: u.reference, field: "standing", before: u.plannedStanding, after: ch.newStanding });
          data.plannedStanding = ch.newStanding;
        }
        if (ch.newPrice != null && ch.newPrice !== u.plannedPrice) {
          changeLog.push({ reference: u.reference, field: "price", before: String(u.plannedPrice ?? ""), after: String(ch.newPrice) });
          data.plannedPrice = ch.newPrice;
        }
        if (ch.newSaleDate) {
          const nd = new Date(ch.newSaleDate);
          if (!isNaN(nd.getTime()) && nd.getTime() !== u.plannedSaleDate?.getTime()) {
            changeLog.push({ reference: u.reference, field: "saleDate", before: u.plannedSaleDate?.toISOString().slice(0, 10) ?? "", after: ch.newSaleDate });
            data.plannedSaleDate = nd;
          }
        }
        if (Object.keys(data).length > 0) {
          await tx.unit.update({ where: { id: u.id }, data });
        }
      }

      if (changeLog.length === 0) throw new Error("NO_CHANGE");

      const created = await tx.businessPlanRevision.create({
        data: {
          projectId: d.projectId,
          version,
          reason: d.reason.trim(),
          status: "APPROVED",
          requestedByEmail: actor.email,
          requestedByName: actor.name,
          changes: changeLog as unknown as Prisma.InputJsonValue,
        },
      });
      await recordAudit(
        { actorId: actor.id, action: "UPDATE", entity: "BusinessPlanRevision", entityId: created.id, after: { version, reason: d.reason, changes: changeLog }, metadata: { projectId: d.projectId } },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_CHANGE") {
      return { ok: false as const, error: "Aucun changement effectif (valeurs identiques aux valeurs courantes)." };
    }
    throw e;
  }

  revalidatePath(`/projects/${d.projectId}/suivi`);
  return { ok: true as const, applied: changeLog.length };
}
