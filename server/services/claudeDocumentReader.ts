// =====================================================================
//  claudeDocumentReader.ts — Lecture IA d'UNE pièce du dossier de crédit
//  (PDF, image ou texte extrait d'un tableur). SERVER-ONLY (clé API).
//
//  Pour chaque pièce : type de pièce (référentiel lib/domain/dossierDocuments),
//  titre, émetteur, date, résumé, points d'attention, et les données de la
//  saisie que la pièce ÉTABLIT, chacune avec la page et la citation exacte
//  qui la justifient. Rien n'est écrit ici : les valeurs sont des candidats
//  revus par l'analyste (server/actions/dossierDocuments.ts).
//
//  Un appel par pièce (ou par partie d'un gros PDF découpé dans le
//  navigateur) : pas de limite au nombre de pièces, requêtes sous la limite
//  de taille des fonctions serverless. Modèle principal avec repli
//  automatique côté serveur si le modèle principal est indisponible.
// =====================================================================

import Anthropic from "@anthropic-ai/sdk";
import type { FieldDef } from "@/lib/wizardFields";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { DOSSIER_DOCUMENTS, OTHER_DOC, type ExtractedField } from "@/lib/domain/dossierDocuments";

const MODEL = "claude-opus-5-5";
const FALLBACK_MODEL = "claude-opus-4-8";

export const isDocumentAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Données de la fiche projet que les pièces peuvent renseigner. */
export const PROJECT_FIELDS: readonly { key: string; label: string; type: "money" | "number" | "integer" | "text" | "date" }[] = [
  { key: "loanAmount", label: "Montant du crédit demandé (MAD)", type: "money" },
  { key: "totalCost", label: "Coût total du programme (MAD)", type: "money" },
  { key: "ownEquity", label: "Fonds propres du promoteur (MAD)", type: "money" },
  { key: "totalUnits", label: "Nombre de lots / unités", type: "integer" },
  { key: "landAreaSqm", label: "Superficie du terrain (m²)", type: "number" },
  { key: "builtAreaSqm", label: "Surface construite / plancher (m²)", type: "number" },
  { key: "landTitleRef", label: "Numéro(s) du titre foncier", type: "text" },
  { key: "buildPermitRef", label: "Numéro de l'autorisation de construire", type: "text" },
  { key: "buildPermitDate", label: "Date de l'autorisation de construire", type: "date" },
  { key: "startDate", label: "Démarrage des travaux", type: "date" },
  { key: "expectedDeliveryDate", label: "Livraison prévue", type: "date" },
];
export const PROJECT_FIELD_KEYS = new Set(PROJECT_FIELDS.map((f) => f.key));

export type DocumentPart =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp" }
  | { kind: "text"; text: string };

export interface DocumentReading {
  docType: string;
  title: string | null;
  issuer: string | null;
  documentDate: string | null;
  summary: string;
  attention: string[];
  fields: ExtractedField[];
  /** Modèle qui a effectivement répondu (repli éventuel). */
  model: string;
}

function catalogue(fields: FieldDef[]): string {
  const lines = fields.map((f) => {
    const label = f.label ?? INPUT_LABELS[f.key] ?? f.key;
    if (f.type === "select") return `- ${f.key} : ${label} — une des valeurs ${(f.options ?? []).map((o) => `« ${o.value} » (${o.label})`).join(", ")}`;
    if (f.type === "bool") return `- ${f.key} : ${label} — « true » ou « false »`;
    if (f.type === "text") return `- ${f.key} : ${label} — texte`;
    return `- ${f.key} : ${label} — nombre${/%/.test(label) ? " en points de pourcentage (35 pour 35 %)" : ""}`;
  });
  for (const p of PROJECT_FIELDS) {
    lines.push(`- ${p.key} : ${p.label} — ${p.type === "date" ? "date AAAA-MM-JJ" : p.type === "text" ? "texte" : "nombre"}`);
  }
  return lines.join("\n");
}

const SYSTEM = (fields: FieldDef[]) => `Tu es analyste crédit dans une banque marocaine et tu lis une pièce du dossier de crédit d'un promoteur immobilier.

1. Identifie la pièce parmi ces types (code — libellé) ; « ${OTHER_DOC} » si aucun ne convient :
${DOSSIER_DOCUMENTS.map((d) => `- ${d.code} — ${d.label}`).join("\n")}

2. Relève les données de la grille ci-dessous que la pièce ÉTABLIT : valeur écrite dans le document, ou calcul direct et sûr à partir de chiffres du document (par exemple marge brute = (CA − coût total) / CA). Pour chaque donnée : la valeur au format demandé, le numéro de page (null si sans objet) et la citation exacte (courte, recopiée du document) qui la justifie. Si le calcul combine plusieurs chiffres, cite-les. N'invente rien, ne déduis pas de valeur qualitative d'une impression générale : une donnée absente n'est pas relevée. Montants en dirhams (MAD), convertis si le document exprime en milliers ou millions.

Grille (clé : libellé — format) :
${catalogue(fields)}

3. Résume la pièce en deux ou trois phrases et liste les points d'attention pour l'analyse crédit (incohérences, réserves, échéances, pièce non signée ou périmée, chiffres qui ne concordent pas). Réponds en français.`;

