"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
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
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await upsertPromoter({ ...form, id: initial?.id });
      if (res && !res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Champs invalides — vérifiez le formulaire.");
      }
    } catch (err) {
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
      <CardHeader><CardTitle>{isEdit ? "Éditer la signalétique" : "Nouveau promoteur"}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <Section title="Identification">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Raison sociale *</span>
                <input value={form.name} onChange={set("name")} className={inp} required /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Forme juridique</span>
                <Select k="legalForm" items={LEGAL_FORMS.items} placeholder="— Non renseignée —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Registre de commerce (RC)</span>
                <input value={form.rcNumber} onChange={set("rcNumber")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">ICE</span>
                <input value={form.iceNumber} onChange={set("iceNumber")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Identifiant fiscal (IF)</span>
                <input value={form.ifNumber} onChange={set("ifNumber")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">CNSS</span>
                <input value={form.cnssNumber} onChange={set("cnssNumber")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Patente</span>
                <input value={form.patenteNumber} onChange={set("patenteNumber")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Capital social (MAD)</span>
                <input type="number" min={0} value={form.capital} onChange={set("capital")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Année de création</span>
                <input type="number" min={1900} max={2100} value={form.foundedYear} onChange={set("foundedYear")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Dirigeant principal</span>
                <input value={form.managerName} onChange={set("managerName")} className={inp} /></label>
            </div>
            <label className="space-y-1 text-sm block"><span className="font-medium">Actionnariat</span>
              <textarea value={form.shareholders} onChange={set("shareholders")} className={inp} rows={2}
                placeholder="Ex. M. X 60 %, Société Y 40 %" /></label>
          </Section>

          <Section title="Coordonnées">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Adresse (siège)</span>
                <input value={form.address} onChange={set("address")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Ville</span>
                <Select k="city" items={withLegacyValue(CITIES.items, form.city)} placeholder="— Sélectionner —" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Email</span>
                <input type="email" value={form.contactEmail} onChange={set("contactEmail")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Téléphone</span>
                <input value={form.contactPhone} onChange={set("contactPhone")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Site web</span>
                <input value={form.website} onChange={set("website")} className={inp} /></label>
            </div>
          </Section>

          <Section title="Expérience & relation">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="space-y-1 text-sm"><span className="font-medium">Années d'expérience</span>
                <input type="number" min={0} value={form.yearsExperience} onChange={set("yearsExperience")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Projets réalisés</span>
                <input type="number" min={0} value={form.completedProjects} onChange={set("completedProjects")} className={inp} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Notation interne</span>
                <Select k="internalRating" items={withLegacyValue(INTERNAL_RATINGS.items, form.internalRating)} placeholder="— Non notée —" /></label>
              <label className="space-y-1 text-sm sm:col-span-3"><span className="font-medium">Groupe d'intérêt</span>
                <select value={form.groupId} onChange={set("groupId")} className={inp}>
                  <option value="">— Aucun —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select></label>
            </div>
            <label className="space-y-1 text-sm block"><span className="font-medium">Autres relations bancaires</span>
              <textarea value={form.bankRelations} onChange={set("bankRelations")} className={inp} rows={2} /></label>
            <label className="space-y-1 text-sm block"><span className="font-medium">Notes</span>
              <textarea value={form.notes} onChange={set("notes")} className={inp} rows={3} /></label>
          </Section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer le promoteur"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
