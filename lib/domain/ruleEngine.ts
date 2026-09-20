// =====================================================================
//  Évaluateur de règles (DSL) sur les entrées projet.
//  Utilisé par les red flags et les triggers de classification.
// =====================================================================

import type {
  ProjectInputs,
  RuleClause,
  RuleExpression,
  InputValue,
} from "./types";

function evalClause(clause: RuleClause, inputs: ProjectInputs): boolean {
  const actual = inputs[clause.key] ?? null;
  const expected = clause.value;

  switch (clause.op) {
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual === false;
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual as InputValue);
    case "gt":
      return isNum(actual) && isNum(expected) && actual > expected;
    case "gte":
      return isNum(actual) && isNum(expected) && actual >= expected;
    case "lt":
      return isNum(actual) && isNum(expected) && actual < expected;
    case "lte":
      return isNum(actual) && isNum(expected) && actual <= expected;
    default:
      return false;
  }
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

export function evaluateRule(
  expr: RuleExpression,
  inputs: ProjectInputs,
): boolean {
  if (expr.clause) {
    return evalClause(expr.clause, inputs);
  }
  if (expr.all && expr.all.length > 0) {
    return expr.all.every((c) => evalClause(c, inputs));
  }
  if (expr.any && expr.any.length > 0) {
    return expr.any.some((c) => evalClause(c, inputs));
  }
  // Expression vide => non déclenchée
  return false;
}

/**
 * Énumère les clés d'entrée référencées par une expression de règle. Sert à
 * détecter les données manquantes qui, sans cette énumération, feraient
 * silencieusement disparaître une alerte (diagnostic F01) : une clé référencée
 * par un red flag est décisionnelle ; son absence doit produire « Dossier
 * incomplet » plutôt qu'un score amélioré par omission.
 */
export function ruleKeys(expr: RuleExpression | null | undefined): string[] {
  if (!expr) return [];
  const keys = new Set<string>();
  const add = (c?: RuleClause) => {
    if (c?.key) keys.add(c.key);
  };
  add(expr.clause);
  expr.all?.forEach(add);
  expr.any?.forEach(add);
  return [...keys];
}

/**
 * Une clé référencée par la règle est-elle absente des entrées ? Une donnée
 * manquante ne peut jamais rendre une règle défavorable « non déclenchée » à
 * bon compte : l'appelant doit traiter ce cas comme incomplet (F01).
 */
export function ruleHasMissingKey(
  expr: RuleExpression | null | undefined,
  inputs: ProjectInputs,
): boolean {
  return ruleKeys(expr).some((k) => inputs[k] === undefined || inputs[k] === null);
}

const NUMERIC_OPS = new Set(["gt", "gte", "lt", "lte"]);

/**
 * Clés référencées par une règle via une COMPARAISON NUMÉRIQUE (gt/gte/lt/lte).
 * Ce sont les clés dont l'absence est dangereuse (F01) : une comparaison
 * numérique sur une valeur manquante renvoie « false » et fait disparaître
 * l'alerte. À l'inverse, les opérateurs booléens/égalité (isTrue, eq…)
 * traitent légitimement l'absence comme « non affirmé ».
 */
export function numericRuleKeys(expr: RuleExpression | null | undefined): string[] {
  if (!expr) return [];
  const keys = new Set<string>();
  const add = (c?: RuleClause) => {
    if (c?.key && NUMERIC_OPS.has(c.op)) keys.add(c.key);
  };
  add(expr.clause);
  expr.all?.forEach(add);
  expr.any?.forEach(add);
  return [...keys];
}
