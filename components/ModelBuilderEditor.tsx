"use client";

import { CONTROL_COMPACT } from "@/lib/formStyles";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Th, Td } from "@/components/ui";
import {
  discardModelDraft, publishModelDraft,
  addDomain, updateDomain, deleteDomain,
  addCriterion, updateCriterion, deleteCriterion,
  addOption, deleteOption, addRange, deleteRange,
  addRedFlag, deleteRedFlag,
} from "@/server/actions/modelBuilder";
import { TONE } from "@/lib/tones";

// --- Types (sous-ensemble du modèle Prisma) ---------------------------------
interface Opt { id: string; value: string; label: string; score: number }
interface Rng { id: string; minIncl: number | null; maxExcl: number | null; score: number; label: string | null }
interface Crit { id: string; code: string; name: string; type: "QUAL" | "NUM"; weight: number; inputKey: string; isGate: boolean; gateThreshold: number | null; options: Opt[]; ranges: Rng[] }
interface Dom { id: string; code: string; name: string; weight: number; criteria: Crit[] }
interface RedFlag { id: string; code: string; name: string; severity: string; malus: number; impactDomains: string[] }
export interface DraftModel { id: string; version: string; domains: Dom[]; redFlags: RedFlag[] }

type ActionResult = { ok: true } | { ok: false; error: string; issues?: string[] };

const inp = CONTROL_COMPACT;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function ModelBuilderEditor({ draft }: { draft: DraftModel }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[] | null>(null);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null); setIssues(null);
      const r = await fn();
      if (!r.ok) { setError(r.error); if ("issues" in r && r.issues) setIssues(r.issues); return; }
      router.refresh();
    });

  const domainWeightSum = draft.domains.reduce((s, d) => s + d.weight, 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Brouillon éditable — {draft.version}</CardTitle>
            <div className="flex gap-2">
              <ConfirmButton variant="primary" tone="primary" disabled={pending} title={`Publier la version ${draft.version} ?`}
                description="La version publiée devient le modèle de référence pour tous les nouveaux calculs ; la version actuelle est retirée. Les scores existants gardent leur version."
                confirmLabel="Publier" onConfirm={() => run(() => publishModelDraft(draft.id))}>Publier</ConfirmButton>
              <ConfirmButton disabled={pending} title="Supprimer définitivement ce brouillon ?" description="Toutes les modifications du brouillon seront perdues."
                confirmLabel="Supprimer le brouillon" onConfirm={() => run(() => discardModelDraft(draft.id))}>Supprimer le brouillon</ConfirmButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">Somme des poids de domaines : <span className={Math.abs(domainWeightSum - 1) > 0.011 ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>{pct(domainWeightSum)}</span> <span className="text-muted-foreground">(doit faire 100% pour publier)</span></p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {issues && <ul className="text-sm text-red-600 list-disc pl-5">{issues.map((m, i) => <li key={i}>{m}</li>)}</ul>}
        </CardContent>
      </Card>

      {draft.domains.map((d) => <DomainCard key={d.id} domain={d} run={run} pending={pending} />)}

      <AddDomain versionId={draft.id} run={run} pending={pending} />

      <RedFlagsCard versionId={draft.id} redFlags={draft.redFlags} run={run} pending={pending} />
    </div>
  );
}

type RunFn = (fn: () => Promise<ActionResult>) => void;

