// =====================================================================
//  facts.ts — Faits primitifs → indicateurs dérivés (source unique — F04).
//
//  Le diagnostic relève que deux champs indépendants décrivent le même fait
//  (project_stopped_months vs project_stopped_over_1y ; retard en mois vs
//  indicateur réglementaire), avec des résultats contradictoires selon le champ
//  renseigné. Ce module dérive TOUS les indicateurs depuis des faits primitifs
//  (dates), et détecte toute divergence avec un booléen importé — divergence qui
//  doit bloquer la validation.
//  Logique pure, déterministe, testable — aucune dépendance base.
// =====================================================================

const DAY_MS = 24 * 3600 * 1000;

export interface PrimitiveFacts {
  // Date d'arrêt du chantier (si à l'arrêt), sinon null.
  stoppedSince?: Date | string | null;
  // Retard chantier constaté (planning) : date théorique vs réelle du jalon.
  plannedMilestoneDate?: Date | string | null;
  actualOrNowForMilestone?: Date | string | null;
}

export interface DerivedFacts {
  project_stopped_months: number;
  project_stopped_over_1y: boolean;
  construction_delay_months: number;
  construction_delay_over_1y: boolean;
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS / 30.4375));
}

/**
 * Dérive les indicateurs d'arrêt et de retard depuis les dates primitives.
 * Convention calendaire explicite : « à partir de » (≥) et non « strictement
 * supérieur à » — un arrêt de 12 mois pile bascule le seuil « > 1 an ».
 */
export function deriveFacts(facts: PrimitiveFacts, now: Date = new Date()): DerivedFacts {
  const stoppedMonths = facts.stoppedSince ? monthsBetween(new Date(facts.stoppedSince), now) : 0;
  const planned = facts.plannedMilestoneDate ? new Date(facts.plannedMilestoneDate) : null;
  const actual = facts.actualOrNowForMilestone ? new Date(facts.actualOrNowForMilestone) : now;
  const delayMonths = planned && actual > planned ? monthsBetween(planned, actual) : 0;
  return {
    project_stopped_months: stoppedMonths,
    project_stopped_over_1y: stoppedMonths >= 12,
    construction_delay_months: delayMonths,
    construction_delay_over_1y: delayMonths >= 12,
  };
}

export interface FactDivergence {
  key: string;
  importedValue: unknown;
  derivedValue: unknown;
  message: string;
}

/**
 * Compare les booléens/durées éventuellement importés aux valeurs dérivées des
 * faits primitifs. Toute divergence est signalée : elle doit BLOQUER la
 * validation (un même fait ne peut pas produire deux vérités contradictoires).
 */
export function detectFactDivergences(
  derived: DerivedFacts,
  imported: Partial<Record<keyof DerivedFacts, unknown>>,
): FactDivergence[] {
  const out: FactDivergence[] = [];
  const check = (key: keyof DerivedFacts) => {
    if (imported[key] === undefined || imported[key] === null) return;
    if (imported[key] !== derived[key]) {
      out.push({
        key,
        importedValue: imported[key],
        derivedValue: derived[key],
        message: `Divergence sur « ${key} » : valeur importée ${JSON.stringify(imported[key])} ≠ valeur dérivée ${JSON.stringify(derived[key])} (source unique : dates primitives).`,
      });
    }
  };
  (Object.keys(derived) as (keyof DerivedFacts)[]).forEach(check);
  return out;
}
