import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td } from "@/components/ui";
import { DECISION_LABELS, DECISION_COLORS } from "@/lib/labels";
import { formatDate, formatDecimal } from "@/lib/utils";
import type { Decision } from "@/lib/domain/types";
import { scoreTrajectory } from "@/lib/domain/scoreTrajectory";

export interface ScoreRunPoint {
  id: string;
  createdAt: Date | string;
  scoreFinal: number | null;
  decision: Decision | null;
  modelVersion?: string | null;
}

const LEVEL_STYLE = {
  STABLE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  VIGILANCE: "bg-amber-50 text-amber-800 border-amber-300",
  ALERTE: "bg-red-50 text-red-800 border-red-300",
} as const;

// Mini-sparkline SVG (sans dépendance) de l'évolution du score 0..100.
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 240, h = 48, pad = 4;
  const xs = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const ys = (v: number) => h - pad - (Math.max(0, Math.min(100, v)) / 100) * (h - 2 * pad);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line x1={pad} y1={ys(75)} x2={w - pad} y2={ys(75)} stroke="currentColor" strokeWidth={0.5} className="text-emerald-300" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" />
      {points.map((v, i) => <circle key={i} cx={xs(i)} cy={ys(v)} r={2.5} className="fill-primary" />)}
    </svg>
  );
}

/** Évolution du score d'un projet dans le temps (re-scoring à l'avancement). */
export function ScoreTimeline({ runs }: { runs: ScoreRunPoint[] }) {
  const scored = runs.filter((r) => r.scoreFinal != null) as (ScoreRunPoint & { scoreFinal: number })[];
  const latest = scored[scored.length - 1];
  const previous = scored[scored.length - 2];
  const trajectory = scoreTrajectory(runs);
  const delta = latest && previous ? trajectory.delta : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Évolution du score</CardTitle>
          {delta != null && (
            <span className={`text-sm ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-muted-foreground"}`}>
              {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "= "}{formatDecimal(Math.abs(delta), 1)} pts vs run précédent{trajectory.comparable ? "" : " (changement de modèle)"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {scored.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun score calculé pour l'instant.</p>
        ) : (
          <>
            <div className="text-primary"><Sparkline points={scored.map((r) => r.scoreFinal)} /></div>
            {scored.length >= 2 && (
              <div className={`rounded-md border px-3 py-2 text-sm ${LEVEL_STYLE[trajectory.level]}`}>
                <div className="font-medium">
                  Trajectoire : {trajectory.level === "STABLE" ? "stable" : trajectory.level === "VIGILANCE" ? "vigilance" : "alerte précoce"}
                </div>
                {trajectory.reasons.length > 0 && <ul className="list-disc pl-5 text-xs">{trajectory.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}
              </div>
            )}
            <Table>
              <thead><tr><Th>Date</Th><Th>Score</Th><Th>Décision</Th><Th>Modèle</Th></tr></thead>
              <tbody>
                {[...runs].reverse().map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                    <Td className="font-medium">{r.scoreFinal != null ? r.scoreFinal.toFixed(0) : "—"}</Td>
                    <Td>{r.decision ? <Badge className={DECISION_COLORS[r.decision]}>{DECISION_LABELS[r.decision]}</Badge> : "—"}</Td>
                    <Td className="text-xs text-muted-foreground">{r.modelVersion ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
