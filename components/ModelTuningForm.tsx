"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { updateModelTuning } from "@/server/actions/model";
import { SEGMENTS, ZONES } from "@/lib/domain/referentiels";

export interface ModelTuningInitial {
  versionId: string;
  thresholds: { go: number; goWithConditions: number; watchList: number };
  segmentAdjustments: Record<string, number>;
  zoneAdjustments: Record<string, number>;
  redFlags: { id: string; code: string; name: string; malus: number }[];
}

export function ModelTuningForm({ initial }: { initial: ModelTuningInitial }) {
  const router = useRouter();
  const [go, setGo] = useState(String(initial.thresholds.go));
  const [gwc, setGwc] = useState(String(initial.thresholds.goWithConditions));
  const [wl, setWl] = useState(String(initial.thresholds.watchList));
  const [seg, setSeg] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial.segmentAdjustments).map(([k, v]) => [k, String(v)])),
  );
  const [zone, setZone] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial.zoneAdjustments).map(([k, v]) => [k, String(v)])),
  );
  const [malus, setMalus] = useState<Record<string, string>>(
    Object.fromEntries(initial.redFlags.map((r) => [r.id, String(r.malus)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const num = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMsg(null); setPending(true);
    try {
      const res = await updateModelTuning({
        versionId: initial.versionId,
        go: Number(go), goWithConditions: Number(gwc), watchList: Number(wl),
        segmentAdjustments: num(seg), zoneAdjustments: num(zone), redFlagMalus: num(malus),
      });
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Paramètres invalides.");
        return;
      }
      setMsg("Paramétrage enregistré. Appliqué au prochain scoring.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const inp = "w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  const adj = "w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <Card>
      <CardHeader><CardTitle>Paramétrage du modèle (édition)</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">Seuils de décision (score final 0..100)</p>
            <div className="flex flex-wrap gap-4">
              <label className="text-sm space-y-1"><span className="text-muted-foreground block">GO ≥</span><input type="number" value={go} onChange={(e) => setGo(e.target.value)} className={inp} /></label>
              <label className="text-sm space-y-1"><span className="text-muted-foreground block">Sous conditions ≥</span><input type="number" value={gwc} onChange={(e) => setGwc(e.target.value)} className={inp} /></label>
              <label className="text-sm space-y-1"><span className="text-muted-foreground block">Surveillance ≥</span><input type="number" value={wl} onChange={(e) => setWl(e.target.value)} className={inp} /></label>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-medium mb-2">Ajustements segment (α)</p>
              <div className="space-y-1">
                {Object.keys(seg).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{SEGMENTS.labelOf(k)}</span>
                    <input type="number" step="0.01" value={seg[k]} onChange={(e) => setSeg((s) => ({ ...s, [k]: e.target.value }))} className={adj} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Ajustements zone (β)</p>
              <div className="space-y-1">
                {Object.keys(zone).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{ZONES.labelOf(k)}</span>
                    <input type="number" step="0.01" value={zone[k]} onChange={(e) => setZone((s) => ({ ...s, [k]: e.target.value }))} className={adj} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Malus des red flags (D5)</p>
            <div className="grid sm:grid-cols-2 gap-1">
              {initial.redFlags.map((r) => (
                <label key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground truncate" title={r.name}>{r.name}</span>
                  <input type="number" min={0} value={malus[r.id]} onChange={(e) => setMalus((s) => ({ ...s, [r.id]: e.target.value }))} className={adj} />
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le paramétrage"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
