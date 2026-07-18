"use server";

// Actions serveur — lecture IA des documents du dossier pour pré-remplir la
// saisie de scoring. Deux temps distincts, tous deux réservés à project.write :
//  1. analyzeDossierDocuments : lecture SEULE (aucune écriture) → candidats ;
//  2. applyDossierExtraction : écrit les valeurs retenues — par défaut
//     uniquement les champs encore VIDES ; le remplacement d'une valeur déjà
//     saisie doit être demandé explicitement (overwriteKeys). Audité.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { PERMISSIONS } from "@/lib/rbac";
import { WIZARD_STEPS, EXPLOITATION_WIZARD_STEPS, type FieldDef } from "@/lib/wizardFields";
import { extractDossierFields } from "@/server/services/claudeDossierExtractor";
import type { ReportDocument } from "@/lib/domain/visitReportExtraction";

async function fieldsFor(projectId: string): Promise<FieldDef[] | null> {
  const p = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: { assetType: true },
  });
  if (!p) return null;
  const steps = p.assetType === "EXPLOITATION" ? EXPLOITATION_WIZARD_STEPS : WIZARD_STEPS;
  return steps.flatMap((s) => s.fields);
}

/** Analyse les documents (texte / images / PDF) — renvoie des CANDIDATS, sans écrire. */
export async function analyzeDossierDocuments(
  projectId: string,
  input: { rawText?: string; documents?: ReportDocument[] },
) {
  try {
    await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const fields = await fieldsFor(projectId);
  if (!fields) return { ok: false as const, error: "Projet introuvable." };

  const docs = (input.documents ?? []).slice(0, 5);
  if (!input.rawText?.trim() && docs.length === 0) {
    return { ok: false as const, error: "Fournissez au moins un document ou un texte à analyser." };
  }

  try {
    const res = await extractDossierFields({ fields, rawText: input.rawText, documents: docs });
    // Valeurs déjà saisies (pour l'écran de revue : compléter vs remplacer).
    const existing = await prisma.projectInput.findMany({
      where: { projectId, key: { in: res.readKeys } },
      select: { key: true, valueNum: true, valueStr: true, valueBool: true },
    });
    const filledKeys = existing
      .filter((i) => i.valueNum !== null || (i.valueStr !== null && i.valueStr !== "") || i.valueBool !== null)
      .map((i) => i.key);
    return { ok: true as const, values: res.values, readKeys: res.readKeys, unreadKeys: res.unreadKeys, filledKeys };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Analyse impossible." };
  }
}

/**
 * Applique les valeurs retenues de l'analyse : champs vides toujours ;
 * champs déjà saisis uniquement si listés dans overwriteKeys.
 */
export async function applyDossierExtraction(
  projectId: string,
  values: Record<string, unknown>,
  overwriteKeys: string[] = [],
) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const fields = await fieldsFor(projectId);
  if (!fields) return { ok: false as const, error: "Projet introuvable." };
  const byKey = new Map(fields.map((f) => [f.key, f]));

  // Revalidation serveur : uniquement des clés du wizard, au bon type.
  const clean: Record<string, number | boolean | string> = {};
  for (const [key, v] of Object.entries(values)) {
    const f = byKey.get(key);
    if (!f || v === null || v === undefined) continue;
    if (f.type === "number" && typeof v === "number" && isFinite(v)) clean[key] = v;
    else if (f.type === "bool" && typeof v === "boolean") clean[key] = v;
    else if (f.type === "select" && typeof v === "string" && (f.options ?? []).some((o) => o.value === v)) clean[key] = v;
  }
  if (Object.keys(clean).length === 0) {
    return { ok: false as const, error: "Aucune valeur valide à appliquer." };
  }

  const existing = await prisma.projectInput.findMany({
    where: { projectId, key: { in: Object.keys(clean) } },
    select: { key: true, valueNum: true, valueStr: true, valueBool: true },
  });
  const filled = new Set(
    existing
      .filter((i) => i.valueNum !== null || (i.valueStr !== null && i.valueStr !== "") || i.valueBool !== null)
      .map((i) => i.key),
  );

  const applied: string[] = [];
  const skipped: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(clean)) {
      if (filled.has(key) && !overwriteKeys.includes(key)) {
        skipped.push(key); // déjà saisi, remplacement non demandé
        continue;
      }
      const data = {
        valueNum: typeof value === "number" ? value : null,
        valueStr: typeof value === "string" ? value : null,
        valueBool: typeof value === "boolean" ? value : null,
      };
      await tx.projectInput.upsert({
        where: { projectId_key: { projectId, key } },
        create: { projectId, key, ...data },
        update: data,
      });
      applied.push(key);
    }
    if (applied.length > 0) {
      await recordAudit(
        {
          actorId: actor.id,
          action: "UPDATE",
          entity: "ProjectInput",
          entityId: projectId,
          after: Object.fromEntries(applied.map((k) => [k, clean[k]])),
          metadata: { source: "ai_document_extraction", overwritten: overwriteKeys.filter((k) => applied.includes(k)) },
        },
        tx,
      );
    }
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  return { ok: true as const, applied: applied.length, skipped: skipped.length };
}
