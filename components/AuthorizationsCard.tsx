"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Th, Td, Stat } from "@/components/ui";
import { saveProjectAuthorizations, updateProgramSettings } from "@/server/actions/morocco";
import { TONE } from "@/lib/tones";

export interface AuthorizationRow {
  code: string;
  label: string;
  stage: string;
  regRef?: string;
  blocksWorks: boolean;
  blocksDelivery: boolean;
  obtained: boolean;
  obtainedAt: string | null; // ISO
  reference: string | null;
}

interface Props {
  projectId: string;
  programKind: string;
  releaseQuotity: number | null;
  rows: AuthorizationRow[];
  completenessPct: number;
  worksBlocked: boolean;
  blockingWorksLabels: string[];
  blockingDeliveryLabels: string[];
  canEdit: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  ETUDE: "Étude", OCTROI: "Octroi", SIGNATURE: "Signature", TIRAGE: "Tirage",
};
const KIND_LABELS: Record<string, string> = {
  LOTISSEMENT: "Lotissement", CONSTRUCTION: "Construction", MIXTE: "Mixte",
};

export function AuthorizationsCard(p: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(p.rows);
  const [kind, setKind] = useState(p.programKind);
  const [quotity, setQuotity] = useState(
    p.releaseQuotity != null ? String(Math.round(p.releaseQuotity * 10000) / 100) : "",
  );

  const input = "w-full rounded-md border border-border bg-background px-2 py-1 text-sm";

  function setRow(code: string, patch: Partial<AuthorizationRow>) {
    setRows((rs) => rs.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const settings = await updateProgramSettings(p.projectId, {
        programKind: kind,
        releaseQuotityPct: quotity,
      });
      if (!settings.ok) {
        setError(settings.error ?? "Paramètres du programme invalides.");
        return;
      }
      const res = await saveProjectAuthorizations(
        p.projectId,
        rows.map((r) => ({
          code: r.code,
          obtained: r.obtained,
          obtainedAt: r.obtainedAt,
          reference: r.reference,
        })),
      );
      if (!res.ok) {
        setError(res.error ?? "Enregistrement impossible.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle>Foncier, autorisations & désengagement</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={TONE.neutral}>
              {KIND_LABELS[p.programKind] ?? p.programKind}
            </Badge>
            {p.worksBlocked ? (
              <Badge className={TONE.danger}>Tirage travaux bloqué</Badge>
            ) : (
              <Badge className={TONE.success}>Tirage travaux autorisé</Badge>
            )}
            {p.canEdit && !editing && (
              <Button onClick={() => setEditing(true)}>Modifier</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Stat label="Complétude de la chaîne" value={`${p.completenessPct.toFixed(0)} %`}
                hint={`${p.rows.filter((r) => r.obtained).length}/${p.rows.length} pièces obtenues`} />
          <Stat label="Nature du programme" value={KIND_LABELS[p.programKind] ?? p.programKind}
                hint="détermine les pièces exigibles" />
          <Stat label="Quotité de désengagement"
                value={p.releaseQuotity != null ? `${(p.releaseQuotity * 100).toFixed(0)} %` : "—"}
                hint="part du prix affectée au remboursement" />
        </div>

        {p.worksBlocked && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <span className="font-medium">Verrou de tirage</span> — pièce(s) indispensable(s) aux travaux financés
            manquante(s) : {p.blockingWorksLabels.join(", ")}. Aucun décaissement de travaux ne doit être autorisé
            tant que la condition n&apos;est pas levée (ce n&apos;est pas un défaut bancaire).
          </div>
        )}
        {!p.worksBlocked && p.blockingDeliveryLabels.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span className="font-medium">Conditions de livraison</span> — restent à lever : {p.blockingDeliveryLabels.join(", ")}.
          </div>
        )}

        {editing ? (
          <form onSubmit={onSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block mb-1 font-medium">Nature du programme</span>
                <select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="block mb-1 font-medium">Quotité de désengagement (%)</span>
                <input className={input} value={quotity} onChange={(e) => setQuotity(e.target.value)}
                       placeholder="ex. 70" inputMode="decimal" />
              </label>
            </div>

            <Table>
              <thead><tr><Th>Obtenue</Th><Th>Pièce</Th><Th>Jalon</Th><Th>Date</Th><Th>Référence</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <Td>
                      <input type="checkbox" checked={r.obtained}
                             onChange={(e) => setRow(r.code, { obtained: e.target.checked })} />
                    </Td>
                    <Td>
                      <div className="font-medium">{r.label}</div>
                      {r.regRef && <div className="text-xs text-muted-foreground">{r.regRef}</div>}
                    </Td>
                    <Td>{STAGE_LABELS[r.stage] ?? r.stage}</Td>
                    <Td>
                      <input type="date" className={input} value={r.obtainedAt ? r.obtainedAt.slice(0, 10) : ""}
                             onChange={(e) => setRow(r.code, { obtainedAt: e.target.value || null })} />
                    </Td>
                    <Td>
                      <input className={input} value={r.reference ?? ""} placeholder="n° acte"
                             onChange={(e) => setRow(r.code, { reference: e.target.value || null })} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setRows(p.rows); setError(null); }}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Table>
            <thead><tr><Th>Pièce</Th><Th>Jalon</Th><Th>Verrou</Th><Th>État</Th><Th>Date</Th><Th>Référence</Th></tr></thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.code} className={!r.obtained && r.blocksWorks ? "bg-red-50" : undefined}>
                  <Td>
                    <div className="font-medium">{r.label}</div>
                    {r.regRef && <div className="text-xs text-muted-foreground">{r.regRef}</div>}
                  </Td>
                  <Td>{STAGE_LABELS[r.stage] ?? r.stage}</Td>
                  <Td>
                    {r.blocksWorks ? <Badge className={TONE.danger}>Travaux</Badge>
                      : r.blocksDelivery ? <Badge className={TONE.warning}>Livraison</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </Td>
                  <Td>
                    {r.obtained
                      ? <Badge className={TONE.success}>Obtenue</Badge>
                      : <Badge className={TONE.neutral}>Manquante</Badge>}
                  </Td>
                  <Td>{r.obtainedAt ? new Date(r.obtainedAt).toLocaleDateString("fr-MA") : "—"}</Td>
                  <Td className="text-muted-foreground">{r.reference ?? "—"}</Td>
                </tr>
              ))}
              {p.rows.length === 0 && <tr><Td>Aucune pièce exigible pour cette nature de programme.</Td></tr>}
            </tbody>
          </Table>
        )}

        <p className="text-xs text-muted-foreground">
          Les pièces exigibles et leurs verrous proviennent du référentiel administrable
          (Administration → Référentiels métier) : elles s&apos;adaptent sans redéploiement.
        </p>
      </CardContent>
    </Card>
  );
}
