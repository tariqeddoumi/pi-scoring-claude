"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { Field, FieldGroup, FormMessage, Input, Select, Textarea, readActionErrors, type FieldErrors } from "@/components/form";
import { upsertPromoter } from "@/server/actions/promoters";
import { LEGAL_FORMS, CITIES, INTERNAL_RATINGS, withLegacyValue, type RefItem } from "@/lib/domain/referentiels";

export interface PromoterFormInitial {
  id?: string;
  name?: string;
  legalForm?: string | null;
  rcNumber?: string | null;
  iceNumber?: string | null;
  ifNumber?: string | null;
  cnssNumber?: string | null;
  patenteNumber?: string | null;
  capital?: number | null;
  foundedYear?: number | null;
  managerName?: string | null;
  shareholders?: string | null;
  address?: string | null;
  city?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  yearsExperience?: number | null;
  completedProjects?: number | null;
  internalRating?: string | null;
  bankRelations?: string | null;
  notes?: string | null;
  groupId?: string | null;
}

const str = (v: unknown) => (v == null ? "" : String(v));

export function PromoterForm({ groups, initial }: {
  groups: { id: string; name: string }[];
  initial?: PromoterFormInitial;
}) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    name: str(initial?.name),
    legalForm: str(initial?.legalForm),
    rcNumber: str(initial?.rcNumber),
    iceNumber: str(initial?.iceNumber),
    ifNumber: str(initial?.ifNumber),
    cnssNumber: str(initial?.cnssNumber),
    patenteNumber: str(initial?.patenteNumber),
    capital: str(initial?.capital),
    foundedYear: str(initial?.foundedYear),
    managerName: str(initial?.managerName),
    shareholders: str(initial?.shareholders),
    address: str(initial?.address),
    city: str(initial?.city),
    website: str(initial?.website),
    contactEmail: str(initial?.contactEmail),
    contactPhone: str(initial?.contactPhone),
    yearsExperience: str(initial?.yearsExperience),
    completedProjects: str(initial?.completedProjects),
    internalRating: str(initial?.internalRating),
    bankRelations: str(initial?.bankRelations),
    notes: str(initial?.notes),
    groupId: str(initial?.groupId),
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
      const res = await upsertPromoter({ ...form, id: initial?.id });
      if (res && !res.ok) {
        const r = readActionErrors(res);
        setErrs(r.fieldErrors);
        setError(r.message);
      }
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw err;
      setError("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setPending(false);
    }
  }

  const bind = (k: keyof typeof form) => ({ value: form[k], onChange: set(k) });
  const opts = (items: readonly RefItem[]) => items.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Card>
      <CardHeader><CardTitle>{isEdit ? "Éditer la signalétique" : "Nouveau promoteur"}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <FieldGroup title="Identification">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Raison sociale" required error={errs.name}><Input {...bind("name")} /></Field>
              <Field label="Forme juridique" error={errs.legalForm}><Select {...bind("legalForm")} options={opts(LEGAL_FORMS.items)} placeholder="— Non renseignée —" /></Field>
              <Field label="Registre de commerce (RC)" error={errs.rcNumber}><Input {...bind("rcNumber")} /></Field>
              <Field label="ICE" error={errs.iceNumber} hint="Identifiant commun de l'entreprise (15 chiffres)."><Input {...bind("iceNumber")} inputMode="numeric" /></Field>
              <Field label="Identifiant fiscal (IF)" error={errs.ifNumber}><Input {...bind("ifNumber")} /></Field>
              <Field label="CNSS" error={errs.cnssNumber}><Input {...bind("cnssNumber")} /></Field>
              <Field label="Patente" error={errs.patenteNumber}><Input {...bind("patenteNumber")} /></Field>
              <Field label="Capital social (MAD)" error={errs.capital}><Input type="number" min={0} inputMode="decimal" {...bind("capital")} /></Field>
              <Field label="Année de création" error={errs.foundedYear}><Input type="number" min={1900} max={2100} inputMode="numeric" {...bind("foundedYear")} /></Field>
              <Field label="Dirigeant principal" error={errs.managerName}><Input {...bind("managerName")} /></Field>
            </div>
            <Field label="Actionnariat" error={errs.shareholders}><Textarea {...bind("shareholders")} rows={2} placeholder="Ex. M. X 60 %, Société Y 40 %" /></Field>
          </FieldGroup>

          <FieldGroup title="Coordonnées">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Adresse (siège)" error={errs.address}><Input {...bind("address")} /></Field>
              <Field label="Ville" error={errs.city}><Select {...bind("city")} options={opts(withLegacyValue(CITIES.items, form.city))} placeholder="— Sélectionner —" /></Field>
              <Field label="Email" error={errs.contactEmail}><Input type="email" autoComplete="email" {...bind("contactEmail")} /></Field>
              <Field label="Téléphone" error={errs.contactPhone}><Input type="tel" autoComplete="tel" {...bind("contactPhone")} /></Field>
              <Field label="Site web" error={errs.website}><Input inputMode="url" {...bind("website")} placeholder="www.exemple.ma" /></Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Expérience & relation">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Années d'expérience" error={errs.yearsExperience}><Input type="number" min={0} inputMode="numeric" {...bind("yearsExperience")} /></Field>
              <Field label="Projets réalisés" error={errs.completedProjects}><Input type="number" min={0} inputMode="numeric" {...bind("completedProjects")} /></Field>
              <Field label="Notation interne" error={errs.internalRating}><Select {...bind("internalRating")} options={opts(withLegacyValue(INTERNAL_RATINGS.items, form.internalRating))} placeholder="— Non notée —" /></Field>
              <Field label="Groupe d'intérêt" error={errs.groupId} className="sm:col-span-3">
                <Select {...bind("groupId")} options={groups.map((g) => ({ value: g.id, label: g.name }))} placeholder="— Aucun —" />
              </Field>
            </div>
            <Field label="Autres relations bancaires" error={errs.bankRelations}><Textarea {...bind("bankRelations")} rows={2} /></Field>
            <Field label="Notes" error={errs.notes}><Textarea {...bind("notes")} rows={3} /></Field>
          </FieldGroup>

          <FormMessage error={error} />
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer le promoteur"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
