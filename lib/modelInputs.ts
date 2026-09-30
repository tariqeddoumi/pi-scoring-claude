// =====================================================================
//  modelInputs.ts — Clés de saisie exigées par un modèle publié.
//
//  Le modèle est administrable : un critère ou une alerte peut être ajouté
//  depuis l'écran d'administration avec une clé que les écrans « codés » ne
//  connaissent pas. Ce module dérive du modèle PUBLIÉ la liste des clés, leur
//  type et leurs modalités, pour que la saisie et la validation suivent le
//  modèle au lieu de le précéder.
//  Logique pure — aucune dépendance base.
// =====================================================================

import { z } from "zod";
import type { RuleClause, RuleExpression, ScoringModelConfig } from "@/lib/domain/types";
import { optBool, optEnum, optNumber } from "@/lib/validation";

export type ModelInputKind = "number" | "select" | "bool" | "text";

export interface ModelInputField {
  key: string;
  kind: ModelInputKind;
  label: string;
  options?: { value: string; label: string }[];
  /** Origine : critère noté ou clé d'alerte D5. */
  source: "criterion" | "alert";
  /** Code du critère ou de l'alerte qui l'exige. */
  code: string;
}

function clausesOf(rule: RuleExpression | null | undefined): RuleClause[] {
  if (!rule) return [];
  return [...(rule.clause ? [rule.clause] : []), ...(rule.all ?? []), ...(rule.any ?? [])];
}

function kindOfClause(c: RuleClause): ModelInputKind {
  if (c.op === "isTrue" || c.op === "isFalse") return "bool";
  if (c.op === "gt" || c.op === "gte" || c.op === "lt" || c.op === "lte") return "number";
  const v = Array.isArray(c.value) ? c.value[0] : c.value;
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "bool";
  return "text";
}

/** Clés de saisie exigées par le modèle (critères d'abord, puis alertes). */
export function modelInputFields(model: ScoringModelConfig): ModelInputField[] {
  const out = new Map<string, ModelInputField>();
  for (const d of model.domains) {
    for (const c of d.criteria) {
      if (out.has(c.inputKey)) continue;
      const qual = c.type === "QUAL" && (c.options?.length ?? 0) > 0;
      out.set(c.inputKey, {
        key: c.inputKey,
        kind: qual ? "select" : "number",
        label: c.name,
        options: qual ? c.options!.map((o) => ({ value: o.value, label: o.label })) : undefined,
        source: "criterion",
        code: c.code,
      });
    }
  }
  for (const rf of model.redFlags) {
    for (const cl of clausesOf(rf.rule)) {
      if (out.has(cl.key)) continue;
      out.set(cl.key, { key: cl.key, kind: kindOfClause(cl), label: rf.name, source: "alert", code: rf.code });
    }
  }
  return [...out.values()];
}

/** Schéma Zod d'un champ du modèle (même sémantique « vide = absent »). */
function fieldSchema(f: ModelInputField): z.ZodTypeAny {
  switch (f.kind) {
    case "number":
      return optNumber();
    case "bool":
      return optBool();
    case "select":
      return f.options && f.options.length > 0
        ? optEnum(f.options.map((o) => o.value) as [string, ...string[]])
        : z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable());
    default:
      return z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable());
  }
}

/**
 * Étend un schéma de saisie avec les clés du modèle publié qu'il ne connaît
 * pas encore : une clé ajoutée par l'administration du modèle devient
 * saisissable sans redéploiement.
 */
export function extendSchemaWithModel<T extends z.ZodRawShape>(
  base: z.ZodObject<T>,
  model: ScoringModelConfig,
): z.ZodObject<z.ZodRawShape> {
  const extra: z.ZodRawShape = {};
  for (const f of modelInputFields(model)) {
    if (!(f.key in base.shape)) extra[f.key] = fieldSchema(f);
  }
  return base.extend(extra) as unknown as z.ZodObject<z.ZodRawShape>;
}

/** Champs du modèle absents d'une liste de clés déjà présentées à l'écran. */
export function uncoveredModelFields(model: ScoringModelConfig, coveredKeys: Iterable<string>): ModelInputField[] {
  const covered = new Set(coveredKeys);
  return modelInputFields(model).filter((f) => !covered.has(f.key));
}
