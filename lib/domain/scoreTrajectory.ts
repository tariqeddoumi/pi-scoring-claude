// Trajectoire du score d'un projet re-scoré périodiquement : alerte précoce
// avant que la décision ne se dégrade (baisse cumulée, baisses consécutives,
// passage sous un seuil), et neutralisation des écarts dus à un changement de
// version du modèle (v4 → v5 : écart de méthode, pas de risque).

import type { Decision } from "./types";

export interface TrajectoryPoint {
  scoreFinal: number | null;
  decision: Decision | null;
  modelVersion?: string | null;
}

const RANK: Record<Decision, number> = { GO: 4, GO_WITH_CONDITIONS: 3, WATCH_LIST: 2, NO_GO: 1, DOSSIER_INCOMPLET: 0 };
/** Baisse cumulée sur les 3 derniers runs comparables déclenchant une alerte précoce. */
export const CUMULATIVE_DROP_ALERT = 5;
/** Marge au-dessus d'un seuil de décision en deçà de laquelle on signale la proximité. */
export const THRESHOLD_MARGIN = 2;

export interface Trajectory {
  delta: number | null;
  comparable: boolean;
  cumulativeDrop: number | null;
  consecutiveDeclines: number;
  decisionDowngrade: boolean;
  nearThreshold: number | null;
  level: "STABLE" | "VIGILANCE" | "ALERTE";
  reasons: string[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function scoreTrajectory(
  runs: TrajectoryPoint[],
  thresholds: { go: number; goWithConditions: number; watchList: number } = { go: 75, goWithConditions: 65, watchList: 50 },
): Trajectory {
  const scored = runs.filter((r): r is TrajectoryPoint & { scoreFinal: number } => r.scoreFinal != null);
  const latest = scored[scored.length - 1];
  const previous = scored[scored.length - 2];
  const reasons: string[] = [];
  const out: Trajectory = { delta: null, comparable: true, cumulativeDrop: null, consecutiveDeclines: 0, decisionDowngrade: false, nearThreshold: null, level: "STABLE", reasons };
  if (!latest) return out;

  // Série comparable : runs de la même version que le dernier (absence de version = comparable).
  const same = (r: TrajectoryPoint) => !latest.modelVersion || !r.modelVersion || r.modelVersion === latest.modelVersion;
  const series = scored.filter(same);
  if (previous) {
    out.delta = r1(latest.scoreFinal - previous.scoreFinal);
    out.comparable = same(previous);
    if (!out.comparable) reasons.push(`Changement de modèle (${previous.modelVersion} → ${latest.modelVersion}) : l'écart avec le run précédent reflète la méthode, pas le risque.`);
  }
  for (let i = series.length - 1; i > 0 && series[i]!.scoreFinal < series[i - 1]!.scoreFinal; i--) out.consecutiveDeclines++;
  const window = series.slice(-3);
  if (window.length >= 2) {
    const peak = Math.max(...window.map((r) => r.scoreFinal));
    out.cumulativeDrop = r1(peak - latest.scoreFinal);
  }
  const prevComparable = series[series.length - 2];
  if (prevComparable?.decision && latest.decision && latest.decision !== "DOSSIER_INCOMPLET" && prevComparable.decision !== "DOSSIER_INCOMPLET"
    && RANK[latest.decision] < RANK[prevComparable.decision]) {
    out.decisionDowngrade = true;
    reasons.push("La décision s'est dégradée depuis le run précédent.");
  }
  if ((out.cumulativeDrop ?? 0) >= CUMULATIVE_DROP_ALERT) reasons.push(`Baisse de ${out.cumulativeDrop} pts sur les ${window.length} derniers runs.`);
  if (out.consecutiveDeclines >= 2) reasons.push(`${out.consecutiveDeclines} baisses consécutives.`);
  for (const t of [thresholds.go, thresholds.goWithConditions, thresholds.watchList]) {
    if (latest.scoreFinal >= t && latest.scoreFinal < t + THRESHOLD_MARGIN) {
      out.nearThreshold = t;
      reasons.push(`Score à moins de ${THRESHOLD_MARGIN} pts du seuil de décision ${t}.`);
      break;
    }
  }
  out.level = out.decisionDowngrade || (out.cumulativeDrop ?? 0) >= CUMULATIVE_DROP_ALERT ? "ALERTE"
    : out.consecutiveDeclines >= 2 || (out.nearThreshold !== null && (out.delta ?? 0) < 0) ? "VIGILANCE" : "STABLE";
  return out;
}
