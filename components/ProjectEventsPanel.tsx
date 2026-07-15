"use client";

// Journal d'événements du projet : timeline chronologique unifiée (événements,
// visites, révisions BP, workflow, scorings) + saisie d'un nouvel événement et
// clôture des événements ouverts. Les événements matériels (affectsScoring)
// déclenchent l'indicateur « score à rafraîchir ».

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { createProjectEvent, resolveProjectEvent } from "@/server/actions/events";
import { EVENT_TYPES_LIST, EVENT_SEVERITIES } from "@/lib/domain/referentiels";
import { formatMAD, formatDate } from "@/lib/utils";

export interface TimelineEntryView {
  kind: "EVENT" | "VISIT" | "BP_REVISION" | "WORKFLOW" | "SCORING";
  id: string;
  date: string; // ISO
  title: string;
  detail?: string | null;
  severity?: string;
  actor?: string | null;
  amount?: number | null;
  resolved?: boolean;
  affectsScoring?: boolean;
}

const KIND_LABELS: Record<TimelineEntryView["kind"], string> = {
  EVENT: "Événement",
  VISIT: "Visite",
  BP_REVISION: "Révision BP",
  WORKFLOW: "Circuit",
  SCORING: "Scoring",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-slate-100 text-slate-700 border-slate-300",
  WARNING: "bg-amber-100 text-amber-800 border-amber-300",
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
};

export function ProjectEventsPanel({ projectId, timeline, canWrite }: {
  projectId: string;
  timeline: TimelineEntryView[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: "",
    severity: "",
    title: "",
    eventDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    amount: "",
    note: "",
  });

  const inp = "rounded-md border border-border bg-background px-3 py-2 text-sm";
  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const typeDef = EVENT_TYPES_LIST.find((t) => t.value === form.type);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createProjectEvent({
        projectId,
        type: form.type,
        severity: form.severity || undefined,
        title: form.title || undefined,
        eventDate: form.eventDate,
        endDate: form.endDate || undefined,
        amount: form.amount === "" ? undefined : form.amount,
        note: form.note || undefined,
      });
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Champs invalides.");
        return;
      }
      setForm((f) => ({ ...f, type: "", severity: "", title: "", endDate: "", amount: "", note: "" }));
      setShowForm(false);
      router.refresh();
    });

  const resolve = (id: string) =>
    start(async () => {
      setError(null);
      const res = await resolveProjectEvent(id);
      if (!res.ok) setError(res.error ?? "Clôture impossible.");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          Journal du projet
          <Badge className="bg-muted">{timeline.length}</Badge>
          {canWrite && (
            <Button variant="outline" onClick={() => setShowForm((v) => !v)} className="ml-auto">
              {showForm ? "Fermer" : "+ Déclarer un événement"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && canWrite && (
          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <div className="grid sm:grid-cols-3 gap-2">
              <label className="space-y-1 text-sm"><span className="font-medium">Type *</span>
                <select value={form.type} onChange={set("type")} className={`${inp} w-full`}>
                  <option value="">— Sélectionner —</option>
                  {EVENT_TYPES_LIST.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Date *</span>
                <input type="date" value={form.eventDate} onChange={set("eventDate")} className={`${inp} w-full`} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Sévérité</span>
                <select value={form.severity} onChange={set("severity")} className={`${inp} w-full`}>
                  <option value="">{typeDef ? `Défaut : ${EVENT_SEVERITIES.labelOf(typeDef.severity)}` : "— Défaut du type —"}</option>
                  {EVENT_SEVERITIES.items.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Libellé</span>
                <input value={form.title} onChange={set("title")} className={`${inp} w-full`} placeholder="Complément (optionnel)" /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Montant (MAD)</span>
                <input type="number" min={0} value={form.amount} onChange={set("amount")} className={`${inp} w-full`} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Date de fin (si déjà clos)</span>
                <input type="date" value={form.endDate} onChange={set("endDate")} className={`${inp} w-full`} /></label>
            </div>
            <label className="space-y-1 text-sm block"><span className="font-medium">Note</span>
              <textarea value={form.note} onChange={set("note")} className={`${inp} w-full`} rows={2} /></label>
            {typeDef?.affectsScoring && (
              <p className="text-xs text-amber-700">
                Événement matériel : il rendra le score « à rafraîchir » et alimentera la classification 1/W à la prochaine synchronisation.
              </p>
            )}
            <Button onClick={submit} disabled={pending || !form.type || !form.eventDate}>
              {pending ? "Enregistrement…" : "Enregistrer l'événement"}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {timeline.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun élément au journal pour ce projet.</p>
        )}
        <ol className="space-y-2">
          {timeline.map((t) => (
            <li key={`${t.kind}_${t.id}`} className="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap w-24 shrink-0">{formatDate(t.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-muted">{KIND_LABELS[t.kind]}</Badge>
                  {t.severity && t.severity !== "INFO" && (
                    <Badge className={SEVERITY_COLORS[t.severity] ?? SEVERITY_COLORS.INFO}>
                      {EVENT_SEVERITIES.labelOf(t.severity)}
                    </Badge>
                  )}
                  <span className="font-medium">{t.title}</span>
                  {t.kind === "EVENT" && t.affectsScoring && !t.resolved && (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300">Matériel — impacte le scoring</Badge>
                  )}
                  {t.kind === "EVENT" && t.resolved && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Clôturé</Badge>
                  )}
                </span>
                <span className="block text-muted-foreground">
                  {t.amount != null && t.amount > 0 && <>{formatMAD(t.amount)} · </>}
                  {t.detail ?? ""}
                  {t.actor ? <span className="italic"> — {t.actor}</span> : null}
                </span>
              </span>
              {canWrite && t.kind === "EVENT" && !t.resolved && (
                <Button variant="outline" onClick={() => resolve(t.id)} disabled={pending} className="shrink-0">
                  Clôturer
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
