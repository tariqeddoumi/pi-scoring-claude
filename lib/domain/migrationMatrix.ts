// =====================================================================
//  Matrice de migration des notes (classes réglementaires BKAM).
//  Logique pure : à partir de séquences de classes par dossier (triées dans
//  le temps), construit la matrice des transitions classe→classe et les
//  indicateurs d'amélioration / stabilité / dégradation.
// =====================================================================

// Ordre de sévérité croissante (index = rang de risque).
export const MIGRATION_CLASS_ORDER = [
  "SAIN",
  "SENSIBLE",
  "PRE_DOUTEUX",
  "DOUTEUX",
  "COMPROMIS",
  "CTX",
] as const;

export type MigClass = (typeof MIGRATION_CLASS_ORDER)[number];

export interface Transition {
  from: MigClass;
  to: MigClass;
}

export interface MigrationMatrix {
  order: readonly MigClass[];
  counts: Record<MigClass, Record<MigClass, number>>;
  rowTotals: Record<MigClass, number>;
  /** Taux (%) au sein de chaque ligne (probabilité de migration empirique). */
  rates: Record<MigClass, Record<MigClass, number>>;
  totalTransitions: number;
  stable: number;
  upgrades: number; // vers une classe moins sévère
  downgrades: number; // vers une classe plus sévère
}

/** Rang de sévérité (0 = SAIN … 5 = CTX). -1 si classe inconnue. */
export function severityRank(c: string): number {
  return (MIGRATION_CLASS_ORDER as readonly string[]).indexOf(c);
}

function isMigClass(c: string): c is MigClass {
  return severityRank(c) >= 0;
}

/** Transitions consécutives d'une séquence de classes d'un même dossier. */
export function pairConsecutive(sequence: string[]): Transition[] {
  const seq = sequence.filter(isMigClass) as MigClass[];
  const out: Transition[] = [];
  for (let i = 1; i < seq.length; i++) {
    out.push({ from: seq[i - 1]!, to: seq[i]! });
  }
  return out;
}

function emptyGrid(): Record<MigClass, Record<MigClass, number>> {
  const grid = {} as Record<MigClass, Record<MigClass, number>>;
  for (const from of MIGRATION_CLASS_ORDER) {
    grid[from] = {} as Record<MigClass, number>;
    for (const to of MIGRATION_CLASS_ORDER) grid[from][to] = 0;
  }
  return grid;
}

export function buildMigrationMatrix(transitions: Transition[]): MigrationMatrix {
  const counts = emptyGrid();
  const rowTotals = Object.fromEntries(
    MIGRATION_CLASS_ORDER.map((c) => [c, 0]),
  ) as Record<MigClass, number>;

  let stable = 0;
  let upgrades = 0;
  let downgrades = 0;

  for (const t of transitions) {
    counts[t.from][t.to] += 1;
    rowTotals[t.from] += 1;
    const delta = severityRank(t.to) - severityRank(t.from);
    if (delta === 0) stable += 1;
    else if (delta < 0) upgrades += 1;
    else downgrades += 1;
  }

  const rates = emptyGrid();
  for (const from of MIGRATION_CLASS_ORDER) {
    const total = rowTotals[from];
    for (const to of MIGRATION_CLASS_ORDER) {
      rates[from][to] = total > 0 ? (counts[from][to] / total) * 100 : 0;
    }
  }

  return {
    order: MIGRATION_CLASS_ORDER,
    counts,
    rowTotals,
    rates,
    totalTransitions: transitions.length,
    stable,
    upgrades,
    downgrades,
  };
}

/**
 * Construit la matrice à partir des séquences par dossier (déjà triées du plus
 * ancien au plus récent).
 */
export function migrationMatrixFromSequences(
  sequencesByProject: string[][],
): MigrationMatrix {
  const transitions = sequencesByProject.flatMap(pairConsecutive);
  return buildMigrationMatrix(transitions);
}
