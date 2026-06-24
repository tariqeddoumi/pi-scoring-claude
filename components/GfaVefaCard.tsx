"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { updateGfaVefa } from "@/server/actions/projects";
import { computeGfaRelief } from "@/lib/domain/gfaVefa";
import { formatMAD } from "@/lib/utils";

interface Props {
  projectId: string;
  assetType: "PROMOTION" | "EXPLOITATION";
  saleMode: "CLASSIC" | "VEFA";
  hasGFA: boolean;
  gfaAmount: number | null;
  gfaProvider: string | null;
  exposure: number; // EAD (loanAmount) pour l'effet indicatif
  canEdit: boolean;
}

export function GfaVefaCard(p: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    assetType: p.assetType,
    saleMode: p.saleMode,
    hasGFA: p.hasGFA,
    gfaAmount: p.gfaAmount != null ? String(p.gfaAmount) : "",
    gfaProvider: p.gfaProvider ?? "",
  });

  const relief = computeGfaRelief({
    saleMode: p.saleMode,
    hasGFA: p.hasGFA,
    gfaAmount: p.gfaAmount,
    exposure: p.exposure,
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await updateGfaVefa(p.projectId, form);
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Données invalides.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const input = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 flex-wrap">
            Commercialisation & GFA
            <Badge className={p.assetType === "EXPLOITATION" ? "bg-orange-100 text-orange-800 border-orange-300" : "bg-slate-100 text-slate-700 border-slate-300"}>
              {p.assetType === "EXPLOITATION" ? "Actif d'exploitation" : "Promotion"}
            </Badge>
            <Badge className={p.saleMode === "VEFA" ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-slate-100 text-slate-700 border-slate-300"}>
              {p.saleMode === "VEFA" ? "VEFA (sur plan)" : "Vente classique"}
            </Badge>
          </span>
          {p.canEdit && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>Modifier</Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!editing ? (
          <>
            {p.assetType === "EXPLOITATION" && (
              <p className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-orange-900 text-xs">
                Actif d'exploitation (ex. hôtel) : le modèle de scoring promotion est indicatif et
                cette composante est exclue de la note consolidée de programme.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={p.hasGFA ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                {p.hasGFA ? "GFA en place" : "Sans GFA"}
              </Badge>
              {p.hasGFA && p.gfaAmount != null && <span>Montant garanti : <span className="font-medium">{formatMAD(p.gfaAmount)}</span></span>}
              {p.hasGFA && p.gfaProvider && <span className="text-muted-foreground">Garant : {p.gfaProvider}</span>}
            </div>
            {relief.applicable ? (
              <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-900">
                Effet sur l'assiette de provisionnement : <span className="font-semibold">−{formatMAD(relief.admittedValue)}</span>
                <span className="text-emerald-700"> ({relief.note}{relief.cappedByExposure ? ", plafonné à l'exposition" : ""})</span>
              </p>
            ) : (
              <p className="text-muted-foreground">{relief.note} — aucune déduction de l'assiette.</p>
            )}
          </>
        ) : (
          <form onSubmit={onSave} className="space-y-3">
            <label className="space-y-1 block"><span className="font-medium">Nature de l'actif</span>
              <select value={form.assetType} onChange={(e) => setForm((f) => ({ ...f, assetType: e.target.value as Props["assetType"] }))} className={input}>
                <option value="PROMOTION">Promotion (vente)</option>
                <option value="EXPLOITATION">Actif d'exploitation (hôtel…)</option>
              </select>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1"><span className="font-medium">Mode de vente</span>
                <select value={form.saleMode} onChange={(e) => setForm((f) => ({ ...f, saleMode: e.target.value as Props["saleMode"] }))} className={input}>
                  <option value="CLASSIC">Vente classique</option>
                  <option value="VEFA">VEFA (vente sur plan)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input type="checkbox" checked={form.hasGFA} onChange={(e) => setForm((f) => ({ ...f, hasGFA: e.target.checked }))} />
                <span className="font-medium">GFA en place</span>
              </label>
            </div>
            {form.hasGFA && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1"><span className="font-medium">Montant garanti (MAD)</span>
                  <input type="number" value={form.gfaAmount} onChange={(e) => setForm((f) => ({ ...f, gfaAmount: e.target.value }))} className={input} />
                </label>
                <label className="space-y-1"><span className="font-medium">Établissement garant</span>
                  <input type="text" value={form.gfaProvider} onChange={(e) => setForm((f) => ({ ...f, gfaProvider: e.target.value }))} className={input} />
                </label>
              </div>
            )}
            {error && <p className="text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
            </div>
            <p className="text-xs text-muted-foreground">L'effet sur le provisionnement s'applique au prochain calcul de scoring.</p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
