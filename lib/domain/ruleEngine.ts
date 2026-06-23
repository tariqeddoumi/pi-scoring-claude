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
