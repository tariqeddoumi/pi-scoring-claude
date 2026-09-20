// =====================================================================
//  phases.ts — Grilles de pondération PAR PHASE (diagnostic F11, §8.2).
//
//  Le diagnostic relève que les mêmes barèmes/poids s'appliquent au foncier, à
//  la construction et à l'écoulement du stock, alors que ces phases appellent
//  des lectures différentes (un projet avant travaux n'a ni CA ni ventes
//  exigibles ; un programme achevé doit surtout démontrer l'écoulement et le
//  désendettement). Ce module fournit :
//   - la dérivation de la phase depuis l'état/avancement du projet ;
//   - des PROFILS de pondération de domaines par phase (challenger §8.2).
//
//  IMPORTANT — ces poids sont un CHALLENGER à valider sur échantillon avant
//  adoption : ils ne remplacent PAS les poids officiels du modèle. Le module
//  sert à COMPARER (score officiel vs pondération par phase), pas à décider.
//  Logique PURE, déterministe, testable — aucune dépendance base.
// =====================================================================

export type ProjectPhase = "PRE_DEVELOPMENT" | "CONSTRUCTION" | "ECOULEMENT";

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  PRE_DEVELOPMENT: "Pré-développement",
  CONSTRUCTION: "Construction",
  ECOULEMENT: "Écoulement après achèvement",
};

/**
 * Profils de pondération de domaines par phase (challenger §8.2). Les codes de
 * domaines suivent le modèle (D1..D4). Chaque profil somme à 1.
 *  - pré-dév : renforce faisabilité/exécution et capacité du sponsor ;
 *  - construction : privilégie financement et exécution ;
 *  - écoulement : se concentre sur ventes, liquidité et dette résiduelle.
 */
export const PHASE_WEIGHT_PROFILES: Record<ProjectPhase, Record<string, number>> = {
  PRE_DEVELOPMENT: { D1: 0.25, D2: 0.30, D3: 0.20, D4: 0.25 },
  CONSTRUCTION: { D1: 0.20, D2: 0.25, D3: 0.25, D4: 0.30 },
  ECOULEMENT: { D1: 0.15, D2: 0.10, D3: 0.35, D4: 0.40 },
};

export interface PhaseSignals {
  /** Statut projet (référentiel PROJECT_STATUSES), si disponible. */
  status?: string | null;
  /** Avancement physique 0..100 (max des tranches ou avancement projet). */
  progressPct?: number | null;
  /** La commercialisation est-elle lancée ? */
  commercialisationLaunched?: boolean;
  /** Réception des travaux prononcée (projet/tranches livrés) ? */
  delivered?: boolean;
}

/**
 * Dérive la phase depuis l'état et l'avancement. Règles simples et prudentes :
 *  - livré / avancement ≥ 100 → écoulement ;
 *  - travaux engagés (avancement > 0) ou commercialisation lancée → construction ;
 *  - sinon → pré-développement.
 */
export function derivePhase(s: PhaseSignals): ProjectPhase {
  const p = typeof s.progressPct === "number" ? s.progressPct : 0;
  // Normalise les accents pour un matching robuste (« Achevé », « Achèvement »…).
  const status = (s.status ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (s.delivered || p >= 100 || status.includes("livr") || status.includes("achev")) {
    return "ECOULEMENT";
  }
  if (p > 0 || s.commercialisationLaunched || status.includes("travaux") || status.includes("chantier") || status.includes("construction")) {
    return "CONSTRUCTION";
  }
  return "PRE_DEVELOPMENT";
}

/**
 * Poids de phase restreints aux domaines réellement présents dans le modèle,
 * renormalisés à 1 (robuste si un modèle a d'autres codes de domaines).
 */
export function phaseWeightsFor(phase: ProjectPhase, domainCodes: string[]): Record<string, number> {
  const profile = PHASE_WEIGHT_PROFILES[phase];
  const present = domainCodes.filter((c) => profile[c] != null);
  const total = present.reduce((s, c) => s + profile[c]!, 0) || 1;
  const out: Record<string, number> = {};
  for (const c of present) out[c] = Math.round((profile[c]! / total) * 10000) / 10000;
  return out;
}
