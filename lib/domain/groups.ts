// =====================================================================
//  groups.ts — Groupe d'intérêt & effet de contagion (BKAM 19/G art.33 ;
//  1/W art.50). Logique pure : détermine la classe la plus sévère d'un
//  ensemble d'entités liées et la classe de contagion imposée à une
//  contrepartie par ses pairs plus dégradés.
// =====================================================================

import type { RegulatoryClassCode } from "@/lib/domain/types";

// Sévérité croissante des classes réglementaires (index = rang de risque).
export const CLASS_SEVERITY: RegulatoryClassCode[] = [
  "SAIN",
  "SENSIBLE",
  "PRE_DOUTEUX",
  "DOUTEUX",
  "COMPROMIS",
  "CTX",
];

export function classSeverity(c: RegulatoryClassCode): number {
  return CLASS_SEVERITY.indexOf(c);
}

/** Classe la plus sévère parmi un ensemble (en ignorant les valeurs nulles). */
export function mostSevereClass(
  codes: (RegulatoryClassCode | null | undefined)[],
): RegulatoryClassCode | undefined {
  let best: RegulatoryClassCode | undefined;
  let bestIdx = -1;
  for (const c of codes) {
    if (!c) continue;
    const idx = classSeverity(c);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = c;
    }
  }
  return best;
}

/**
 * Classe de contagion imposée à `target` par ses pairs de groupe : la classe
 * la plus sévère des pairs si elle est strictement plus dégradée que celle de
 * la contrepartie évaluée ; sinon aucune contagion.
 */
export function groupContagionClass(
  target: RegulatoryClassCode,
  peers: (RegulatoryClassCode | null | undefined)[],
): RegulatoryClassCode | undefined {
  const worst = mostSevereClass(peers);
  if (worst && classSeverity(worst) > classSeverity(target)) return worst;
  return undefined;
}
