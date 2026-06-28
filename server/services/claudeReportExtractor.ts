// =====================================================================
//  claudeReportExtractor.ts — Extracteur de rapports de visite propulsé par
//  Claude (Anthropic API). SERVER-ONLY (détient la clé API). Implémente
//  l'interface `AsyncReportExtractor` : lit le TEXTE et/ou des documents
//  SCANNÉS (images, PDF) et renvoie des champs structurés (mêmes candidats
//  que l'extracteur heuristique, à valider par l'utilisateur).
//
//  Repli : si `ANTHROPIC_API_KEY` est absente — ou en cas d'erreur réseau /
//  quota / refus — on retombe sur l'heuristique déterministe, de sorte que la
//  fonctionnalité reste utilisable sans clé. C'est le branchement IA prévu par
//  le point d'insertion de la chaîne « scanner → extraire → charger ».
// =====================================================================

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  heuristicExtractor,
  type AsyncReportExtractor,
  type ExtractedReportFields,
  type ReportDocument,
} from "@/lib/domain/visitReportExtraction";

// Modèle le plus capable disponible (vision + sortie structurée).
const MODEL = "claude-opus-4-8";

// Validation de la réponse du modèle (sortie structurée → JSON sûr).
const ExtractionSchema = z.object({
  visitDate: z.string().nullable(),
  observedProgressPct: z.number().min(0).max(100).nullable(),
  workforceCount: z.number().int().min(0).nullable(),
  weatherImpact: z.boolean(),
  qualityIssue: z.boolean(),
  safetyIssue: z.boolean(),
  delayRisk: z.boolean(),
  trancheCode: z.string().nullable(),
  summary: z.string().nullable(),
});

// Schéma JSON transmis à l'API (sortie structurée). Nullables via anyOf.
const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    visitDate: { ...nullable("string"), description: "Date de visite ISO yyyy-mm-dd, sinon null" },
    observedProgressPct: { ...nullable("number"), description: "Avancement constaté en % (0-100), sinon null" },
    workforceCount: { ...nullable("integer"), description: "Effectif présent, sinon null" },
    weatherImpact: { type: "boolean", description: "Intempéries impactant le planning" },
    qualityIssue: { type: "boolean", description: "Non-conformité / malfaçon signalée" },
    safetyIssue: { type: "boolean", description: "Incident ou risque sécurité (HSE)" },
    delayRisk: { type: "boolean", description: "Retard / glissement de planning signalé" },
    trancheCode: { ...nullable("string"), description: "Code de tranche (ex. T1, V1), sinon null" },
    summary: { ...nullable("string"), description: "Synthèse en une phrase (français), sinon null" },
  },
  required: [
    "visitDate", "observedProgressPct", "workforceCount", "weatherImpact",
    "qualityIssue", "safetyIssue", "delayRisk", "trancheCode", "summary",
  ],
} as const;

const SYSTEM_PROMPT = [
  "Tu es un assistant qui extrait des informations structurées de rapports de",
  "visite de chantier de promotion immobilière (en français). À partir du texte",
  "et/ou des documents scannés fournis, identifie les champs demandés. Si une",
  "information est absente ou incertaine, renvoie null (false pour les booléens).",
  "Les valeurs extraites sont des CANDIDATS qui seront validés par un humain :",
  "n'invente rien.",
].join(" ");

const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SUPPORTED_DOC_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf",
]);

function buildContent(rawText: string | undefined, documents: ReportDocument[] | undefined): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const doc of documents ?? []) {
    if (!SUPPORTED_DOC_TYPES.has(doc.mediaType)) continue;
    if (doc.mediaType === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.base64 } });
    } else {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: doc.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: doc.base64,
        },
      });
    }
  }
  blocks.push({
    type: "text",
    text: (rawText && rawText.trim() ? `Texte du rapport :\n${rawText.trim()}\n\n` : "") +
      "Extrais les champs structurés de ce rapport de visite.",
  });
  return blocks;
}

function toFields(parsed: z.infer<typeof ExtractionSchema>): ExtractedReportFields {
  const detected: string[] = [];
  if (parsed.visitDate != null) detected.push("visitDate");
  if (parsed.observedProgressPct != null) detected.push("observedProgressPct");
  if (parsed.workforceCount != null) detected.push("workforceCount");
  if (parsed.trancheCode != null) detected.push("trancheCode");
  if (parsed.weatherImpact) detected.push("weatherImpact");
  if (parsed.qualityIssue) detected.push("qualityIssue");
  if (parsed.safetyIssue) detected.push("safetyIssue");
  if (parsed.delayRisk) detected.push("delayRisk");
  if (parsed.summary != null) detected.push("summary");
  return { ...parsed, detected };
}

/** Extracteur IA (Claude) — repli automatique sur l'heuristique sans clé/erreur. */
export const claudeReportExtractor: AsyncReportExtractor = {
  name: "Claude (IA — texte & scan)",
  async extract({ rawText, documents }): Promise<ExtractedReportFields> {
    if (!isConfigured()) return heuristicExtractor.extract(rawText ?? "");

    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: JSON_SCHEMA }, effort: "low" },
        messages: [{ role: "user", content: buildContent(rawText, documents) }],
      });

      const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      if (message.stop_reason === "refusal" || !textBlock) {
        return heuristicExtractor.extract(rawText ?? "");
      }
      const parsed = ExtractionSchema.safeParse(JSON.parse(textBlock.text));
      if (!parsed.success) return heuristicExtractor.extract(rawText ?? "");
      return toFields(parsed.data);
    } catch {
      return heuristicExtractor.extract(rawText ?? "");
    }
  },
};