function schema(keys: string[]) {
  const str = { anyOf: [{ type: "string" }, { type: "null" }] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["docType", "title", "issuer", "documentDate", "summary", "attention", "fields"],
    properties: {
      docType: { type: "string", enum: [...DOSSIER_DOCUMENTS.map((d) => d.code), OTHER_DOC] },
      title: str,
      issuer: { ...str, description: "Émetteur ou signataire (administration, cabinet, société…)" },
      documentDate: { ...str, description: "Date du document, AAAA-MM-JJ" },
      summary: { type: "string" },
      attention: { type: "array", items: { type: "string" } },
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "value", "page", "quote"],
          properties: {
            key: { type: "string", enum: keys },
            value: { type: "string" },
            page: { anyOf: [{ type: "integer" }, { type: "null" }] },
            quote: { type: "string" },
          },
        },
      },
    },
  };
}

/** Convertit la valeur lue (texte) au type attendu ; null si non conforme. */
export function coerceValue(key: string, raw: string, fields: FieldDef[]): number | boolean | string | null {
  const v = raw.trim();
  if (!v) return null;
  const num = () => {
    const n = Number(v.replace(/[\s  ]/g, "").replace(/%$/, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const pf = PROJECT_FIELDS.find((p) => p.key === key);
  if (pf) {
    if (pf.type === "text") return v;
    if (pf.type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
    const n = num();
    if (n === null || n < 0) return null;
    return pf.type === "integer" ? Math.round(n) : n;
  }
  const f = fields.find((x) => x.key === key);
  if (!f) return null;
  if (f.type === "number") return num();
  if (f.type === "bool") return v === "true" ? true : v === "false" ? false : null;
  if (f.type === "select") return (f.options ?? []).some((o) => o.value === v) ? v : null;
  return v;
}

/** Lit une pièce (ou une partie de pièce) et renvoie classement, résumé et données établies. */
export async function readDossierDocument(input: {
  fileName: string;
  partLabel?: string;
  part: DocumentPart;
  fields: FieldDef[];
}): Promise<DocumentReading> {
  if (!isDocumentAiConfigured()) {
    throw new Error("Lecture du contenu indisponible : la clé ANTHROPIC_API_KEY n'est pas configurée.");
  }
  const { part, fields } = input;
  const keys = [...fields.map((f) => f.key), ...PROJECT_FIELDS.map((p) => p.key)];

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (part.kind === "pdf") {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: part.base64 } });
  } else if (part.kind === "image") {
    content.push({ type: "image", source: { type: "base64", media_type: part.mediaType, data: part.base64 } });
  } else {
    content.push({ type: "text", text: `Contenu du fichier :\n\n${part.text.slice(0, 200_000)}` });
  }
  content.push({
    type: "text",
    text: `Nom du fichier : ${input.fileName}${input.partLabel ? ` (${input.partLabel} ; les numéros de page sont ceux de cette partie)` : ""}. Lis cette pièce selon les consignes.`,
  });

  const client = new Anthropic();
  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: SYSTEM(fields),
    output_config: { format: { type: "json_schema", schema: schema(keys) } },
    messages: [{ role: "user", content }],
  });

  if (message.stop_reason === "refusal") throw new Error("Cette pièce n'a pas pu être lue (contenu refusé).");
  if (message.stop_reason === "max_tokens") throw new Error("Pièce trop volumineuse pour une lecture complète : découpez-la ou envoyez les pages utiles.");
  // Après un repli, seule la réponse du dernier modèle compte.
  const lastHop = message.content.map((b) => b.type as string).lastIndexOf("fallback");
  const text = message.content.slice(lastHop + 1).filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
  let parsed: {
    docType: string; title: string | null; issuer: string | null; documentDate: string | null;
    summary: string; attention: string[]; fields: { key: string; value: string; page: number | null; quote: string }[];
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Réponse illisible — relancez la lecture de cette pièce.");
  }

  // Contrôle serveur : clés connues, valeurs au bon type, une valeur par clé.
  const seen = new Set<string>();
  const out: ExtractedField[] = [];
  for (const f of parsed.fields ?? []) {
    if (seen.has(f.key) || !keys.includes(f.key)) continue;
    const value = coerceValue(f.key, String(f.value ?? ""), fields);
    if (value === null) continue;
    seen.add(f.key);
    out.push({ key: f.key, value, page: typeof f.page === "number" ? f.page : null, quote: String(f.quote ?? "").slice(0, 500) });
  }
  const known = new Set([...DOSSIER_DOCUMENTS.map((d) => d.code), OTHER_DOC]);
  return {
    docType: known.has(parsed.docType) ? parsed.docType : OTHER_DOC,
    title: parsed.title?.slice(0, 300) ?? null,
    issuer: parsed.issuer?.slice(0, 200) ?? null,
    documentDate: parsed.documentDate?.slice(0, 20) ?? null,
    summary: String(parsed.summary ?? "").slice(0, 2000),
    attention: (parsed.attention ?? []).map((a) => String(a).slice(0, 500)).slice(0, 12),
    fields: out,
    model: message.model,
  };
}
