// =====================================================================
//  claudeDossierExtractor.ts — Lecture IA des documents du DOSSIER de crédit
//  (business plan, note de présentation, autorisation de construire, relevés…)
//  pour pré-remplir la saisie de scoring. SERVER-ONLY (détient la clé API).
//
//  Principe : le schéma de sortie est CONSTRUIT DYNAMIQUEMENT à partir des
//  champs du wizard (nombre / booléen / liste de valeurs) — l'IA ne renvoie
//  une valeur QUE si le document l'établit explicitement (null sinon, jamais
//  d'invention). Les valeurs sont des CANDIDATS : l'utilisateur choisit de
//  ne compléter que les champs vides (défaut) ou de remplacer, et tout reste
//  modifiable dans le wizard ensuite.
//
//  Sans clé ANTHROPIC_API_KEY : erreur claire (pas d'heuristique fiable pour
//  un dossier complet, contrairement aux rapports de visite).
// =====================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { FieldDef } from "@/lib/wizardFields";
import { INPUT_LABELS } from "@/lib/inputLabels";
import type { ReportDocument } from "@/lib/domain/visitReportExtraction";

const MODEL = "claude-opus-4-8";

const SUPPORTED_DOC_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf",
]);

export interface DossierExtractionResult {
  /** Valeurs lues par l'IA (uniquement les champs établis par les documents). */
  values: Record<string, number | boolean | string>;
  /** Clés lues (ordre d'apparition dans le wizard). */
  readKeys: string[];
  /** Clés du wizard NON lues (à saisir manuellement). */
  unreadKeys: string[];
}

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

/** Schéma JSON de sortie construit depuis les champs du wizard. */
function buildSchema(fields: FieldDef[]) {
  const properties: Record<string, unknown> = {};
  for (const f of fields) {
    const label = INPUT_LABELS[f.key] ?? f.key;
    if (f.type === "number") {
      properties[f.key] = { ...nullable("number"), description: `${label} — nombre, sinon null` };
    } else if (f.type === "bool") {
      properties[f.key] = { ...nullable("boolean"), description: `${label} — booléen si établi par le document, sinon null` };
    } else {
      const values = (f.options ?? []).map((o) => o.value);
      properties[f.key] = {
        anyOf: [{ type: "string", enum: values }, { type: "null" }],
        description: `${label} — une des valeurs [${(f.options ?? []).map((o) => `${o.value}=${o.label}`).join("; ")}], sinon null`,
      };
    }
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: fields.map((f) => f.key),
  } as const;
}

const SYSTEM_PROMPT = [
  "Tu lis les documents d'un dossier de crédit de promotion immobilière marocain",
  "(business plan, note de présentation, autorisations, états financiers, relevés)",
  "pour pré-remplir la grille de scoring. Renvoie une valeur UNIQUEMENT si le",
  "document l'établit explicitement ou permet un calcul direct et sûr ;",
  "sinon null. N'INVENTE RIEN : chaque valeur sera revue par un analyste,",
  "et les champs null seront saisis manuellement. Pourcentages en points",
  "(ex. 35 pour 35 %), montants en MAD.",
].join(" ");

function buildContent(rawText: string | undefined, documents: ReportDocument[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const doc of documents) {
    if (!SUPPORTED_DOC_TYPES.has(doc.mediaType)) continue;
    if (doc.mediaType === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.base64 } });
    } else {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: doc.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: doc.base64 },
      });
    }
  }
  blocks.push({
    type: "text",
    text:
      (rawText?.trim() ? `Texte fourni :\n${rawText.trim()}\n\n` : "") +
      "Extrais les champs de la grille de scoring établis par ces documents (null pour tout le reste).",
  });
  return blocks;
}

export const isDossierAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Lit les documents du dossier et renvoie les champs candidats du wizard. */
export async function extractDossierFields(input: {
  fields: FieldDef[];
  rawText?: string;
  documents?: ReportDocument[];
}): Promise<DossierExtractionResult> {
  if (!isDossierAiConfigured()) {
    throw new Error("IA non configurée (ANTHROPIC_API_KEY absente) : la lecture de documents est indisponible.");
  }

  const docs = (input.documents ?? []).slice(0, 5);
  const client = new Anthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: buildSchema(input.fields) }, effort: "low" },
    messages: [{ role: "user", content: buildContent(input.rawText, docs) }],
  });

  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (message.stop_reason === "refusal" || !textBlock) {
    throw new Error("L'IA n'a pas pu analyser ces documents.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Réponse IA illisible — réessayez.");
  }

  // Ne conserve que les valeurs non nulles conformes au type attendu.
  const values: DossierExtractionResult["values"] = {};
  const readKeys: string[] = [];
  for (const f of input.fields) {
    const v = parsed[f.key];
    if (v === null || v === undefined) continue;
    if (f.type === "number" && typeof v === "number" && isFinite(v)) {
      values[f.key] = v;
      readKeys.push(f.key);
    } else if (f.type === "bool" && typeof v === "boolean") {
      values[f.key] = v;
      readKeys.push(f.key);
    } else if (f.type === "select" && typeof v === "string" && (f.options ?? []).some((o) => o.value === v)) {
      values[f.key] = v;
      readKeys.push(f.key);
    }
  }
  const unreadKeys = input.fields.map((f) => f.key).filter((k) => !readKeys.includes(k));
  return { values, readKeys, unreadKeys };
}
