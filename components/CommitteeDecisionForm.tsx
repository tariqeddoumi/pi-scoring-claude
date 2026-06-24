"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { recordCommitteeDecision } from "@/server/actions/workflow";
import { COMMITTEE_OUTCOME_LABELS, type CommitteeOutcomeName } from "@/lib/workflow";

const OUTCOMES = Object.keys(COMMITTEE_OUTCOME_LABELS) as CommitteeOutcomeName[];

export function CommitteeDecisionForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    outcome: "FAVORABLE" as CommitteeOutcomeName,
    quorum: "3",
    presentCount: "3",
    votesFor: "0",
    votesAgainst: "0",
    votesAbstain: "0",
    approvedAmount: "",
    conditions: "",
    validUntil: "",
    minutesRef: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await recordCommitteeDecision(projectId, form);
      if (!res.ok) {
        const msg = "error" in res && typeof res.error === "string"
          ? res.error
          : "Décision invalide (vérifiez les champs).";
        setError(msg);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const num = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  return (
    <Card>
      <CardHeader><CardTitle>Décision de comité</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Sens de la décision</span>
              <select value={form.outcome} onChange={set("outcome")} className={num}>
                {OUTCOMES.map((o) => <option key={o} value={o}>{COMMITTEE_OUTCOME_LABELS[o]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Montant approuvé (MAD)</span>
              <input type="number" value={form.approvedAmount} onChange={set("approvedAmount")} className={num} />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <label className="space-y-1 text-sm"><span className="font-medium">Quorum</span>
              <input type="number" value={form.quorum} onChange={set("quorum")} className={num} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Présents</span>
              <input type="number" value={form.presentCount} onChange={set("presentCount")} className={num} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Pour</span>
              <input type="number" value={form.votesFor} onChange={set("votesFor")} className={num} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Contre</span>
              <input type="number" value={form.votesAgainst} onChange={set("votesAgainst")} className={num} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Abstention</span>
              <input type="number" value={form.votesAbstain} onChange={set("votesAbstain")} className={num} /></label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm"><span className="font-medium">Validité (jusqu'au)</span>
              <input type="date" value={form.validUntil} onChange={set("validUntil")} className={num} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Réf. PV</span>
              <input type="text" value={form.minutesRef} onChange={set("minutesRef")} className={num} /></label>
          </div>

          <label className="space-y-1 text-sm block"><span className="font-medium">Conditions / covenants</span>
            <input type="text" value={form.conditions} onChange={set("conditions")} className={num} /></label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la décision"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
