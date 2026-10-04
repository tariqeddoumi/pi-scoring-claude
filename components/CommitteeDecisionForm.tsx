"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { recordCommitteeDecision } from "@/server/actions/workflow";
import { COMMITTEE_OUTCOME_LABELS, type CommitteeOutcomeName } from "@/lib/workflow";
import { Field, FormMessage, Input, Select, readActionErrors, type FieldErrors } from "@/components/form";

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
  const [errs, setErrs] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrs({});
    setPending(true);
    try {
      const res = await recordCommitteeDecision(projectId, form);
      if (!res.ok) {
        const r = readActionErrors(res);
        setErrs(r.fieldErrors);
        setError(r.message);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const bind = (k: keyof typeof form) => ({ value: form[k], onChange: set(k) });

  return (
    <Card>
      <CardHeader><CardTitle>Décision de comité</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Sens de la décision" required error={errs.outcome}>
              <Select {...bind("outcome")} options={OUTCOMES.map((o) => ({ value: o, label: COMMITTEE_OUTCOME_LABELS[o] }))} />
            </Field>
            <Field label="Montant approuvé (MAD)" error={errs.approvedAmount}><Input type="number" min={0} inputMode="decimal" {...bind("approvedAmount")} /></Field>
          </div>

          <fieldset className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <legend className="sr-only">Quorum et votes</legend>
            <Field label="Quorum" error={errs.quorum}><Input type="number" min={0} inputMode="numeric" {...bind("quorum")} /></Field>
            <Field label="Présents" error={errs.presentCount}><Input type="number" min={0} inputMode="numeric" {...bind("presentCount")} /></Field>
            <Field label="Pour" error={errs.votesFor}><Input type="number" min={0} inputMode="numeric" {...bind("votesFor")} /></Field>
            <Field label="Contre" error={errs.votesAgainst}><Input type="number" min={0} inputMode="numeric" {...bind("votesAgainst")} /></Field>
            <Field label="Abstention" error={errs.votesAbstain}><Input type="number" min={0} inputMode="numeric" {...bind("votesAbstain")} /></Field>
          </fieldset>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Validité (jusqu'au)" error={errs.validUntil}><Input type="date" {...bind("validUntil")} /></Field>
            <Field label="Réf. PV" error={errs.minutesRef}><Input {...bind("minutesRef")} /></Field>
          </div>

          <Field label="Conditions / covenants" error={errs.conditions}><Input {...bind("conditions")} /></Field>

          <FormMessage error={error} />
          <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer la décision"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
