"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { Field, FieldGroup, FormMessage, Input, Select, Textarea, readActionErrors, type FieldErrors } from "@/components/form";
import { upsertProject } from "@/server/actions/projects";
import {
  SEGMENTS, ZONES, ASSET_TYPES, PROJECT_TYPES, PROJECT_STATUSES, SALE_MODES,
  LAND_STATUSES, CITIES, MOROCCO_REGIONS, withLegacyValue, type RefItem,
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
  coreBankingRef?: string | null;
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
    coreBankingRef: str(initial?.coreBankingRef),
  });
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrs({});
    setPending(true);
    try {
      const res = await upsertProject({ ...form, id: initial?.id });
      // En cas de succès, l'action redirige (pas de retour). Un retour = erreur.
      if (res && !res.ok) {
        const r = readActionErrors(res);
        setErrs(r.fieldErrors);
        setError(r.message);
      }
    } catch (err) {
      // NEXT_REDIRECT est relancé par Next pour effectuer la navigation : ne pas l'avaler.
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw err;
      setError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setPending(false);
    }
  }

  // Propriétés communes d'un contrôle lié à une clé du formulaire.
  const bind = (k: keyof typeof form) => ({ value: form[k], onChange: set(k) });
  const opts = (items: readonly RefItem[]) => items.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Card>
      <CardHeader><CardTitle>{isEdit ? "Éditer le projet" : "Nouveau projet"}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <FieldGroup title="Identification">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Référence" required error={errs.reference}><Input {...bind("reference")} placeholder="PI-2026-XXX" /></Field>
              <Field label="Nom du projet" required error={errs.name}><Input {...bind("name")} /></Field>
              <Field label="Promoteur" required error={errs.promoterId}
                hint={<>Promoteur absent ? <Link href="/promoters/new" className="text-primary hover:underline">Créer sa signalétique</Link></>}>
                <Select {...bind("promoterId")} options={options.promoters.map((p) => ({ value: p.id, label: p.name }))} placeholder="— Sélectionner —" />
              </Field>
              <Field label="Chargé d'affaires" error={errs.rmId}>
                <Select {...bind("rmId")} options={options.managers.map((m) => ({ value: m.id, label: m.name }))} placeholder="— Aucun —" />
              </Field>
              <Field label="Groupe d'intérêt (effet groupe BKAM)" error={errs.groupId}>
                <Select {...bind("groupId")} options={options.groups.map((g) => ({ value: g.id, label: g.name }))} placeholder="— Aucun —" />
              </Field>
              <Field label="Statut du dossier" error={errs.status}><Select {...bind("status")} options={opts(PROJECT_STATUSES.items)} /></Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Localisation">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Ville" error={errs.city}><Select {...bind("city")} options={opts(withLegacyValue(CITIES.items, form.city))} placeholder="— Sélectionner —" /></Field>
              <Field label="Région" error={errs.region} hint="Région administrative : sert à la tension du marché régional (v5).">
                <Select {...bind("region")} options={opts(withLegacyValue(MOROCCO_REGIONS.items, form.region))} placeholder="— Sélectionner —" />
              </Field>
              <Field label="Zone (modèle)" error={errs.zone}><Select {...bind("zone")} options={opts(ZONES.items)} placeholder="— Non renseignée —" /></Field>
            </div>
            <Field label="Adresse / lieu-dit" error={errs.address}><Input {...bind("address")} /></Field>
          </FieldGroup>

          <FieldGroup title="Caractéristiques du programme">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Nature de l'actif" error={errs.assetType}><Select {...bind("assetType")} options={opts(ASSET_TYPES.items)} /></Field>
              <Field label="Type de projet" error={errs.projectType}><Select {...bind("projectType")} options={opts(PROJECT_TYPES.items)} placeholder="— Non renseigné —" /></Field>
              <Field label="Segment (modèle)" error={errs.segment}><Select {...bind("segment")} options={opts(SEGMENTS.items)} placeholder="— Non renseigné —" /></Field>
              <Field label="Nombre de lots" error={errs.totalUnits}><Input type="number" min={0} inputMode="numeric" {...bind("totalUnits")} /></Field>
              <Field label="Surface terrain (m²)" error={errs.landAreaSqm}><Input type="number" min={0} inputMode="decimal" {...bind("landAreaSqm")} /></Field>
              <Field label="Surface construite (m²)" error={errs.builtAreaSqm}><Input type="number" min={0} inputMode="decimal" {...bind("builtAreaSqm")} /></Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Foncier & autorisations">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Titre(s) foncier(s)" error={errs.landTitleRef}><Input {...bind("landTitleRef")} placeholder="Ex. TF 12345/C" /></Field>
              <Field label="Statut foncier" error={errs.landStatus}><Select {...bind("landStatus")} options={opts(LAND_STATUSES.items)} placeholder="— Non renseigné —" /></Field>
              <Field label="Autorisation de construire (n°)" error={errs.buildPermitRef}><Input {...bind("buildPermitRef")} /></Field>
              <Field label="Date de l'autorisation" error={errs.buildPermitDate}><Input type="date" {...bind("buildPermitDate")} /></Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Calendrier prévisionnel">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Démarrage des travaux" error={errs.startDate}><Input type="date" {...bind("startDate")} /></Field>
              <Field label="Livraison prévue" error={errs.expectedDeliveryDate}><Input type="date" {...bind("expectedDeliveryDate")} /></Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Plan de financement">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Coût total (MAD)" error={errs.totalCost}><Input type="number" min={0} inputMode="decimal" {...bind("totalCost")} /></Field>
              <Field label="Crédit sollicité (MAD)" error={errs.loanAmount}><Input type="number" min={0} inputMode="decimal" {...bind("loanAmount")} /></Field>
              <Field label="Fonds propres (MAD)" error={errs.ownEquity}><Input type="number" min={0} inputMode="decimal" {...bind("ownEquity")} /></Field>
              <Field label="Mode de vente" error={errs.saleMode}><Select {...bind("saleMode")} options={opts(SALE_MODES.items)} /></Field>
              <Field label="Référence SI (T24/Evolan)" error={errs.coreBankingRef} hint="Clé de synchronisation des déblocages, encours et impayés.">
                <Input {...bind("coreBankingRef")} placeholder="N° dossier dans le SI" />
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Description">
            <Field label="Consistance du programme, points d'attention" error={errs.description}><Textarea {...bind("description")} rows={4} /></Field>
          </FieldGroup>

          <FormMessage error={error} />
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer le projet"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
