"use client";

// Modèle v5 — périmètre financé (tranche / lot), rattachement des facilités,
// équipements exigés (mosquée, école, voirie…) et lecture des indicateurs v5
// tels qu'ils seront reportés dans le scoring par « Synchroniser ».

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Th, Td } from "@/components/ui";
import {
  setTrancheFinanced, setFacilityTranche, setEquipmentDeclared, saveEquipment, deleteEquipment, type EquipmentInput,
} from "@/server/actions/programme";
import { EQUIPMENT_FUNDERS, EQUIPMENT_KINDS, EQUIPMENT_ORIGINS } from "@/lib/domain/programmeV5";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { formatMAD, formatDate } from "@/lib/utils";
import { TONE } from "@/lib/tones";

export interface ProgrammeV5View {
  region: string | null;
  segment: string | null;
  equipmentDeclared: boolean | null;
  tranches: { id: string; code: string; name: string | null; financed: boolean; progressPct: number; units: number }[];
  facilities: { id: string; label: string; trancheId: string | null; authorizedAmount: number; drawnAmount: number; nature: string | null; closed: boolean }[];
  equipments: {
    id: string; kind: string; label: string; origin: string | null; estimatedCost: number | null; budgeted: boolean; fundedBy: string | null;
    progressPct: number; dueDate: string | null; conditionsDelivery: boolean; handedOver: boolean; trancheId: string | null; note: string | null;
  }[];
  values: Record<string, string | number | boolean>;
  notes: { key: string; label: string; value?: string; reason: string }[];
}

const labelOf = (list: { value: string; label: string }[], v: string | null) => list.find((x) => x.value === v)?.label ?? v ?? "—";
const EMPTY: EquipmentInput = { kind: "mosquee", label: "", origin: "convention_commune", estimatedCost: "", budgeted: false, fundedBy: "promoteur", progressPct: "0", dueDate: "", conditionsDelivery: true, handedOver: false, trancheId: null, note: "" };

