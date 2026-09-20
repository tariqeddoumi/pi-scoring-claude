// =====================================================================
//  overridePolicy.ts — Garde-fous des dérogations de classification (F05).
//
//  Le diagnostic relève que la demande et l'approbation partagent la même
//  permission et qu'aucun contrôle n'empêche l'auto-approbation ni l'abaissement
//  d'un plancher réglementaire obligatoire. Ce module fournit deux règles pures :
//   1. séparation des tâches : le demandeur ne peut pas approuver sa dérogation ;
//   2. plancher non dérogeable : une simple dérogation métier ne peut pas rendre
//      une créance en défaut « moins sévère » que le défaut (art. classification).
//  Logique pure, déterministe, testable.
// =====================================================================

import type { RegulatoryClassCode } from "./types";

// Sévérité croissante (aligne l'orderIndex des régimes BKAM).
const SEVERITY: Record<RegulatoryClassCode, number> = {
  SAIN: 0,
  SENSIBLE: 1,
  PRE_DOUTEUX: 2,
  DOUTEUX: 3,
  COMPROMIS: 4,
  CTX: 5,
};

// Classes constituant un défaut avéré (1/W art.34 ; 19/G souffrance).
const DEFAULT_CLASSES: RegulatoryClassCode[] = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];

export function classSeverity(c: RegulatoryClassCode): number {
  return SEVERITY[c] ?? -1;
}

export function isDefaultClass(c: RegulatoryClassCode | null | undefined): boolean {
  return !!c && DEFAULT_CLASSES.includes(c);
}

/** Le demandeur ne peut pas approuver sa propre dérogation (séparation des tâches). */
export function canApproveOverride(requesterId: string, approverId: string): boolean {
  return requesterId !== approverId;
}

/**
 * Une dérogation vers `forcedClass` est-elle admissible au regard de la classe
 * moteur `engineClass` ? Règle de plancher non dérogeable : lorsque le moteur
 * conclut à un défaut avéré, une dérogation ne peut pas ramener la créance à une
 * classe performante (SAIN/SENSIBLE) — il faut une base juridique et un circuit
 * de reclassement réglementaire, pas une simple approbation métier.
 */
export function isDerogationAdmissible(
  engineClass: RegulatoryClassCode | null | undefined,
  forcedClass: RegulatoryClassCode,
): { ok: boolean; reason?: string } {
  if (isDefaultClass(engineClass) && !isDefaultClass(forcedClass)) {
    return {
      ok: false,
      reason:
        `Plancher non dérogeable : le moteur conclut à un défaut avéré (${engineClass}). ` +
        `Une dérogation ne peut pas forcer une classe performante (${forcedClass}) — ` +
        `un reclassement exige une base juridique et les périodes d'observation applicables.`,
    };
  }
  return { ok: true };
}
