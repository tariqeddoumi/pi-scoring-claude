"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { reviseBusinessPlan } from "@/server/actions/projects";
import { STANDINGS } from "@/lib/domain/referentiels";

export interface RevisionUnit {
  id: string;
  reference: string;
  trancheCode: string;
  plannedStanding: string;
  plannedPrice: number | null;
  plannedSaleDate: Date | string | null;
}

interface ChangeRow { unitId: string; newStanding: string; newPrice: string; newSaleDate: string }

const emptyRow = (): ChangeRow => ({ unitId: "", newStanding: "", newPrice: "", newSaleDate: "" });
const toDateInput = (d: Date | string | null) => (d ? String(d).slice(0, 10) : "");

export function BusinessPlanRevisionForm({ projectId, units }: { projectId: string; units: RevisionUnit[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<ChangeRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const byId = new Map(units.map((u) => [u.id, u]));
  const setRow = (i: number, patch: Partial<ChangeRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // À la sélection d'un lot, pré-remplit les champs avec la baseline courante.
  function onPickUnit(i: number, unitId: string) {
    const u = byId.get(unitId);
    setRow(i, {
      unitId,
      newStanding: u?.plannedStanding ?? "",
      newPrice: u?.plannedPrice != null ? String(u.plannedPrice) : "",
      newSaleDate: toDateInput(u?.plannedSaleDate ?? null),
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const changes = rows
        .filter((r) => r.unitId)
        .map((r) => ({
          unitId: r.unitId,
          newStanding: r.newStanding || undefined,
          newPrice: r.newPrice === "" ? undefined : Number(r.newPrice),
          newSaleDate: r.newSaleDate || undefined,
        }));
      if (changes.length === 0) { setError("Sélectionnez au moins un lot."); return; }
      const res = await reviseBusinessPlan({ projectId, reason, changes });
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Révision invalide (vérifiez les champs).");
        return;
      }
      setReason(""); setRows([emptyRow()]); setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const inp = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Réviser le business plan</Button>;

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Réviser le business plan</p>
      <p className="text-xs text-muted-foreground">Le BP d'origine est conservé pour audit ; la dérive vs origine est tracée. Modifiez standing, prix cible et/ou date de vente prévue.</p>

      <label className="block text-sm space-y-1">
        <span className="font-medium">Motif de la révision *</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inp} required placeholder="Ex. : repositionnement marché, retard de chantier, révision commerciale…" />
      </label>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid sm:grid-cols-4 gap-2 items-end">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Lot</span>
              <select value={r.unitId} onChange={(e) => onPickUnit(i, e.target.value)} className={inp}>
                <option value="">— Sélectionner —</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.trancheCode} · {u.reference}</option>)}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Nouveau standing</span>
              <select value={r.newStanding} onChange={(e) => setRow(i, { newStanding: e.target.value })} className={inp} disabled={!r.unitId}>
                {STANDINGS.items.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Nouveau prix cible (MAD)</span>
              <input type="number" min={0} value={r.newPrice} onChange={(e) => setRow(i, { newPrice: e.target.value })} className={inp} disabled={!r.unitId} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Nouvelle date de vente</span>
              <input type="date" value={r.newSaleDate} onChange={(e) => setRow(i, { newSaleDate: e.target.value })} className={inp} disabled={!r.unitId} />
            </label>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, emptyRow()])}>+ Ajouter un lot</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la révision"}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </form>
  );
}
