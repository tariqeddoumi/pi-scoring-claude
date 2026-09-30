// =====================================================================
//  scoringRunDetails.ts — Lecture complète d'un résultat de scoring,
//  conservée avec le run (colonne ScoringRun.details).
//
//  Le moteur calcule depuis la v3 des informations décisives (données
//  manquantes, classe interne, notes économique et sûretés, conditions, PD
//  indicative) qui n'étaient ni conservées ni affichées : l'écran montrait
//  « Dossier incomplet » sans dire ce qui manquait. Ce module fige ces
//  informations telles qu'elles ont été calculées.
//  Logique pure — aucune dépendance base.
// =====================================================================

import type { DecisionCondition, ScoringModelConfig, ScoringResult } from "./types";

export interface ScoringRunDetails {
  modelCode: string;
  modelVersion: string;
  internalClass: string;
  scoreEco: number;
  alphaSeg: number;
  betaZone: number;
  unknownSegment: boolean;
  unknownZone: boolean;
  scoreAdjusted: number;
  totalMalus: number;
  economicScore: number;
  guaranteeScore: number | null;
  pdProxy: number;
  pdIndicative: boolean;
  dataIncomplete: boolean;
  missingCriticalInputs: string[];
  defaultAsserted: boolean;
  souffranceTriggered: boolean;
  regulatoryClass: string | null;
  conditions: DecisionCondition[];
  /** Alertes déclenchées imposant un retour en comité (codes). */
  committeeFlags: string[];
}

export function buildScoringRunDetails(model: ScoringModelConfig, r: ScoringResult): ScoringRunDetails {
  const committee = new Set(model.redFlags.filter((f) => f.requiresCommittee).map((f) => f.code));
  return {
    modelCode: model.modelCode,
    modelVersion: model.version,
    internalClass: r.internalClass,
    scoreEco: r.scoreEco,
    alphaSeg: r.alphaSeg,
    betaZone: r.betaZone,
    unknownSegment: r.unknownSegment,
    unknownZone: r.unknownZone,
    scoreAdjusted: r.scoreAdjusted,
    totalMalus: r.totalMalus,
    economicScore: r.economicScore,
    guaranteeScore: r.guaranteeScore,
    pdProxy: r.pdProxy,
    pdIndicative: r.pdIndicative,
    dataIncomplete: r.dataIncomplete,
    missingCriticalInputs: r.missingCriticalInputs,
    defaultAsserted: r.defaultAsserted,
    souffranceTriggered: r.souffranceTriggered,
    regulatoryClass: r.regulatoryClass ?? null,
    conditions: r.conditions,
    committeeFlags: r.redFlags.map((f) => f.code).filter((c) => committee.has(c)),
  };
}

/** Relit la colonne JSON (tolère les runs antérieurs sans détails). */
export function readScoringRunDetails(v: unknown): ScoringRunDetails | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const d = v as Partial<ScoringRunDetails>;
  if (typeof d.modelVersion !== "string" || typeof d.internalClass !== "string") return null;
  return {
    missingCriticalInputs: [],
    conditions: [],
    committeeFlags: [],
    ...d,
  } as ScoringRunDetails;
}
