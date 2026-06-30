"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authorize, AuthorizationError, currentUserCan } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { PERMISSIONS } from "@/lib/rbac";
import { mapImportRows, type ImportError } from "@/lib/domain/importMapping";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { runFullScoring } from "@/server/services/scoringService";

// Clés d'entrée booléennes (coercition oui/non) — le reste est numérique/texte.
const BOOL_INPUT_KEYS = [
  "funding_gap_persistent", "equity_negative", "commercialization_below_50_1y",
  "construction_delay_over_1y", "project_stopped_over_1y", "finished_2y_no_sales",
  "judicial_recovery", "admin_problems_over_1y", "bp_significant_gap",
  // Déclencheurs réglementaires 1/W + contexte de restructuration (art.5/17-31).
  "seizure_notice", "financials_late_7m", "negative_credit_bureau", "financials_unavailable",
  "restructuring_viable", "second_restructuring_in_observation",
  // Crédit in fine / fiabilité de l'information (art.10-12 / art.5.3).
  "bullet_unpaid", "unreliable_construction_progress_info", "unreliable_commercialization_info",
];

export interface ImportSummary {
  total: number;
  success: number;
  failed: number;
  errors: ImportError[];
  /** Projets scorés automatiquement après import (si demandé). */
  scored?: number;
  /** Projets dont le scoring post-import a échoué (données incomplètes, etc.). */
  scoreFailed?: number;
}

/**
 * Importe un portefeuille depuis un fichier Excel/CSV : parse (SheetJS), mappe
 * les colonnes (réf./nom/promoteur/localisation/montants + KPI = inputKey),
 * upsert promoteurs/projets/entrées, et journalise un ImportBatch avec le
 * rapport d'erreurs. Réservé à import.run. Import partiel toléré (ligne par
 * ligne) ; les lignes en erreur n'interrompent pas les autres.
 */
export async function runImport(formData: FormData): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: string }> {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.IMPORT_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Aucun fichier fourni." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false as const, error: "Fichier trop volumineux (max 8 Mo)." };
  }

  let rawRows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) return { ok: false as const, error: "Le fichier ne contient aucune feuille." };
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } catch {
    return { ok: false as const, error: "Fichier illisible (format Excel/CSV attendu)." };
  }

  if (rawRows.length === 0) return { ok: false as const, error: "Le fichier ne contient aucune ligne de données." };

  const { rows, errors } = mapImportRows(rawRows, Object.keys(INPUT_LABELS), BOOL_INPUT_KEYS);

  // Demande optionnelle de scoring automatique après import (case à cocher).
  const autoScore = formData.get("autoScore") === "1";

  let success = 0;
  // Projets importés éligibles au scoring post-import (promotion uniquement).
  const importedForScoring: { id: string; rowIndex: number; reference: string }[] = [];
  for (const row of rows) {
    try {
      const project = await prisma.$transaction(async (tx) => {
        let promoter = await tx.promoter.findFirst({ where: { name: { equals: row.promoterName, mode: "insensitive" } }, select: { id: true } });
        if (!promoter) promoter = await tx.promoter.create({ data: { name: row.promoterName }, select: { id: true } });

        const data = {
          name: row.name, promoterId: promoter.id,
          city: row.city, region: row.region, projectType: row.projectType,
          segment: row.segment, zone: row.zone,
          loanAmount: row.loanAmount, totalCost: row.totalCost, ownEquity: row.ownEquity,
        };
        const proj = await tx.realEstateProject.upsert({
          where: { reference: row.reference },
          update: data,
          create: { reference: row.reference, ...data },
          select: { id: true, assetType: true },
        });

        for (const [key, value] of Object.entries(row.inputs)) {
          const v = {
            valueNum: typeof value === "number" ? value : null,
            valueStr: typeof value === "string" ? value : null,
            valueBool: typeof value === "boolean" ? value : null,
          };
          await tx.projectInput.upsert({
            where: { projectId_key: { projectId: proj.id, key } },
            create: { projectId: proj.id, key, ...v },
            update: v,
          });
        }
        return proj;
      });
      success += 1;
      if (project.assetType !== "EXPLOITATION") {
        importedForScoring.push({ id: project.id, rowIndex: row.rowIndex, reference: row.reference });
      }
    } catch (e) {
      const msg = e instanceof Prisma.PrismaClientKnownRequestError ? `Erreur base (${e.code}).` : "Erreur d'enregistrement.";
      errors.push({ rowIndex: row.rowIndex, message: `${row.reference} : ${msg}` });
    }
  }

  const total = rawRows.length;
  const failed = errors.length;
  const status = failed === 0 && success > 0 ? "COMPLETED" : success === 0 ? "FAILED" : "PARTIAL";

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        fileName: file.name, entity: "RealEstateProject", status,
        totalRows: total, successRows: success, errorRows: failed,
        errors: errors.length ? (errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        importedById: actor.id,
      },
    });
    await recordAudit({ actorId: actor.id, action: "IMPORT", entity: "ImportBatch", entityId: batch.id, after: { fileName: file.name, total, success, failed, status } }, tx);
  });

  // Scoring automatique post-import (étape découplée et optionnelle) : lance le
  // pipeline complet pour chaque projet de promotion importé, sous réserve du
  // droit scoring.run. Chaque run est isolé : un échec (données incomplètes,
  // gate bloquant interne) n'affecte ni les autres ni le succès de l'import.
  let scored: number | undefined;
  let scoreFailed: number | undefined;
  if (autoScore && importedForScoring.length > 0 && (await currentUserCan(PERMISSIONS.SCORING_RUN))) {
    scored = 0;
    scoreFailed = 0;
    for (const p of importedForScoring) {
      try {
        await runFullScoring({ projectId: p.id, actorId: actor.id });
        scored += 1;
      } catch {
        scoreFailed += 1;
        errors.push({ rowIndex: p.rowIndex, message: `${p.reference} : scoring non lancé (données incomplètes).` });
      }
    }
    revalidatePath("/");
  }

  revalidatePath("/imports");
  revalidatePath("/projects");
  // `failed` = échecs d'import (hors scoring) ; les notes de scoring restent
  // visibles dans `errors` et comptabilisées par `scoreFailed`.
  return { ok: true as const, summary: { total, success, failed, errors, scored, scoreFailed } };
}
