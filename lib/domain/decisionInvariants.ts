// =====================================================================
//  decisionInvariants.ts — Invariants de décision (diagnostic F01/F02).
//
//  Principe : « supprimer une information défavorable ne peut jamais améliorer
//  la décision ». Deux mécanismes complémentaires :
//   1. Toute clé référencée par une alerte D5 (red flag), tout critère éliminatoire
//      (gate) et tout critère marqué `critical` est DÉCISIONNELLE. Son absence
//      produit « Dossier incomplet » (blocage), jamais un meilleur score.
//   2. Pour un critère dont la valeur est absente, la note retenue est la note
//      PLANCHER du barème (pire cas), et non 0 : l'omission ne peut pas contourner
//      un malus ni battre une valeur présente défavorable.
//
//  Logique pure, déterministe, sans dépendance base — testable unitairement.
// =====================================================================

import { numericRuleKeys } from "./ruleEngine";
import type { CriterionConfig, ProjectInputs, ScoringModelConfig } from "./types";

const isMissing = (inputs: ProjectInputs, k: string) =>
  inputs[k] === undefined || inputs[k] === null;

/**
 * Ensemble des clés d'entrée DÉCISIONNELLES d'un modèle :
 *  - clés référencées par une COMPARAISON NUMÉRIQUE d'une alerte D5 (leur absence
 *    ferait disparaître l'alerte — F01) ;
 *  - clés des critères éliminatoires (gate) ;
 *  - clés des critères explicitement marqués `critical`.
 * Les clés d'alertes booléennes/égalité ne sont PAS critiques : leur absence
 * signifie « non affirmé » (la saisie manuelle reste maîtresse).
 * Une clé additionnelle (ex. dpd_days pour la classification) peut être fournie.
 */
export function criticalInputKeys(
  model: ScoringModelConfig,
  extra: string[] = [],
): string[] {
  const keys = new Set<string>(extra);
  for (const rf of model.redFlags) numericRuleKeys(rf.rule).forEach((k) => keys.add(k));
  for (const d of model.domains) {
    for (const c of d.criteria) {
      if (c.isGate || c.critical) keys.add(c.inputKey);
    }
  }
  return [...keys];
}

/** Clés décisionnelles absentes des entrées (→ dossier incomplet). */
export function missingCriticalInputs(
  model: ScoringModelConfig,
  inputs: ProjectInputs,
  extra: string[] = [],
): string[] {
  return criticalInputKeys(model, extra).filter((k) => isMissing(inputs, k));
}

/**
 * Note plancher (pire cas) d'un critère : plus petite note atteignable via ses
 * modalités (QUAL) ou ses plages (NUM). Utilisée lorsque la valeur est absente,
 * pour garantir qu'une omission ne peut pas améliorer la note.
 */
export function worstCaseScore(crit: CriterionConfig): number {
  if (crit.type === "QUAL" && crit.options?.length) {
    return Math.min(...crit.options.map((o) => o.score));
  }
  if (crit.type === "NUM" && crit.ranges?.length) {
    return Math.min(...crit.ranges.map((r) => r.score));
  }
  return 0;
}
