// =====================================================================
//  modelValidation.ts — Validation PURE de la cohérence d'un modèle de scoring
//  avant publication. Le modèle étant entièrement paramétrable (ajout/suppression
//  de domaines, critères, modalités), on vérifie ici les invariants qui
//  garantissent un calcul sain : somme des poids de domaines = 1, somme des poids
//  de critères = 1 par domaine, présence de barèmes, etc.
// =====================================================================

const TOL = 0.011; // tolérance d'arrondi sur les sommes de poids

export interface ModelCriterionLite {
  code: string;
  type: "QUAL" | "NUM";
  weight: number;
  optionsCount: number;
  rangesCount: number;
}
export interface ModelDomainLite {
  code: string;
  weight: number;
  criteria: ModelCriterionLite[];
}
export interface ModelLite {
  domains: ModelDomainLite[];
}

export interface ValidationIssue {
  level: "ERROR" | "WARNING";
  message: string;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Valide un modèle avant publication. Les ERROR bloquent la publication,
 * les WARNING sont informatifs.
 */
export function validateModelForPublish(model: ModelLite): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (model.domains.length === 0) {
    issues.push({ level: "ERROR", message: "Le modèle ne contient aucun domaine." });
    return issues;
  }

  const domainSum = sum(model.domains.map((d) => d.weight));
  if (Math.abs(domainSum - 1) > TOL) {
    issues.push({ level: "ERROR", message: `La somme des poids des domaines doit faire 100% (actuel : ${r2(domainSum * 100)}%).` });
  }

  for (const d of model.domains) {
    if (d.criteria.length === 0) {
      issues.push({ level: "ERROR", message: `Le domaine ${d.code} n'a aucun critère.` });
      continue;
    }
    const critSum = sum(d.criteria.map((c) => c.weight));
    if (Math.abs(critSum - 1) > TOL) {
      issues.push({ level: "ERROR", message: `Domaine ${d.code} : la somme des poids des critères doit faire 100% (actuel : ${r2(critSum * 100)}%).` });
    }
    for (const c of d.criteria) {
      if (c.type === "QUAL" && c.optionsCount === 0) {
        issues.push({ level: "ERROR", message: `Critère ${c.code} (qualitatif) sans aucune modalité.` });
      }
      if (c.type === "NUM" && c.rangesCount === 0) {
        issues.push({ level: "ERROR", message: `Critère ${c.code} (numérique) sans aucun barème.` });
      }
    }
  }

  return issues;
}

export const hasBlockingIssues = (issues: ValidationIssue[]) => issues.some((i) => i.level === "ERROR");
