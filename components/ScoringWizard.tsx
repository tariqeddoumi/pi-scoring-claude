"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { WIZARD_STEPS, type FieldDef } from "@/lib/wizardFields";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { saveProjectInputs, runScoringAction } from "@/server/actions/scoring";
import { Field, FormMessage, Input, Select, type FieldErrors } from "@/components/form";
import { cn } from "@/lib/utils";

const filled = (v: unknown) => v !== null && v !== undefined && v !== "";

export function ScoringWizard({
  projectId,
  initial,
  steps = WIZARD_STEPS,
}: {
  projectId: string;
  initial: Record<string, any>;
  steps?: { id: string; title: string; fields: FieldDef[] }[];
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [errs, setErrs] = useState<FieldErrors>({});
  const router = useRouter();

  const current = steps[step]!;
  const setVal = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));

  const save = (then?: "run") =>
    start(async () => {
      setErrs({});
      const r = await saveProjectInputs(projectId, values);
      if (!r.ok) {
        const fieldErrors = ("errors" in r && r.errors ? r.errors : {}) as FieldErrors;
        setErrs(fieldErrors);
        const keys = Object.keys(fieldErrors);
        // Aller à la première étape qui contient une erreur.
        const first = steps.findIndex((st) => st.fields.some((f) => keys.includes(f.key)));
        if (first >= 0) setStep(first);
        setMsg({
          error: true,
          text: "error" in r && r.error
            ? r.error
            : `Valeurs invalides : ${keys.map((k) => INPUT_LABELS[k] ?? k).join(", ")}.`,
        });
        return;
      }
      if (then === "run") {
        const res = await runScoringAction(projectId);
        setMsg(res.ok ? { error: false, text: `Score ${res.scoreFinal} · ${res.decision} · ${res.resultClass}` } : { error: true, text: "Échec du calcul." });
        router.refresh();
      } else {
        setMsg({ error: false, text: "Brouillon enregistré." });
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape {step + 1}/{steps.length} — {current.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <nav aria-label="Étapes de la saisie" className="flex flex-wrap gap-1.5">
          {steps.map((st, i) => {
            const n = st.fields.length;
            const done = st.fields.filter((f) => filled(values[f.key])).length;
            const hasError = st.fields.some((f) => errs[f.key]?.length);
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                title={`${st.title} — ${done}/${n} renseigné(s)`}
                aria-label={`Étape ${i + 1} : ${st.title}, ${done} sur ${n} renseigné(s)${hasError ? ", à corriger" : ""}`}
                className={cn(
                  "relative rounded-md border px-2.5 py-1 text-xs tabular-nums",
                  i === step ? "border-primary bg-primary text-primary-foreground" : done === n ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-border bg-muted",
                  hasError && "ring-2 ring-red-500",
                )}
              >
                {i + 1}
                <span className="ml-1 opacity-75">{done}/{n}</span>
              </button>
            );
          })}
        </nav>

        <div className="grid sm:grid-cols-2 gap-4">
          {current.fields.map((f) => {
            const label = f.label ?? INPUT_LABELS[f.key] ?? f.key;
            const v = values[f.key];
            return (
              <Field key={f.key} label={label} hint={f.hint} error={errs[f.key]}>
                {f.type === "select" ? (
                  <Select value={v ?? ""} onChange={(e) => setVal(f.key, e.target.value === "" ? null : e.target.value)}
                    options={f.options!} placeholder="— non renseigné" />
                ) : f.type === "bool" ? (
                  <Select value={v === true ? "true" : v === false ? "false" : ""}
                    onChange={(e) => setVal(f.key, e.target.value === "" ? null : e.target.value === "true")}
                    options={[{ value: "false", label: "Non" }, { value: "true", label: "Oui" }]} placeholder="— non renseigné" />
                ) : f.type === "text" ? (
                  <Input value={v ?? ""} onChange={(e) => setVal(f.key, e.target.value === "" ? null : e.target.value)} />
                ) : (
                  <Input type="number" step={f.step ?? "any"} inputMode="decimal" value={v ?? ""}
                    // Champ vidé = donnée absente (null), jamais 0.
                    onChange={(e) => setVal(f.key, e.target.value === "" ? null : Number(e.target.value))} />
                )}
              </Field>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex gap-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Précédent</Button>
            <Button variant="outline" disabled={step === steps.length - 1} onClick={() => setStep((s) => s + 1)}>Suivant</Button>
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-end">
            {msg && (msg.error ? <FormMessage error={msg.text} /> : <span role="status" className="text-sm text-muted-foreground">{msg.text}</span>)}
            <Button variant="outline" disabled={pending} onClick={() => save()}>Enregistrer brouillon</Button>
            <Button disabled={pending} onClick={() => save("run")}>{pending ? "…" : "Enregistrer & calculer"}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
