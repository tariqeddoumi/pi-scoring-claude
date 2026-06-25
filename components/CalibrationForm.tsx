"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { updateRiskCalibration } from "@/server/actions/projects";

interface Values {
  label: string;
  pdStrong: number;
  pdGood: number;
  pdSatisfactory: number;
  pdWeak: number;
  lgdUnsecured: number;
  lgdFloor: number;
  maturityYears: number;
}

// Les PD/LGD sont saisis en pourcentage (plus lisible) puis convertis en ratio.
export function CalibrationForm({ initial, canEdit }: { initial: Values; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    label: initial.label,
    pdStrong: String(initial.pdStrong * 100),
    pdGood: String(initial.pdGood * 100),
    pdSatisfactory: String(initial.pdSatisfactory * 100),
    pdWeak: String(initial.pdWeak * 100),
    lgdUnsecured: String(initial.lgdUnsecured * 100),
    lgdFloor: String(initial.lgdFloor * 100),
    maturityYears: String(initial.maturityYears),
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDone(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        label: form.label,
        pdStrong: Number(form.pdStrong) / 100,
        pdGood: Number(form.pdGood) / 100,
        pdSatisfactory: Number(form.pdSatisfactory) / 100,
        pdWeak: Number(form.pdWeak) / 100,
        lgdUnsecured: Number(form.lgdUnsecured) / 100,
        lgdFloor: Number(form.lgdFloor) / 100,
        maturityYears: Number(form.maturityYears),
      };
      const res = await updateRiskCalibration(payload);
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Valeurs invalides.");
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60";
  const pctField = (label: string, k: keyof typeof form, hint?: string) => (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" step="0.01" value={form[k]} onChange={set(k)} className={input} disabled={!canEdit} />
        <span className="text-muted-foreground">%</span>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="space-y-1 text-sm block max-w-md">
        <span className="font-medium">Libellé du calibrage</span>
        <input type="text" value={form.label} onChange={set("label")} className={input} disabled={!canEdit} />
      </label>

      <div>
        <div className="text-sm font-semibold mb-2">PD par catégorie de slotting (Bâle)</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {pctField("Strong", "pdStrong")}
          {pctField("Good", "pdGood")}
          {pctField("Satisfactory", "pdSatisfactory")}
          {pctField("Weak", "pdWeak")}
        </div>
        <p className="text-xs text-muted-foreground mt-1">La catégorie Default reste à 100% (créance en défaut), non calibrable.</p>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">LGD & maturité</div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {pctField("LGD non garantie", "lgdUnsecured", "réf. FIRB Bâle 45%")}
          {pctField("Plancher LGD", "lgdFloor", "exposition pleinement couverte")}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Maturité (PD lifetime)</span>
            <div className="flex items-center gap-1">
              <input type="number" step="0.5" value={form.maturityYears} onChange={set("maturityYears")} className={input} disabled={!canEdit} />
              <span className="text-muted-foreground">ans</span>
            </div>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-emerald-600">Calibrage enregistré.</p>}
      {canEdit ? (
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le calibrage"}</Button>
      ) : (
        <p className="text-sm text-muted-foreground">Lecture seule — l'édition requiert la permission d'administration du modèle.</p>
      )}
    </form>
  );
}
