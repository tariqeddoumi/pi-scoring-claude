"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Th, Td } from "@/components/ui";
import { upsertReferentialItem, toggleReferentialItem } from "@/server/actions/morocco";

export interface RefRow {
  kind: string;
  code: string;
  label: string;
  orderIndex: number;
  active: boolean;
  config: string; // JSON formaté
  note: string | null;
}

interface Props {
  kind: string;
  title: string;
  hint: string;
  configHint: string;
  rows: RefRow[];
  canEdit: boolean;
}

const EMPTY: RefRow = { kind: "", code: "", label: "", orderIndex: 0, active: true, config: "{}", note: null };

export function ReferentialEditor(p: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<RefRow>({ ...EMPTY, kind: p.kind });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = "w-full rounded-md border border-border bg-background px-2 py-1 text-sm";

  function startEdit(r: RefRow) {
    setEditing(r.code);
    setForm({ ...r });
    setError(null);
  }
  function startNew() {
    setEditing("__new__");
    setForm({ ...EMPTY, kind: p.kind, orderIndex: p.rows.length });
    setError(null);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await upsertReferentialItem({
        kind: p.kind,
        code: form.code,
        label: form.label,
        orderIndex: Number(form.orderIndex) || 0,
        active: form.active,
        config: form.config,
        note: form.note,
      });
      if (!res.ok) {
        setError(res.error ?? "Enregistrement impossible.");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onToggle(r: RefRow) {
    setPending(true);
    try {
      await toggleReferentialItem(p.kind, r.code, !r.active);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{p.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{p.hint}</p>
          </div>
          {p.canEdit && editing === null && <Button onClick={startNew}>Ajouter</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <thead><tr><Th>Ordre</Th><Th>Code</Th><Th>Libellé</Th><Th>Paramétrage</Th><Th>État</Th><Th></Th></tr></thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.code} className={!r.active ? "opacity-50" : undefined}>
                <Td>{r.orderIndex}</Td>
                <Td className="font-mono text-xs">{r.code}</Td>
                <Td>
                  <div className="font-medium">{r.label}</div>
                  {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                </Td>
                <Td><code className="text-xs text-muted-foreground">{r.config}</code></Td>
                <Td>
                  {r.active
                    ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Actif</Badge>
                    : <Badge className="bg-slate-100 text-slate-700 border-slate-300">Inactif</Badge>}
                </Td>
                <Td>
                  {p.canEdit && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => startEdit(r)}>Éditer</Button>
                      <Button variant="ghost" disabled={pending} onClick={() => onToggle(r)}>
                        {r.active ? "Désactiver" : "Activer"}
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
            {p.rows.length === 0 && (
              <tr><Td>Aucun item — les valeurs par défaut du code s&apos;appliquent.</Td></tr>
            )}
          </tbody>
        </Table>

        {editing !== null && (
          <form onSubmit={onSave} className="space-y-3 rounded-md border border-border p-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <label className="text-sm">
                <span className="block mb-1 font-medium">Code</span>
                <input className={input} value={form.code} disabled={editing !== "__new__"}
                       onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="minuscules_et_tirets_bas" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block mb-1 font-medium">Libellé</span>
                <input className={input} value={form.label}
                       onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="block mb-1 font-medium">Ordre</span>
                <input className={input} type="number" value={form.orderIndex}
                       onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} />
              </label>
            </div>
            <label className="text-sm block">
              <span className="block mb-1 font-medium">Paramétrage (JSON)</span>
              <textarea className={input + " font-mono"} rows={3} value={form.config}
                        onChange={(e) => setForm({ ...form, config: e.target.value })} />
              <span className="text-xs text-muted-foreground">{p.configHint}</span>
            </label>
            <label className="text-sm block">
              <span className="block mb-1 font-medium">Note</span>
              <input className={input} value={form.note ?? ""}
                     onChange={(e) => setForm({ ...form, note: e.target.value || null })} />
            </label>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={form.active}
                     onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Actif</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setError(null); }}>Annuler</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
