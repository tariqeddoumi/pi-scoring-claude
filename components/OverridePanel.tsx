"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Table, Th, Td } from "@/components/ui";
import { CLASS_LABELS } from "@/lib/labels";
import { requestRegulatoryOverride, decideRegulatoryOverride } from "@/server/actions/overrides";
import type { RegulatoryClassCode } from "@/lib/domain/types";

export interface OverrideRow {
  id: string;
  forcedClass: RegulatoryClassCode;
  engineClass: RegulatoryClassCode | null;
  justification: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  active: boolean;
  requestedBy: string;
  decidedBy: string | null;
  createdAt: string;
}

const CLASS_CODES: RegulatoryClassCode[] = ["SAIN", "SENSIBLE", "PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-slate-100 text-slate-600 border-slate-300",
};

export function OverridePanel({
  projectId,
  overrides,
  canValidate,
}: {
  projectId: string;
  overrides: OverrideRow[];
  canValidate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [forcedClass, setForcedClass] = useState<RegulatoryClassCode>("SENSIBLE");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Échec");
      else { setJustification(""); router.refresh(); }
    });

  return (
    <div className="space-y-3">
      {overrides.length > 0 && (
        <Table>
          <thead><tr><Th>Classe forcée</Th><Th>Moteur</Th><Th>Statut</Th><Th>Justification</Th><Th>Demandé / décidé par</Th>{canValidate && <Th>Action</Th>}</tr></thead>
          <tbody>
            {overrides.map((o) => (
              <tr key={o.id}>
                <Td><Badge className="bg-purple-100 text-purple-800 border-purple-300">{CLASS_LABELS[o.forcedClass]}</Badge>{o.active && <span className="ml-1 text-xs text-emerald-700">(en vigueur)</span>}</Td>
                <Td className="text-muted-foreground">{o.engineClass ? CLASS_LABELS[o.engineClass] : "—"}</Td>
                <Td><Badge className={STATUS_COLORS[o.status]}>{o.status}</Badge></Td>
                <Td className="text-xs max-w-xs">{o.justification}</Td>
                <Td className="text-xs text-muted-foreground">{o.requestedBy}{o.decidedBy ? ` → ${o.decidedBy}` : ""}</Td>
                {canValidate && (
                  <Td>
                    {o.status === "PENDING" ? (
                      <div className="flex gap-1">
                        <Button className="text-xs px-2 py-1" disabled={pending} onClick={() => run(() => decideRegulatoryOverride(o.id, true))}>Approuver</Button>
                        <Button variant="outline" className="text-xs px-2 py-1" disabled={pending} onClick={() => run(() => decideRegulatoryOverride(o.id, false))}>Rejeter</Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {canValidate ? (
        <div className="rounded-md border border-border p-3 space-y-2">
          <p className="text-sm font-medium">Demander une dérogation</p>
          <div className="flex flex-wrap items-start gap-2">
            <select value={forcedClass} onChange={(e) => setForcedClass(e.target.value as RegulatoryClassCode)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
              {CLASS_CODES.map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
            </select>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Justification (≥ 10 caractères) — motif de la dérogation comité"
              className="flex-1 min-w-[16rem] rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              rows={2}
            />
            <Button disabled={pending || justification.trim().length < 10} onClick={() => run(() => requestRegulatoryOverride(projectId, forcedClass, justification))}>
              Soumettre
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        overrides.length === 0 && <p className="text-sm text-muted-foreground">Aucune dérogation. Réservé au rôle de validation.</p>
      )}
    </div>
  );
}
