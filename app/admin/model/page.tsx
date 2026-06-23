import { getActiveModel } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { formatPercent } from "@/lib/utils";
import { SEVERITY_LABELS, SEVERITY_COLORS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ModelBuilderPage() {
  const res = await safe(getActiveModel);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const v = res.data;
  if (!v) return <p className="text-muted-foreground">Aucun modèle publié.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Model Builder — {v.model.name}</h1>
        <p className="text-sm text-muted-foreground">Version {v.version} · {v.status} · échelle KPI 0..{v.scoreScale}</p>
      </div>

      {v.domains.map((d) => (
        <Card key={d.id}>
          <CardHeader><CardTitle>{d.code} — {d.name} <span className="text-muted-foreground font-normal">(poids {formatPercent(d.weight * 100, 0)})</span></CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead><tr><Th>Critère</Th><Th>Type</Th><Th>Poids</Th><Th>Barème / Modalités</Th><Th>Gate</Th></tr></thead>
              <tbody>
                {d.criteria.map((c) => (
                  <tr key={c.id}>
                    <Td>{c.code} — {c.name}</Td>
                    <Td>{c.type}</Td>
                    <Td>{formatPercent(c.weight * 100, 0)}</Td>
                    <Td className="text-xs">
                      {c.type === "QUAL"
                        ? c.options.sort((a,b)=>a.orderIndex-b.orderIndex).map((o) => `${o.label}=${o.score}`).join(" · ")
                        : c.ranges.sort((a,b)=>a.orderIndex-b.orderIndex).map((r) => `${r.label ?? ""}=${r.score}`).join(" · ")}
                    </Td>
                    <Td>{c.isGate ? `≤ ${c.gateThreshold}` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader><CardTitle>D5 — Red flags & déclencheurs de souffrance</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Code</Th><Th>Règle</Th><Th>Sévérité</Th><Th>Malus</Th><Th>Domaines</Th></tr></thead>
            <tbody>
              {v.redFlags.map((r) => (
                <tr key={r.id}>
                  <Td>{r.code}</Td>
                  <Td>{r.name}</Td>
                  <Td><Badge className={SEVERITY_COLORS[r.severity]}>{SEVERITY_LABELS[r.severity]}</Badge></Td>
                  <Td>{r.malus > 0 ? `−${r.malus}` : "auto"}</Td>
                  <Td>{r.impactDomains.join(", ")}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