function DomainCard({ domain, run, pending }: { domain: Dom; run: RunFn; pending: boolean }) {
  const [name, setName] = useState(domain.name);
  const [weight, setWeight] = useState(String(domain.weight));
  const critSum = domain.criteria.reduce((s, c) => s + c.weight, 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-end gap-2 flex-wrap">
          <span className="font-mono text-sm self-center">{domain.code}</span>
          <label className="text-xs">Nom<input className={`${inp} ml-1 w-64`} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-xs">Poids<input type="number" step="0.01" className={`${inp} ml-1 w-20`} value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
          <Button variant="outline" disabled={pending} onClick={() => run(() => updateDomain({ id: domain.id, name, weight }))}>Enregistrer</Button>
          <ConfirmButton disabled={pending} title={`Supprimer le domaine ${domain.code} et ses critères ?`} confirmLabel="Supprimer" onConfirm={() => run(() => deleteDomain(domain.id))}>Supprimer</ConfirmButton>
          <span className={`text-xs self-center ${Math.abs(critSum - 1) > 0.011 ? "text-red-600" : "text-emerald-600"}`}>Σ critères {pct(critSum)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {domain.criteria.map((c) => <CriterionRow key={c.id} crit={c} run={run} pending={pending} />)}
        <AddCriterion domainId={domain.id} run={run} pending={pending} />
      </CardContent>
    </Card>
  );
}

function CriterionRow({ crit, run, pending }: { crit: Crit; run: RunFn; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(crit.name);
  const [type, setType] = useState(crit.type);
  const [weight, setWeight] = useState(String(crit.weight));
  const [inputKey, setInputKey] = useState(crit.inputKey);
  const [isGate, setIsGate] = useState(crit.isGate);
  const [gate, setGate] = useState(String(crit.gateThreshold ?? 0));
  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <div className="flex items-end gap-2 flex-wrap text-xs">
        <span className="font-mono self-center">{crit.code}</span>
        <label>Nom<input className={`${inp} ml-1 w-56`} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Type
          <select className={`${inp} ml-1`} value={type} onChange={(e) => setType(e.target.value as "QUAL" | "NUM")}>
            <option value="QUAL">Qualitatif</option><option value="NUM">Numérique</option>
          </select>
        </label>
        <label>Poids<input type="number" step="0.01" className={`${inp} ml-1 w-16`} value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <label>Clé d'entrée<input className={`${inp} ml-1 w-40`} value={inputKey} onChange={(e) => setInputKey(e.target.value)} /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={isGate} onChange={(e) => setIsGate(e.target.checked)} />Gate</label>
        {isGate && <label>seuil ≤<input type="number" className={`${inp} ml-1 w-16`} value={gate} onChange={(e) => setGate(e.target.value)} /></label>}
        <Button variant="outline" disabled={pending} onClick={() => run(() => updateCriterion({ id: crit.id, name, type, weight, inputKey, isGate, gateThreshold: gate }))}>OK</Button>
        <ConfirmButton disabled={pending} title={`Supprimer le critère ${crit.code} ?`} description="Ses modalités et barèmes sont supprimés avec lui." confirmLabel="Supprimer" onConfirm={() => run(() => deleteCriterion(crit.id))}>Suppr.</ConfirmButton>
        <Button variant="outline" disabled={pending} onClick={() => setOpen((o) => !o)}>{type === "QUAL" ? `Modalités (${crit.options.length})` : `Barèmes (${crit.ranges.length})`}</Button>
      </div>
      {open && (type === "QUAL"
        ? <OptionsEditor crit={crit} run={run} pending={pending} />
        : <RangesEditor crit={crit} run={run} pending={pending} />)}
    </div>
  );
}

function OptionsEditor({ crit, run, pending }: { crit: Crit; run: RunFn; pending: boolean }) {
  const [value, setValue] = useState(""); const [label, setLabel] = useState(""); const [score, setScore] = useState("");
  return (
    <div className="pl-2 border-l-2 border-muted space-y-1">
      {crit.options.map((o) => (
        <div key={o.id} className="flex items-center gap-2 text-xs">
          <span className="font-mono">{o.value}</span><span>· {o.label} =</span><span className="font-medium">{o.score}</span>
          <ConfirmButton variant="ghost" className="px-1.5 py-0.5 text-red-600" aria-label={`Supprimer la modalité ${o.value}`} disabled={pending}
            title={`Supprimer la modalité « ${o.label} » ?`} confirmLabel="Supprimer" onConfirm={() => run(() => deleteOption(o.id))}>✕</ConfirmButton>
        </div>
      ))}
      <div className="flex items-end gap-1 text-xs">
        <label>Valeur<input className={`${inp} ml-1 w-28`} value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label>Libellé<input className={`${inp} ml-1 w-40`} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label>Score<input type="number" className={`${inp} ml-1 w-16`} value={score} onChange={(e) => setScore(e.target.value)} /></label>
        <Button variant="outline" disabled={pending || !value || !label} onClick={() => run(async () => { const r = await addOption({ criterionId: crit.id, value, label, score: score || "0" }); if (r.ok) { setValue(""); setLabel(""); setScore(""); } return r; })}>+ Modalité</Button>
      </div>
    </div>
  );
}

function RangesEditor({ crit, run, pending }: { crit: Crit; run: RunFn; pending: boolean }) {
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [score, setScore] = useState(""); const [label, setLabel] = useState("");
  return (
    <div className="pl-2 border-l-2 border-muted space-y-1">
      {crit.ranges.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-xs">
          <span>[{r.minIncl ?? "−∞"}, {r.maxExcl ?? "+∞"}) =</span><span className="font-medium">{r.score}</span>
          {r.label && <span className="text-muted-foreground">· {r.label}</span>}
          <ConfirmButton variant="ghost" className="px-1.5 py-0.5 text-red-600" aria-label="Supprimer la tranche" disabled={pending}
            title={`Supprimer la tranche [${r.minIncl ?? "−∞"}, ${r.maxExcl ?? "+∞"}) ?`} confirmLabel="Supprimer" onConfirm={() => run(() => deleteRange(r.id))}>✕</ConfirmButton>
        </div>
      ))}
      <div className="flex items-end gap-1 text-xs flex-wrap">
        <label>Min<input type="number" className={`${inp} ml-1 w-20`} value={min} onChange={(e) => setMin(e.target.value)} placeholder="−∞" /></label>
        <label>Max<input type="number" className={`${inp} ml-1 w-20`} value={max} onChange={(e) => setMax(e.target.value)} placeholder="+∞" /></label>
        <label>Score<input type="number" className={`${inp} ml-1 w-16`} value={score} onChange={(e) => setScore(e.target.value)} /></label>
        <label>Libellé<input className={`${inp} ml-1 w-36`} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <Button variant="outline" disabled={pending} onClick={() => run(async () => { const r = await addRange({ criterionId: crit.id, minIncl: min, maxExcl: max, score: score || "0", label }); if (r.ok) { setMin(""); setMax(""); setScore(""); setLabel(""); } return r; })}>+ Barème</Button>
      </div>
    </div>
  );
}

