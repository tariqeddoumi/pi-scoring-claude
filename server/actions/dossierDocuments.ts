"use server";

// Actions serveur — pièces du dossier (écran « Documents »).
//  1. readDossierPiece : lecture IA d'une pièce (ou d'une partie) — aucune écriture ;
//  2. recordDossierPiece : la pièce est enregistrée comme reçue (type, résumé,
//     valeurs lues avec page et citation) ; le fichier n'est pas conservé ;
//  3. applyDocumentValues : valeurs retenues par l'analyste → saisie de scoring,
//     fiche projet et chaîne d'autorisations. Par défaut uniquement les champs
//     vides ; remplacer une valeur saisie doit être demandé. Journalisé.
//  4. gestion de la liste : pièce reçue sans fichier, sans objet, changement de
//     type, suppression.
// Toutes exigent project.write.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { recordAudit } from "@/server/engines/auditService";
import { WIZARD_STEPS, EXPLOITATION_WIZARD_STEPS, type FieldDef } from "@/lib/wizardFields";
import { DOSSIER_DOC_DEFS, OTHER_DOC, classifyByFileName, type ExtractedField } from "@/lib/domain/dossierDocuments";
import { AUTHORIZATION_CHAIN } from "@/lib/domain/morocco";
import {
  PROJECT_FIELDS, PROJECT_FIELD_KEYS, coerceValue, isDocumentAiConfigured, readDossierDocument, type DocumentPart,
} from "@/server/services/claudeDocumentReader";

type Fail = { ok: false; error: string };

async function guard(): Promise<{ id: string } | Fail> {
  try {
    return await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    throw e;
  }
}
const failed = (a: { id: string } | Fail): a is Fail => "ok" in a;

async function fieldsFor(projectId: string): Promise<FieldDef[] | null> {
  const p = await prisma.realEstateProject.findUnique({ where: { id: projectId }, select: { assetType: true } });
  if (!p) return null;
  return (p.assetType === "EXPLOITATION" ? EXPLOITATION_WIZARD_STEPS : WIZARD_STEPS).flatMap((s) => s.fields);
}

const validDocType = (t: string) => t === OTHER_DOC || DOSSIER_DOC_DEFS.has(t);
const MAX_PART_CHARS = 6_000_000; // ~4,5 Mo de base64 : limite des fonctions serverless

/** Lit le contenu d'une pièce. Sans clé IA : type deviné d'après le nom du fichier. */
export async function readDossierPiece(projectId: string, input: { fileName: string; partLabel?: string; part: DocumentPart }) {
  const actor = await guard();
  if (failed(actor)) return actor;
  const fields = await fieldsFor(projectId);
  if (!fields) return { ok: false as const, error: "Projet introuvable." };
  if (!isDocumentAiConfigured()) {
    return { ok: false as const, notConfigured: true as const, docType: classifyByFileName(input.fileName),
      error: "Lecture du contenu indisponible (clé IA non configurée) : pièce classée d'après son nom." };
  }
  const size = input.part.kind === "text" ? input.part.text.length : input.part.base64.length;
  if (size > MAX_PART_CHARS) return { ok: false as const, error: "Partie trop volumineuse." };
  try {
    const reading = await readDossierDocument({ fileName: input.fileName.slice(0, 200), partLabel: input.partLabel, part: input.part, fields });
    return { ok: true as const, reading };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Lecture impossible." };
  }
}

