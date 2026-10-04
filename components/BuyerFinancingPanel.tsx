"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Table, Th, Td, Stat } from "@/components/ui";
import { updateUnitsBuyerFinancing } from "@/server/actions/morocco";
import { formatDecimal } from "@/lib/utils";
import { TONE } from "@/lib/tones";

export interface FinancingUnitRow {
  id: string;
  reference: string;
  trancheCode: string;
  status: string;
  price: number;
  financingStatus: string | null;
  aidScheme: string | null;
}

interface Props {
  projectId: string;
  units: FinancingUnitRow[];
  /** Référentiel administrable : statuts et facteurs de sécurisation. */
  financingOptions: { value: string; label: string; securityFactor: number }[];
  aidOptions: { value: string; label: string }[];
  canEdit: boolean;
}

const fmt = (n: number) => n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) + " MAD";

export function BuyerFinancingPanel(p: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(p.units);

  const factorOf = (code: string | null) =>
    p.financingOptions.find((o) => o.value === code)?.securityFactor ?? 0;
  const labelOf = (code: string | null) =>
    p.financingOptions.find((o) => o.value === code)?.label ?? null;

  // Synthèse : les lots engagés pondérés par la solidité du financement.
  const committed = rows.filter((r) => ["RESERVE", "COMPROMIS", "VENDU", "LIVRE"].includes(r.status));
  const gross = committed.reduce((s, r) => s + r.price, 0);
  const secured = committed.reduce((s, r) => s + r.price * factorOf(r.financingStatus), 0);
  const rate = gross > 0 ? (secured / gross) * 100 : 0;
  const missing = committed.filter((r) => !r.financingStatus).length;

  const input = "w-full rounded-md border border-border bg-background px-2 py-1 text-sm";

  function setRow(id: string, patch: Partial<FinancingUnitRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await updateUnitsBuyerFinancing(
        p.projectId,
        rows.map((r) => ({ unitId: r.id, financingStatus: r.financingStatus, aidScheme: r.aidScheme })),
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
          <CardTitle>Financement des acquéreurs (liquidité des ventes)</CardTitle>
          {p.canEdit && !editing && <Button onClick={() => setEditing(true)}>Renseigner</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Lots engagés" value={String(committed.length)} hint={`sur ${rows.length} lots`} />
          <Stat label="CA engagé" value={fmt(gross)} />
          <Stat label="CA sécurisé" value={fmt(secured)} hint="pondéré par le financement acquéreur" />
          <Stat label="Taux de sécurisation" value={`${formatDecimal(rate, 1)} %`}
                hint={missing > 0 ? `${missing} lot(s) sans statut renseigné` : "tous les lots renseignés"} />
        </div>

        {missing > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {missing} lot(s) engagé(s) sans statut de financement. Une réservation dont le crédit n&apos;est pas
            instruit n&apos;a pas la valeur de liquidité d&apos;un acte financé : renseignez le statut pour
            fiabiliser le critère « ventes sécurisées ».
          </div>
        )}

        {editing ? (
          <form onSubmit={onSave} className="space-y-3">
            <Table>
              <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Prix</Th><Th>Financement acquéreur</Th><Th>Dispositif d&apos;aide</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.reference}</Td>
                    <Td>{r.trancheCode}</Td>
                    <Td>{fmt(r.price)}</Td>
                    <Td>
                      <select className={input} value={r.financingStatus ?? ""}
                              onChange={(e) => setRow(r.id, { financingStatus: e.target.value || null })}>
                        <option value="">— non renseigné —</option>
                        {p.financingOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label} ({Math.round(o.securityFactor * 100)} %)
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <select className={input} value={r.aidScheme ?? ""}
                              onChange={(e) => setRow(r.id, { aidScheme: e.target.value || null })}>
                        <option value="">—</option>
                        {p.aidOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setRows(p.units); setError(null); }}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Table>
            <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Statut</Th><Th>Prix</Th><Th>Financement acquéreur</Th><Th>Aide</Th></tr></thead>
            <tbody>
              {p.units.map((r) => {
                const f = factorOf(r.financingStatus);
                return (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.reference}</Td>
                    <Td>{r.trancheCode}</Td>
                    <Td>{r.status}</Td>
                    <Td>{fmt(r.price)}</Td>
                    <Td>
                      {r.financingStatus
                        ? <Badge className={f >= 0.8 ? TONE.success
                            : f >= 0.4 ? TONE.warning
                            : TONE.danger}>
                            {labelOf(r.financingStatus)} · {Math.round(f * 100)} %
                          </Badge>
                        : <span className="text-muted-foreground">non renseigné</span>}
                    </Td>
                    <Td className="text-muted-foreground">
                      {p.aidOptions.find((a) => a.value === r.aidScheme)?.label ?? "—"}
                    </Td>
                  </tr>
                );
              })}
              {p.units.length === 0 && <tr><Td>Aucun lot enregistré.</Td></tr>}
            </tbody>
          </Table>
        )}

        <p className="text-xs text-muted-foreground">
          Statuts et facteurs de sécurisation proviennent du référentiel administrable
          (Administration → Référentiels métier) : ils se calibrent sans redéploiement.
        </p>
      </CardContent>
    </Card>
  );
}