function fmtValue(v: string | number | boolean | undefined) {
  if (v === undefined) return "absente";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`;
  return v;
}

export function ProgrammeV5Card({ projectId, view, canWrite }: { projectId: string; view: ProgrammeV5View; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EquipmentInput | null>(null);
  const inp = "rounded-md border border-border bg-background px-2 py-1.5 text-sm";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) { setError(r.error ?? "Opération impossible."); return; }
      after?.();
      router.refresh();
    });

  const financedCount = view.tranches.filter((t) => t.financed).length;
  const facilityTranches = new Set(view.facilities.map((f) => f.trancheId).filter(Boolean));
  const whole = financedCount === 0 && facilityTranches.size === 0;
  const declared = view.equipmentDeclared;
  const v5Keys = Object.keys(INPUT_LABELS).filter((k) => k in view.values || view.notes.some((n) => n.key === k));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programme, tranche financée, équipements et déblocages (modèle v5)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ce qui est affiché ici est exactement ce que « Synchroniser vers le scoring » reportera dans les entrées du score.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-700">{error}</p>}

        {/* ---------- Périmètre financé ---------- */}
        <section className="space-y-2">
          <h3 className="font-semibold text-sm">1. Périmètre financé</h3>
          <p className="text-xs text-muted-foreground">
            {whole
              ? "Aucune tranche n'est marquée financée et aucune facilité n'est rattachée à une tranche : le programme entier est considéré comme financé."
              : "Seules les tranches cochées ou portées par une facilité sont retenues pour la prévente, les désistements, la composition et l'encours."}
          </p>
          {view.tranches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tranche enregistrée.</p>
          ) : (
            <Table>
              <thead><tr><Th>Tranche</Th><Th>Lots</Th><Th>Avancement</Th><Th>Financée par la banque</Th></tr></thead>
              <tbody>
                {view.tranches.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.code}{t.name ? ` — ${t.name}` : ""}</Td>
                    <Td>{t.units}</Td>
                    <Td>{t.progressPct.toFixed(0)} %</Td>
                    <Td>
                      <input type="checkbox" checked={t.financed} disabled={!canWrite || pending}
                        onChange={(e) => run(() => setTrancheFinanced(projectId, t.id, e.target.checked))} />
                      {facilityTranches.has(t.id) && <span className="ml-2 text-xs text-muted-foreground">(portée par une facilité)</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {view.facilities.length > 0 && (
            <Table>
              <thead><tr><Th>Facilité</Th><Th>Nature</Th><Th>Autorisé</Th><Th>Tiré</Th><Th>Tranche financée</Th></tr></thead>
              <tbody>
                {view.facilities.map((f) => (
                  <tr key={f.id} className={f.closed ? "opacity-60" : ""}>
                    <Td>{f.label}</Td>
                    <Td>{f.nature ?? "—"}</Td>
                    <Td>{formatMAD(f.authorizedAmount)}</Td>
                    <Td>{formatMAD(f.drawnAmount)}</Td>
                    <Td>
                      <select className={inp} value={f.trancheId ?? ""} disabled={!canWrite || pending || view.tranches.length === 0}
                        onChange={(e) => run(() => setFacilityTranche(projectId, f.id, e.target.value || null))}>
                        <option value="">Programme entier</option>
                        {view.tranches.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
                      </select>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        {/* ---------- Équipements exigés ---------- */}
        <section className="space-y-2">
          <h3 className="font-semibold text-sm">2. Équipements exigés (mosquée, école, voirie…)</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Obligations :</span>
            <Badge className={declared === null ? TONE.warning : TONE.neutral}>
              {declared === null ? "non déclarées (critère au plancher)" : declared ? `${view.equipments.length} équipement(s) exigé(s)` : "aucun équipement exigé"}
            </Badge>
            {canWrite && (
              <>
                {declared !== false && view.equipments.length === 0 && (
                  <Button variant="outline" disabled={pending} onClick={() => run(() => setEquipmentDeclared(projectId, false))}>Déclarer « aucun équipement exigé »</Button>
                )}
                {declared !== null && view.equipments.length === 0 && (
                  <Button variant="ghost" disabled={pending} onClick={() => run(() => setEquipmentDeclared(projectId, null))}>Revenir à « non déclaré »</Button>
                )}
                <Button variant="outline" disabled={pending} onClick={() => setForm({ ...EMPTY })}>Ajouter un équipement</Button>
              </>
            )}
          </div>
          {view.equipments.length > 0 && (
            <Table>
              <thead><tr><Th>Équipement</Th><Th>Origine</Th><Th>Coût estimé</Th><Th>Financement</Th><Th>Avancement</Th><Th>Échéance</Th><Th>Réception</Th>{canWrite && <Th />}</tr></thead>
              <tbody>
                {view.equipments.map((e) => (
                  <tr key={e.id}>
                    <Td><div className="font-medium">{e.label}</div><div className="text-xs text-muted-foreground">{labelOf(EQUIPMENT_KINDS, e.kind)}</div></Td>
                    <Td className="text-xs">{labelOf(EQUIPMENT_ORIGINS, e.origin)}</Td>
                    <Td>{e.estimatedCost != null ? formatMAD(e.estimatedCost) : "—"}</Td>
                    <Td className="text-xs">{labelOf(EQUIPMENT_FUNDERS, e.fundedBy)}{e.budgeted ? " · budgété" : " · non budgété"}</Td>
                    <Td>{e.handedOver ? "Remis" : `${e.progressPct.toFixed(0)} %`}</Td>
                    <Td>{e.dueDate ? formatDate(e.dueDate) : "—"}</Td>
                    <Td>{e.conditionsDelivery ? <Badge className={TONE.warning}>conditionne la réception</Badge> : "—"}</Td>
                    {canWrite && (
                      <Td className="whitespace-nowrap">
                        <Button variant="ghost" disabled={pending} onClick={() => setForm({ ...e, estimatedCost: e.estimatedCost ?? "", progressPct: String(e.progressPct), dueDate: e.dueDate ?? "", note: e.note ?? "" })}>Modifier</Button>
                        <Button variant="ghost" disabled={pending} onClick={() => run(() => deleteEquipment(projectId, e.id))}>Supprimer</Button>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {form && canWrite && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="text-xs">Type<select className={`${inp} w-full`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {EQUIPMENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
                <label className="text-xs">Libellé<input className={`${inp} w-full`} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex. Mosquée du quartier" /></label>
                <label className="text-xs">Origine de l&apos;obligation<select className={`${inp} w-full`} value={form.origin ?? ""} onChange={(e) => setForm({ ...form, origin: e.target.value || null })}>
                  {EQUIPMENT_ORIGINS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
                <label className="text-xs">Coût estimé (MAD)<input className={`${inp} w-full`} value={String(form.estimatedCost ?? "")} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} /></label>
                <label className="text-xs">Financé par<select className={`${inp} w-full`} value={form.fundedBy ?? ""} onChange={(e) => setForm({ ...form, fundedBy: e.target.value || null })}>
                  {EQUIPMENT_FUNDERS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
                <label className="text-xs">Tranche<select className={`${inp} w-full`} value={form.trancheId ?? ""} onChange={(e) => setForm({ ...form, trancheId: e.target.value || null })}>
                  <option value="">Programme</option>{view.tranches.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></label>
                <label className="text-xs">Avancement (%)<input className={`${inp} w-full`} value={String(form.progressPct ?? "")} onChange={(e) => setForm({ ...form, progressPct: e.target.value })} /></label>
                <label className="text-xs">Échéance<input type="date" className={`${inp} w-full`} value={form.dueDate ?? ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
                <label className="text-xs">Note<input className={`${inp} w-full`} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label><input type="checkbox" checked={!!form.budgeted} onChange={(e) => setForm({ ...form, budgeted: e.target.checked })} /> Prévu au budget du programme</label>
                <label><input type="checkbox" checked={!!form.conditionsDelivery} onChange={(e) => setForm({ ...form, conditionsDelivery: e.target.checked })} /> Conditionne la réception / le permis d&apos;habiter</label>
                <label><input type="checkbox" checked={!!form.handedOver} onChange={(e) => setForm({ ...form, handedOver: e.target.checked })} /> Remis à la commune</label>
              </div>
              <div className="flex gap-2">
                <Button disabled={pending} onClick={() => run(() => saveEquipment(projectId, form), () => setForm(null))}>{form.id ? "Enregistrer" : "Ajouter"}</Button>
                <Button variant="ghost" disabled={pending} onClick={() => setForm(null)}>Annuler</Button>
              </div>
            </div>
          )}
        </section>

        {/* ---------- Lecture des indicateurs v5 ---------- */}
        <section className="space-y-2">
          <h3 className="font-semibold text-sm">3. Indicateurs reportés dans le score</h3>
          {v5Keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun indicateur calculable à ce stade.</p>
          ) : (
            <Table>
              <thead><tr><Th>Donnée</Th><Th>Valeur</Th><Th>Origine du calcul</Th></tr></thead>
              <tbody>
                {v5Keys.map((k) => {
                  const n = view.notes.find((x) => x.key === k);
                  return (
                    <tr key={k}>
                      <Td>{INPUT_LABELS[k] ?? k}</Td>
                      <Td className={k in view.values ? "font-medium" : "text-amber-700"}>{fmtValue(view.values[k])}</Td>
                      <Td className="text-xs text-muted-foreground">{n?.reason ?? ""}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground">
            Une donnée absente est notée au plancher : la régionalité exige le référentiel « Marché régional » (Administration → Référentiels),
            les déblocages exigent des facilités de travaux et un avancement certifié.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