/** Enregistre une pièce reçue (après lecture, ou classée d'après son nom). */
export async function recordDossierPiece(projectId: string, input: {
  docType: string; fileName: string; source: "ia" | "nom" | "manuel";
  title?: string | null; issuer?: string | null; documentDate?: string | null; summary?: string | null;
  attention?: string[]; extracted?: ExtractedField[];
}) {
  const actor = await guard();
  if (failed(actor)) return actor;
  if (!validDocType(input.docType)) return { ok: false as const, error: "Type de pièce inconnu." };
  const exists = await prisma.realEstateProject.count({ where: { id: projectId } });
  if (!exists) return { ok: false as const, error: "Projet introuvable." };
  const piece = await prisma.$transaction(async (tx) => {
    // Une pièce reçue remplace un éventuel « sans objet » du même type.
    await tx.dossierPiece.deleteMany({ where: { projectId, docType: input.docType, status: "NON_APPLICABLE" } });
    const created = await tx.dossierPiece.create({
      data: {
        projectId, docType: input.docType, status: "RECU", source: input.source,
        fileName: input.fileName.slice(0, 200), title: input.title?.slice(0, 300) ?? null,
        issuer: input.issuer?.slice(0, 200) ?? null, documentDate: input.documentDate?.slice(0, 20) ?? null,
        summary: input.summary?.slice(0, 2000) ?? null,
        attention: (input.attention ?? []).slice(0, 12) as Prisma.InputJsonValue,
        extracted: (input.extracted ?? []).slice(0, 200) as unknown as Prisma.InputJsonValue,
        createdById: actor.id,
      },
    });
    await recordAudit({ actorId: actor.id, action: "CREATE", entity: "DossierPiece", entityId: created.id,
      after: { docType: input.docType, fileName: input.fileName, source: input.source, values: input.extracted?.length ?? 0 },
      metadata: { projectId } }, tx);
    return created;
  });
  revalidatePath(`/projects/${projectId}/documents`);
  return { ok: true as const, id: piece.id };
}

/** Pièce reçue sans fichier, ou sans objet pour ce dossier (on = false : annule). */
export async function setPieceStatus(projectId: string, docType: string, status: "RECU" | "NON_APPLICABLE", on: boolean) {
  const actor = await guard();
  if (failed(actor)) return actor;
  if (!DOSSIER_DOC_DEFS.has(docType)) return { ok: false as const, error: "Type de pièce inconnu." };
  await prisma.$transaction(async (tx) => {
    if (on) {
      await tx.dossierPiece.create({ data: { projectId, docType, status, source: "manuel", createdById: actor.id } });
    } else {
      await tx.dossierPiece.deleteMany({ where: { projectId, docType, status, source: "manuel" } });
    }
    await recordAudit({ actorId: actor.id, action: on ? "CREATE" : "DELETE", entity: "DossierPiece", entityId: projectId,
      after: { docType, status, on }, metadata: { projectId } }, tx);
  });
  revalidatePath(`/projects/${projectId}/documents`);
  return { ok: true as const };
}

export async function changePieceType(pieceId: string, docType: string) {
  const actor = await guard();
  if (failed(actor)) return actor;
  if (!validDocType(docType)) return { ok: false as const, error: "Type de pièce inconnu." };
  const p = await prisma.dossierPiece.findUnique({ where: { id: pieceId }, select: { projectId: true, docType: true } });
  if (!p) return { ok: false as const, error: "Pièce introuvable." };
  await prisma.$transaction(async (tx) => {
    await tx.dossierPiece.update({ where: { id: pieceId }, data: { docType } });
    await recordAudit({ actorId: actor.id, action: "UPDATE", entity: "DossierPiece", entityId: pieceId,
      before: { docType: p.docType }, after: { docType }, metadata: { projectId: p.projectId } }, tx);
  });
  revalidatePath(`/projects/${p.projectId}/documents`);
  return { ok: true as const };
}

export async function deleteDossierPiece(pieceId: string) {
  const actor = await guard();
  if (failed(actor)) return actor;
  const p = await prisma.dossierPiece.findUnique({ where: { id: pieceId }, select: { projectId: true, docType: true, fileName: true } });
  if (!p) return { ok: false as const, error: "Pièce introuvable." };
  await prisma.$transaction(async (tx) => {
    await tx.dossierPiece.delete({ where: { id: pieceId } });
    await recordAudit({ actorId: actor.id, action: "DELETE", entity: "DossierPiece", entityId: pieceId,
      before: { docType: p.docType, fileName: p.fileName }, metadata: { projectId: p.projectId } }, tx);
  });
  revalidatePath(`/projects/${p.projectId}/documents`);
  return { ok: true as const };
}

const filledInput = (i: { valueNum: number | null; valueStr: string | null; valueBool: boolean | null }) =>
  i.valueNum !== null || (i.valueStr !== null && i.valueStr !== "") || i.valueBool !== null;

/**
 * Reporte les valeurs retenues : saisie de scoring (ProjectInput), fiche projet
 * (champs vides seulement, sauf remplacement demandé) et autorisations obtenues.
 */