function AddCriterion({ domainId, run, pending }: { domainId: string; run: RunFn; pending: boolean }) {
  const [f, setF] = useState({ code: "", name: "", type: "QUAL", weight: "", inputKey: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="flex items-end gap-1 text-xs flex-wrap bg-muted/40 rounded-md p-2">
      <span className="self-center font-medium">+ Critère :</span>
      <label>Code<input className={`${inp} ml-1 w-20`} value={f.code} onChange={set("code")} /></label>
      <label>Nom<input className={`${inp} ml-1 w-44`} value={f.name} onChange={set("name")} /></label>
      <label>Type<select className={`${inp} ml-1`} value={f.type} onChange={set("type")}><option value="QUAL">Qualitatif</option><option value="NUM">Numérique</option></select></label>
      <label>Poids<input type="number" step="0.01" className={`${inp} ml-1 w-16`} value={f.weight} onChange={set("weight")} /></label>
      <label>Clé<input className={`${inp} ml-1 w-36`} value={f.inputKey} onChange={set("inputKey")} /></label>
      <Button variant="outline" disabled={pending || !f.code || !f.name || !f.inputKey} onClick={() => run(async () => { const r = await addCriterion({ domainId, ...f, weight: f.weight || "0" }); if (r.ok) setF({ code: "", name: "", type: "QUAL", weight: "", inputKey: "" }); return r; })}>Ajouter</Button>
    </div>
  );
}

function AddDomain({ versionId, run, pending }: { versionId: string; run: RunFn; pending: boolean }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [weight, setWeight] = useState("");
  return (
    <Card>
      <CardContent className="flex items-end gap-2 flex-wrap text-sm pt-4">
        <span className="self-center font-medium">+ Domaine :</span>
        <label className="text-xs">Code<input className={`${inp} ml-1 w-24`} value={code} onChange={(e) => setCode(e.target.value)} /></label>
        <label className="text-xs">Nom<input className={`${inp} ml-1 w-64`} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="text-xs">Poids<input type="number" step="0.01" className={`${inp} ml-1 w-20`} value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        <Button disabled={pending || !code || !name} onClick={() => run(async () => { const r = await addDomain({ versionId, code, name, weight: weight || "0" }); if (r.ok) { setCode(""); setName(""); setWeight(""); } return r; })}>Ajouter le domaine</Button>
      </CardContent>
    </Card>
  );
}

function RedFlagsCard({ versionId, redFlags, run, pending }: { versionId: string; redFlags: RedFlag[]; run: RunFn; pending: boolean }) {
  const [f, setF] = useState({ code: "", name: "", ruleKey: "", ruleOp: "gte", ruleValue: "", severity: "HIGH", malus: "", impactDomains: "D5", mitigable: false });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Card>
      <CardHeader><CardTitle>Red flags (D5)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <thead><tr><Th>Code</Th><Th>Nom</Th><Th>Sévérité</Th><Th>Malus</Th><Th>Domaines</Th><Th></Th></tr></thead>
          <tbody>
            {redFlags.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono">{r.code}</Td><Td>{r.name}</Td>
                <Td><Badge className={TONE.neutral}>{r.severity}</Badge></Td>
                <Td>{r.malus > 0 ? `−${r.malus}` : "auto"}</Td><Td>{r.impactDomains.join(", ")}</Td>
                <Td><ConfirmButton variant="ghost" className="px-1.5 py-0.5 text-red-600" aria-label={`Supprimer l'alerte ${r.code}`} disabled={pending}
                  title={`Supprimer l'alerte ${r.code} ?`} confirmLabel="Supprimer" onConfirm={() => run(() => deleteRedFlag(r.id))}>✕</ConfirmButton></Td>
              </tr>
            ))}
            {redFlags.length === 0 && <tr><Td className="text-muted-foreground">Aucun red flag.</Td></tr>}
          </tbody>
        </Table>
        <div className="flex items-end gap-1 text-xs flex-wrap bg-muted/40 rounded-md p-2">
          <label>Code<input className={`${inp} ml-1 w-24`} value={f.code} onChange={set("code")} /></label>
          <label>Nom<input className={`${inp} ml-1 w-48`} value={f.name} onChange={set("name")} /></label>
          <label>Clé<input className={`${inp} ml-1 w-32`} value={f.ruleKey} onChange={set("ruleKey")} /></label>
          <label>Op<select className={`${inp} ml-1`} value={f.ruleOp} onChange={set("ruleOp")}>{["gte", "gt", "lte", "lt", "eq", "neq", "in", "isTrue", "isFalse"].map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label>Valeur<input className={`${inp} ml-1 w-24`} value={f.ruleValue} onChange={set("ruleValue")} /></label>
          <label>Sévérité<select className={`${inp} ml-1`} value={f.severity} onChange={set("severity")}>{["LOW", "MEDIUM", "HIGH", "BLOCKING"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Malus<input type="number" className={`${inp} ml-1 w-16`} value={f.malus} onChange={set("malus")} /></label>
          <label>Domaines<input className={`${inp} ml-1 w-20`} value={f.impactDomains} onChange={set("impactDomains")} /></label>
          <Button variant="outline" disabled={pending || !f.code || !f.name || !f.ruleKey} onClick={() => run(async () => { const r = await addRedFlag({ versionId, ...f, malus: f.malus || "0" }); if (r.ok) setF({ code: "", name: "", ruleKey: "", ruleOp: "gte", ruleValue: "", severity: "HIGH", malus: "", impactDomains: "D5", mitigable: false }); return r; })}>+ Red flag</Button>
        </div>
      </CardContent>
    </Card>
  );
}
