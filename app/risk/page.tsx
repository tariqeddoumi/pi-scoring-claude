import { getRiskDashboard } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge, Table, Th, Td } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatMAD, formatPercent } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS } from "@/lib/labels";
import type { ConcentrationRow } from "@/server/queries";

export const dynamic = "force-dynamic";

// Échelle de couleur de la heatmap selon l'intensité (0 = vide).
function cellClass(n: number, max: number): string {
  if (n === 0) return "bg-background text-muted-foreground";
  const r = max > 0 ? n / max : 0;
  if (r > 0.66) return "bg-primary text-primary-foreground font-semibold";
  if (r > 0.33) return "bg-primary/60 text-primary-foreground font-medium";
  return "bg-primary/25";
}

function ConcentrationTable({ title, rows, labelHeader }: { title: string; rows: ConcentrationRow[]; labelHeader: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <thead>
            <tr><Th>{labelHeader}</Th><Th>Dossiers</Th><Th>Exposition</Th><Th>Provisions</Th><Th>Couverture</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <Td className="font-medium">{r.key}</Td>
                <Td>{r.count}</Td>
                <Td>{formatMAD(r.exposure)}</Td>
                <Td>{formatMAD(r.provision)}</Td>
                <Td>{formatPercent(r.coverage, 1)}</Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td className="text-muted-foreground">Aucune donnée.</Td></tr>}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function RiskPage() {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_READ))) return <AccessDenied />;
  const res = await safe(getRiskDashboard);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const d = res.data;

  const maxCell = Math.max(
    1,
    ...d.classOrder.flatMap((c) => d.decisionOrder.map((dec) => d.heatmap[c]?.[dec] ?? 0)),
  );
  const hhiPct = d.hhi * 100;
  const hhiLabel = d.hhi > 0.25 ? "Forte" : d.hhi > 0.15 ? "Modérée" : "Faible";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vue risque portefeuille</h1>
        <p className="text-sm text-muted-foreground">
          Heatmap classe BKAM × décision, concentrations et expositions principales.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Dossiers classés" value={`${d.classified}/${d.total}`} />
        <Stat label="Exposition totale" value={formatMAD(d.totalExposure)} />
        <Stat label="Concentration (HHI)" value={`${hhiPct.toFixed(0)} pts`} hint={`${hhiLabel} · par promoteur`} />
        <Stat label="Promoteurs" value={d.byPromoter.length} />
      </div>

      <Card>
        <CardHeader><CardTitle>Heatmap — Classe BKAM × Décision de scoring</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Classe \ Décision</Th>
                {d.decisionOrder.map((dec) => (
                  <Th key={dec} className="text-center">{DECISION_LABELS[dec]}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.classOrder.map((cls) => (
                <tr key={cls}>
                  <Td><Badge className={CLASS_COLORS[cls]}>{CLASS_LABELS[cls]}</Badge></Td>
                  {d.decisionOrder.map((dec) => {
                    const n = d.heatmap[cls]?.[dec] ?? 0;
                    return (
                      <td key={dec} className={`px-3 py-2 border border-border/60 text-center ${cellClass(n, maxCell)}`}>
                        {n || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <ConcentrationTable title="Concentration par segment" rows={d.bySegment} labelHeader="Segment" />
        <ConcentrationTable title="Concentration par zone" rows={d.byZone} labelHeader="Zone" />
      </div>

      <ConcentrationTable title="Concentration par promoteur" rows={d.byPromoter} labelHeader="Promoteur" />

      <Card>
        <CardHeader><CardTitle>Top 10 expositions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr><Th>Référence</Th><Th>Projet</Th><Th>Promoteur</Th><Th>Classe</Th><Th>Décision</Th><Th>Exposition</Th><Th>Provision</Th></tr>
            </thead>
            <tbody>
              {d.topExposures.map((p) => (
                <tr key={p.id}>
                  <Td>{p.reference}</Td>
                  <Td>{p.name}</Td>
                  <Td>{p.promoter}</Td>
                  <Td>{p.cls ? <Badge className={CLASS_COLORS[p.cls]}>{CLASS_LABELS[p.cls]}</Badge> : "—"}</Td>
                  <Td>{p.dec ? DECISION_LABELS[p.dec] : "—"}</Td>
                  <Td>{formatMAD(p.exposure)}</Td>
                  <Td>{formatMAD(p.provision)}</Td>
                </tr>
              ))}
              {d.topExposures.length === 0 && <tr><Td className="text-muted-foreground">Aucun projet.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