export async function applyDocumentValues(projectId: string, input: {
  values: { key: string; value: number | boolean | string }[];
  overwriteKeys?: string[];
  authorizations?: { code: string; obtainedAt?: string | null; reference?: string | null }[];
}) {
  const actor = await guard();
  if (failed(actor)) return actor;
  const fields = await fieldsFor(projectId);
  if (!fields) return { ok: false as const, error: "Projet introuvable." };
  const wizardKeys = new Set(fields.map((f) => f.key));
  const overwrite = new Set(input.overwriteKeys ?? []);

  // Revalidation serveur : clés connues, valeurs au bon type.
  const clean = new Map<string, number | boolean | string>();
  for (const { key, value } of input.values) {
    if (!wizardKeys.has(key) && !PROJECT_FIELD_KEYS.has(key)) continue;
    const v = coerceValue(key, String(value), fields);
    if (v !== null) clean.set(key, v);
  }
  const auths = (input.authorizations ?? []).filter((a) => AUTHORIZATION_CHAIN.some((c) => c.code === a.code));
  if (clean.size === 0 && auths.length === 0) return { ok: false as const, error: "Aucune valeur valide à reporter." };

  const project = await prisma.realEstateProject.findUniqueOrThrow({
    where: { id: projectId }, select: Object.fromEntries(PROJECT_FIELDS.map((f) => [f.key, true])) as Record<string, true>,
  }) as Record<string, unknown>;
  const existing = await prisma.projectInput.findMany({
    where: { projectId, key: { in: [...clean.keys()] } },
    select: { key: true, valueNum: true, valueStr: true, valueBool: true },
  });
  const filled = new Set(existing.filter(filledInput).map((i) => i.key));

  const applied: string[] = [];
  const skipped: string[] = [];
  const projectData: Record<string, unknown> = {};
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of clean) {
      if (PROJECT_FIELD_KEYS.has(key)) {
        const cur = project[key];
        if (cur !== null && cur !== undefined && cur !== "" && !overwrite.has(key)) { skipped.push(key); continue; }
        const type = PROJECT_FIELDS.find((f) => f.key === key)!.type;
        projectData[key] = type === "date" ? new Date(String(value)) : value;
        applied.push(key);
        continue;
      }
      if (filled.has(key) && !overwrite.has(key)) { skipped.push(key); continue; }
      const data = {
        valueNum: typeof value === "number" ? value : null,
        valueStr: typeof value === "string" ? value : null,
        valueBool: typeof value === "boolean" ? value : null,
      };
      await tx.projectInput.upsert({ where: { projectId_key: { projectId, key } }, create: { projectId, key, ...data }, update: data });
      applied.push(key);
    }
    if (Object.keys(projectData).length) {
      await tx.realEstateProject.update({ where: { id: projectId }, data: projectData });
    }
    for (const a of auths) {
      const d = a.obtainedAt ? new Date(a.obtainedAt) : null;
      const data = { obtained: true, obtainedAt: d && !Number.isNaN(d.getTime()) ? d : null, reference: a.reference?.trim().slice(0, 120) || null };
      const cur = await tx.projectAuthorization.findUnique({ where: { projectId_code: { projectId, code: a.code } } });
      if (cur?.obtained) continue; // déjà renseignée : on ne touche pas
      await tx.projectAuthorization.upsert({
        where: { projectId_code: { projectId, code: a.code } },
        create: { projectId, code: a.code, ...data },
        update: { ...data, reference: data.reference ?? cur?.reference ?? null },
      });
      applied.push(`autorisation:${a.code}`);
    }
    if (applied.length) {
      await recordAudit({
        actorId: actor.id, action: "UPDATE", entity: "ProjectInput", entityId: projectId,
        after: Object.fromEntries(applied.map((k) => [k, clean.get(k) ?? true])),
        metadata: { source: "document_reading", overwritten: applied.filter((k) => overwrite.has(k)) },
      }, tx);
    }
  });

  for (const path of ["", "/scoring", "/documents", "/suivi"]) revalidatePath(`/projects/${projectId}${path}`);
  return { ok: true as const, applied: applied.length, skipped: skipped.length };
}
