"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { upsertProject } from "@/server/actions/projects";
import {
  SEGMENTS, ZONES, ASSET_TYPES, PROJECT_TYPES, PROJECT_STATUSES, SALE_MODES,
  LAND_STATUSES, type RefItem,
} from "@/lib/domain/referentiels";

type Options = {
  promoters: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  groups: { id: string; name: string }[];
};

export interface ProjectFormInitial {
  id?: string;
  reference?: string;
  name?: string;
  promoterId?: string;
  rmId?: string | null;
  assetType?: string;
  city?: string | null;
  region?: string | null;
  projectType?: string | null;
  segment?: string | null;
  zone?: string | null;
  status?: string | null;
  saleMode?: string;
  totalUnits?: number | null;
  totalCost?: number | null;
  loanAmount?: number | null;
  ownEquity?: number | null;
  groupId?: string | null;
  address?: string | null;
  landAreaSqm?: number | null;
  builtAreaSqm?: number | null;
  landTitleRef?: string | null;
  landStatus?: string | null;
  buildPermitRef?: string | null;
  buildPermitDate?: Date | string | null;
  startDate?: Date | string | null;
  expectedDeliveryDate?: Date | string | null;
  description?: string | null;
}

const str = (v: unknown) => (v == null ? "" : String(v));
const day = (v?: Date | string | null) => {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

export function ProjectForm({ options, initial }: { options: Options; initial?: ProjectFormInitial }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    reference: str(initial?.reference),
    name: str(initial?.name),
    promoterId: str(initial?.promoterId),
    rmId: str(initial?.rmId),
    assetType: initial?.assetType ?? "PROMOTION",
    city: str(initial?.city),
    region: str(initial?.region),
    projectType: str(initial?.projectType),
    segment: str(initial?.segment),
    zone: str(initial?.zone),
    status: initial?.status ?? "PROSPECT",
    saleMode: initial?.saleMode ?? "CLASSIC",
    totalUnits: str(initial?.totalUnits),
    totalCost: str(initial?.totalCost),
    loanAmount: str(initial?.loanAmount),
    ownEquity: str(initial?.ownEquity),
    groupId: str(initial?.groupId),
    address: str(initial?.address),
    landAreaSqm: str(initial?.landAreaSqm),
    builtAreaSqm: str(initial?.builtAreaSqm),
    landTitleRef: str(initial?.landTitleRef),
    landStatus: str(initial?.landStatus),
    buildPermitRef: str(initial?.buildPermitRef),
    buildPermitDate: day(initial?.buildPermitDate),
    startDate: day(initial?.startDate),
    expectedDeliveryDate: day(initial?.expectedDeliveryDate),
    description: str(initial?.description),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await upsertProject({ ...form, id: initial?.id });
      // En cas de succès, l'action redirige (pas de retour). Un retour = erreur.
      if (res && !res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Champs invalides — vérifiez le formulaire.");
      }
    } catch (err) {
      // NEXT_REDIRECT est relancé par Next pour effectuer la navigation : ne pas l'avaler.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw err;
      setError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setPending(false);
    }
  }

  const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  const Select = ({ k, items, placeholder }: { k: keyof typeof form; items: readonly RefItem[]; placeholder?: string }) => (
    <select value={form[k]} onChange={set(k)} className={inp}>
      {placeholder && <option value="">{placeholder}</option>}
      {items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle>{isEdit ? "Éditer le projet" : "Nouveau projet"}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <Section title="Identification">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Référence *</span>
                <input value={form.reference} onChange={set("reference")} className={inp} required placeholder="PI-2026-XXX" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Nom du projet *</span>
                <input value={form.name} onChange={set("name")} className={inp} required /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Promoteur *</span>
                <Select k="promoterId" items={options.promoters.map((p) => ({ value: p.id, label: p.name }))} placeholder="— Sélectionner —" />
                <span className="block text-xs text-muted-foreground">
                  Promoteur absent ? <Link href="/promoters/new" className="text-primary hover:underline">Créer sa signalétique</Link>
                </span></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Chargé d&apos;affaires</span>
                <Select k="rmId" items={options.managers.map((m) => ({ value: m.id, label: m.name }))} placeholder="— Aucun —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Groupe d&apos;intérêt (effet groupe BKAM)</span>
                <Select k="groupId" items={options.groups.map((g) => ({ value: g.id, label: g.name }))} placeholder="— Aucun —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Statut du dossier</span><Select k="status" items={PROJECT_STATUSES.items} /></label>
            </div>
          </Section>

          <Section title="Localisation">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Ville</span><input value={form.city} onChange={set("city")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Région</span><input value={form.region} onChange={set("region")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Zone (modèle)</span><Select k="zone" items={ZONES.items} placeholder="— Non renseignée —" /></label>
            </div>
            <label className="space-y-1 text-sm block"><span className="font-medium">Adresse / lieu-dit</span>
              <input value={form.address} onChange={set("address")} className={inp} /></label>
          </Section>

          <Section title="Caractéristiques du programme">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Nature de l&apos;actif</span><Select k="assetType" items={ASSET_TYPES.items} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Type de projet</span><Select k="projectType" items={PROJECT_TYPES.items} placeholder="— Non renseigné —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Segment (modèle)</span><Select k="segment" items={SEGMENTS.items} placeholder="— Non renseigné —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Nombre de lots</span><input type="number" min={0} value={form.totalUnits} onChange={set("totalUnits")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Surface terrain (m²)</span><input type="number" min={0} value={form.landAreaSqm} onChange={set("landAreaSqm")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Surface construite (m²)</span><input type="number" min={0} value={form.builtAreaSqm} onChange={set("builtAreaSqm")} className={inp} /></label>
            </div>
          </Section>

          <Section title="Foncier & autorisations">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Titre(s) foncier(s)</span>
                <input value={form.landTitleRef} onChange={set("landTitleRef")} className={inp} placeholder="Ex. TF 12345/C" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Statut foncier</span>
                <Select k="landStatus" items={LAND_STATUSES.items} placeholder="— Non renseigné —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Autorisation de construire (n°)</span>
                <input value={form.buildPermitRef} onChange={set("buildPermitRef")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Date de l&apos;autorisation</span>
                <input type="date" value={form.buildPermitDate} onChange={set("buildPermitDate")} className={inp} /></label>
            </div>
          </Section>

          <Section title="Calendrier prévisionnel">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Démarrage des travaux</span>
                <input type="date" value={form.startDate} onChange={set("startDate")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Livraison prévue</span>
                <input type="date" value={form.expectedDeliveryDate} onChange={set("expectedDeliveryDate")} className={inp} /></label>
            </div>
          </Section>

          <Section title="Plan de financement">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Coût total (MAD)</span><input type="number" min={0} value={form.totalCost} onChange={set("totalCost")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Crédit sollicité (MAD)</span><input type="number" min={0} value={form.loanAmount} onChange={set("loanAmount")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Fonds propres (MAD)</span><input type="number" min={0} value={form.ownEquity} onChange={set("ownEquity")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Mode de vente</span><Select k="saleMode" items={SALE_MODES.items} /></label>
            </div>
          </Section>

          <Section title="Description">
            <label className="space-y-1 text-sm block"><span className="font-medium">Consistance du programme, points d&apos;attention</span>
              <textarea value={form.description} onChange={set("description")} className={inp} rows={4} /></label>
          </Section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer le projet"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
