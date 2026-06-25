"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { WIZARD_STEPS, type FieldDef } from "@/lib/wizardFields";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { saveProjectInputs, runScoringAction } from "@/server/actions/scoring";

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
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const current = steps[step]!;
  const setVal = (k: string, v: any) => setValues((p) => ({ ...p, [k]: v }));

  const save = (then?: "run") =>
    start(async () => {
      const r = await saveProjectInputs(projectId, values);
      if (!r.ok) {
        setMsg("Erreurs de validation : " + Object.keys(r.errors ?? {}).join(", "));
        return;
      }
      if (then === "run") {
        const res = await runScoringAction(projectId);
        setMsg(res.ok ? `Score ${res.scoreFinal} · ${res.decision} · ${res.resultClass}` : "Échec du calcul");
        router.refresh();
      } else {
        setMsg("Brouillon enregistré.");
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étape {step + 1}/{steps.length} — {current.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={`rounded-md px-2 py-1 text-xs ${i === step ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {current.fields.map((f) => (
            <label key={f.key} className="text-sm space-y-1">
              <span className="text-muted-foreground">{INPUT_LABELS[f.key] ?? f.key}</span>
              {f.type === "select" ? (
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setVal(f.key, e.target.value)}
                >
                  <option value="" disabled>—</option>
                  {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "bool" ? (
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                  value={values[f.key] === true ? "true" : values[f.key] === false ? "false" : ""}
                  onChange={(e) => setVal(f.key, e.target.value === "true")}
                >
                  <option value="false">Non</option>
                  <option value="true">Oui</option>
                </select>
              ) : (
                <input
                  type="number"
                  step={f.step ?? "1"}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setVal(f.key, e.target.value === "" ? "" : Number(e.target.value))}
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex gap-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Précédent</Button>
            <Button variant="outline" disabled={step === steps.length - 1} onClick={() => setStep((s) => s + 1)}>Suivant</Button>
          </div>
          <div className="flex gap-2 items-center">
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            <Button variant="outline" disabled={pending} onClick={() => save()}>Enregistrer brouillon</Button>
            <Button disabled={pending} onClick={() => save("run")}>{pending ? "…" : "Enregistrer & calculer"}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
