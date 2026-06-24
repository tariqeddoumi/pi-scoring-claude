import Link from "next/link";
import { getPortfolioStats } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge, Table, Th, Td } from "@/components/ui";
import { PortfolioChart } from "@/components/PortfolioChart";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { formatMAD } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const res = await safe(getPortfolioStats);
  if (!res.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tableau de bord portefeuille</h1>
        <DbSetupNotice error={res.error} />
      </div>
    );
  }
  const { total, byClass, byDecision, totalProvision, totalExposure, projects } = res.data;
  const coverage = totalExposure > 0 ? (totalProvision / totalExposure) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord portefeuille</h1>
          <p className="text-muted-foreground text-sm">Promotion immobilière · classification & provisionnement BKAM</p>
        </div>
        <a href="/api/export/portfolio" className="text-sm rounded-md border border-border px-3 py-2 hover:bg-muted">
          Export portefeuille (Excel/CSV)
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Projets suivis" value={total} />
        <Stat label="Exposition totale" value={formatMAD(totalExposure)} />
        <Stat label="Provisions BKAM" value={formatMAD(totalProvision)} />
        <Stat label="Taux de couverture" value={`${coverage.toFixed(1)} %`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Répartition par classe BKAM</CardTitle></CardHeader>
          <CardContent><PortfolioChart data={byClass} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Décisions de scoring</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(byDecision).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun scoring exécuté pour l'instant.</p>
            )}
            {Object.entries(byDecision).map(([dec, n]) => (
              <div key={dec} className="flex items-center justify-between">
                <Badge className={DECISION_COLORS[dec as keyof typeof DECISION_COLORS]}>
                  {DECISION_LABELS[dec as keyof typeof DECISION_LABELS] ?? dec}
                </Badge>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Projets récents</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Référence</Th><Th>Projet</Th><Th>Promoteur</Th>
                <Th>Classe BKAM</Th><Th>Décision</Th><Th>Provision</Th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 8).map((p) => {
                const cls = p.classificationRuns[0]?.resultClass;
                const dec = p.scoringRuns[0]?.decision;
                return (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <Td><Link className="text-primary hover:underline" href={`/projects/${p.id}`}>{p.reference}</Link></Td>
                    <Td>{p.name}</Td>
                    <Td>{p.promoter.name}</Td>
                    <Td>{cls ? <Badge className={CLASS_COLORS[cls]}>{CLASS_LABELS[cls]}</Badge> : "—"}</Td>
                    <Td>{dec ? <Badge className={DECISION_COLORS[dec]}>{DECISION_LABELS[dec]}</Badge> : "—"}</Td>
                    <Td>{formatMAD(p.provisionRuns[0]?.provisionAmount)}</Td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr><Td className="text-muted-foreground" >Aucun projet. Exécutez le seed.</Td></tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
