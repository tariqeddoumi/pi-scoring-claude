import { cn } from "@/lib/utils";

/** Jauge de score 0..100 avec code couleur métier. */
export function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const color =
    pct >= 70 ? "text-emerald-600" : pct >= 55 ? "text-lime-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
  const ring =
    pct >= 70 ? "stroke-emerald-500" : pct >= 55 ? "stroke-lime-500" : pct >= 40 ? "stroke-amber-500" : "stroke-red-500";
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} className="fill-none stroke-muted" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          className={cn("fill-none transition-all", ring)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="-mt-[88px] flex flex-col items-center">
        <span className={cn("text-3xl font-bold", color)}>{pct.toFixed(0)}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      {label && <div className="mt-12 text-sm text-muted-foreground">{label}</div>}
    </div>
  );
}
