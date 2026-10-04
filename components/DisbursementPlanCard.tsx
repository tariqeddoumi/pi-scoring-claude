"use client";

// Planning des déblocages du BUSINESS PLAN INITIAL : jalons prévisionnels
// (montant/date), rapprochement avec les déblocages réels (saisis ou importés
// du SI) et RATTACHEMENT MANUEL de chaque déblocage à son jalon.

import { CONTROL } from "@/lib/formStyles";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Th, Td, Stat } from "@/components/ui";
import {
  upsertDisbursementMilestone,
  deleteDisbursementMilestone,
  linkDisbursementToMilestone,
} from "@/server/actions/disbursements";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MILESTONE_STATUS_LABELS, type MilestoneStatus } from "@/lib/domain/disbursementPlan";
import { formatMAD, formatDate, formatMADCompact } from "@/lib/utils";
import { TONE } from "@/lib/tones";

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  A_VENIR: TONE.neutral,
  PARTIEL: TONE.warning,
  DEBLOQUE: TONE.success,
  DEPASSE: TONE.danger,
};

export interface MilestoneRowView {
  id: string;
  seq: number;
  label: string;
  plannedDate: string | null;
  plannedAmount: number;
  realizedAmount: number;
  gap: number;
  status: MilestoneStatus;
  late: boolean;
}

export interface UnlinkedDisbursementView {
  id: string;
  eventDate: string;
  amount: number | null;
  title?: string | null;
  source?: string;
}

export function DisbursementPlanCard({ projectId, rows, unlinked, totals, canWrite }: {
  projectId: string;
  rows: MilestoneRowView[];
  unlinked: UnlinkedDisbursementView[];
  totals: { planned: number; realized: number; unlinkedAmount: number; executionPct: number | null };
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", plannedDate: "", plannedAmount: "" });
  const [linkTo, setLinkTo] = useState<Record<string, string>>({});

  const inp = CONTROL;

  const addMilestone = () =>
    start(async () => {
      setError(null);
      const res = await upsertDisbursementMilestone({ projectId, ...form });
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Champs invalides.");
        return;
      }
      setForm({ label: "", plannedDate: "", plannedAmount: "" });
      router.refresh();
    });

  const removeMilestone = (id: string) =>
    start(async () => {
      setError(null);
      const res = await deleteDisbursementMilestone(id);
      if (!res.ok) setError(res.error ?? "Suppression impossible.");
      router.refresh();
    });

  const link = (eventId: string) =>
    start(async () => {
      setError(null);
      const milestoneId = linkTo[eventId];
      if (!milestoneId) return;
      const res = await linkDisbursementToMilestone(eventId, milestoneId);
      if (!res.ok) setError(res.error ?? "Rattachement impossible.");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          Planning des déblocages (business plan initial)
          {unlinked.length > 0 && (
            <Badge className={TONE.warning}>
              {unlinked.length} déblocage(s) à rattacher
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Prévu au plan" value={formatMADCompact(totals.planned)} title={formatMAD(totals.planned)} />
          <Stat label="Débloqué (rattaché)" value={formatMADCompact(totals.realized)} title={formatMAD(totals.realized)} />
          <Stat label="Exécution du plan" value={totals.executionPct != null ? `${totals.executionPct} %` : "—"} />
          <Stat label="Débloqué non rattaché" value={formatMADCompact(totals.unlinkedAmount)} title={formatMAD(totals.unlinkedAmount)} />
        </div>

        {rows.length > 0 ? (
          <Table>
            <thead>
              <tr><Th>#</Th><Th>Jalon</Th><Th>Date prévue</Th><Th>Prévu</Th><Th>Réalisé</Th><Th>Écart</Th><Th>Statut</Th>{canWrite && <Th></Th>}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.late ? "bg-amber-50" : undefined}>
                  <Td>{r.seq}</Td>
                  <Td className="font-medium">{r.label}</Td>
                  <Td className="whitespace-nowrap">{r.plannedDate ? formatDate(r.plannedDate) : "—"}{r.late && <span className="text-amber-700 text-xs"> (échu)</span>}</Td>
                  <Td className="whitespace-nowrap">{formatMAD(r.plannedAmount)}</Td>
                  <Td className="whitespace-nowrap">{formatMAD(r.realizedAmount)}</Td>
                  <Td className={`whitespace-nowrap ${r.gap < 0 ? "text-amber-700" : r.gap > 0 ? "text-red-700" : ""}`}>
                    {r.gap >= 0 ? "+" : ""}{formatMAD(r.gap)}
                  </Td>
                  <Td><Badge className={STATUS_COLORS[r.status]}>{MILESTONE_STATUS_LABELS[r.status]}</Badge></Td>
                  {canWrite && (
                    <Td>
                      <ConfirmButton onConfirm={() => removeMilestone(r.id)} disabled={pending} title={`Retirer le jalon « ${r.label} » ?`}
                        description="Les déblocages qui lui étaient rattachés redeviendront « non rattachés »." confirmLabel="Retirer">Retirer</ConfirmButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun jalon défini : saisissez le planning de déblocages prévu au business plan initial.
          </p>
        )}

        {canWrite && (
          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <div className="text-sm font-medium">Ajouter un jalon du plan</div>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Libellé du jalon" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex. Déblocage 2 — gros œuvre" className={`${inp} flex-1 min-w-48`} />
              <input type="date" aria-label="Date prévue" value={form.plannedDate} onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))} className={inp} />
              <input type="number" min={0} inputMode="decimal" aria-label="Montant prévu (MAD)" value={form.plannedAmount} onChange={(e) => setForm((f) => ({ ...f, plannedAmount: e.target.value }))}
                placeholder="Montant (MAD)" className={inp} />
              <Button onClick={addMilestone} disabled={pending || !form.label || !form.plannedAmount}>
                {pending ? "Ajout…" : "Ajouter"}
              </Button>
            </div>
          </div>
        )}

        {unlinked.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
            <div className="text-sm font-medium text-amber-900">
              Déblocages à rattacher au plan (rattachement manuel)
            </div>
            <ul className="space-y-2">
              {unlinked.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="whitespace-nowrap">{formatDate(e.eventDate)}</span>
                  <span className="font-medium whitespace-nowrap">{formatMAD(e.amount ?? 0)}</span>
                  {e.title && <span className="text-muted-foreground">{e.title}</span>}
                  {e.source && e.source !== "MANUAL" && (
                    <Badge className={TONE.info}>{e.source}</Badge>
                  )}
                  {canWrite && rows.length > 0 && (
                    <span className="ml-auto flex items-center gap-2">
                      <select
                        aria-label="Jalon auquel rattacher ce déblocage"
                        value={linkTo[e.id] ?? ""}
                        onChange={(ev) => setLinkTo((p) => ({ ...p, [e.id]: ev.target.value }))}
                        className={inp}
                      >
                        <option value="">— Choisir le jalon —</option>
                        {rows.map((r) => <option key={r.id} value={r.id}>{r.seq}. {r.label}</option>)}
                      </select>
                      <Button variant="outline" onClick={() => link(e.id)} disabled={pending || !linkTo[e.id]}>
                        Rattacher
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
