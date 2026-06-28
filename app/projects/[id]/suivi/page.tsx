import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectMonitoring } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge, Stat, Table, Th, Td } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { formatMAD, formatDate, formatPercent } from "@/lib/utils";
import { standingLabel, type StandingCode } from "@/lib/domain/commercialisation";

export const dynamic = "force-dynamic";

const TRANCHE_STATUS_LABELS: Record<string, string> = {
  PLANIFIEE: "Planifiée",
  EN_TRAVAUX: "En travaux",
  LIVREE: "Livrée",
  CLOTUREE: "Clôturée",
};
const TRANCHE_STATUS_COLORS: Record<string, string> = {
  PLANIFIEE: "bg-slate-100 text-slate-700 border-slate-300",
  EN_TRAVAUX: "bg-blue-100 text-blue-800 border-blue-300",
  LIVREE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CLOTUREE: "bg-violet-100 text-violet-800 border-violet-300",
};
const UNIT_STATUS_LABELS: Record<string, string> = {
  DISPONIBLE: "Disponible",
  RESERVE: "Réservé",
  COMPROMIS: "Compromis",
  VENDU: "Vendu",
  LIVRE: "Livré",
  DESISTE: "Désisté",
};
const UNIT_STATUS_COLORS: Record<string, string> = {
  DISPONIBLE: "bg-slate-100 text-slate-700 border-slate-300",
  RESERVE: "bg-amber-100 text-amber-800 border-amber-300",
  COMPROMIS: "bg-blue-100 text-blue-800 border-blue-300",
  VENDU: "bg-emerald-100 text-emerald-800 border-emerald-300",
  LIVRE: "bg-emerald-200 text-emerald-900 border-emerald-400",
  DESISTE: "bg-red-100 text-red-800 border-red-300",
};
const UNIT_TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: "Appartement",
  VILLA: "Villa",
  COMMERCE: "Commerce",
  BUREAU: "Bureau",
  TERRAIN: "Terrain",
  AUTRE: "Autre",
};

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{v.toFixed(0)}%</span>
    </div>
  );
}

export default async function ProjectMonitoringPage({ params }: { params: { id: string } }) {
  const res = await safe(() => getProjectMonitoring(params.id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const data = res.data;
  if (!data) return notFound();

  const { project, tranches, summary } = data;
  const { sales, revenue, byTranche, byStanding, byType, businessPlan, standingChanges, mainlevees } = summary;
  const hasUnits = sales.totalUnits > 0 || sales.withdrawn > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">← {project.name}</Link>
        <h1 className="text-2xl font-bold">Suivi de commercialisation</h1>
        <p className="text-muted-foreground text-sm">{project.reference} · {tranches.length} tranche(s) · {sales.totalUnits} lot(s) actif(s)</p>
      </div>

      {!hasUnits ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Aucune tranche ni lot enregistré pour ce projet. Ajoutez des tranches et des lots pour activer le suivi de commercialisation.
        </CardContent></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Taux de prévente" value={formatPercent(sales.preSaleRatePct, 1)} hint={`${sales.committedUnits}/${sales.totalUnits} lots engagés`} />
            <Stat label="Ventes fermes" value={formatPercent(sales.firmSaleRatePct, 1)} hint={`${sales.firmUnits} vendus / livrés`} />
            <Stat label="CA réalisé" value={formatMAD(revenue.caRealise)} hint={`sur ${formatMAD(revenue.caPrevu)} prévu`} />
            <Stat label="Taux de réalisation CA" value={formatPercent(revenue.tauxRealisationPct, 1)} hint={`+ ${formatMAD(revenue.caReserve)} réservé`} />
          </div>

          {/* Décalage business plan */}
          <Card>
            <CardHeader><CardTitle>Décalage par rapport au business plan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Lots en retard" value={String(businessPlan.unitsLate)} hint="date de vente dépassée" />
                <Stat label="Écart de CA" value={formatMAD(businessPlan.caDeltaAmount)} hint={formatPercent(businessPlan.caDeltaPct, 1)} />
                <Stat label="Écart prix moyen" value={formatPercent(businessPlan.avgPriceDeviationPct, 1)} hint="vs prix BP (pondéré)" />
                <Stat label="Écarts de prix" value={String(businessPlan.priceDeviations.length)} hint="lots hors prix BP" />
              </div>

              {businessPlan.scheduleSlips.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Retards de calendrier</p>
                  <Table>
                    <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Date de vente prévue</Th><Th>Retard</Th></tr></thead>
                    <tbody>
                      {businessPlan.scheduleSlips.map((s) => (
                        <tr key={s.reference}>
                          <Td className="font-medium">{s.reference}</Td>
                          <Td>{s.trancheCode}</Td>
                          <Td>{formatDate(s.plannedSaleDate)}</Td>
                          <Td className="text-red-600">{s.daysLate} j</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {businessPlan.priceDeviations.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Écarts de prix vs business plan</p>
                  <Table>
                    <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Prix BP</Th><Th>Prix vente</Th><Th>Écart</Th></tr></thead>
                    <tbody>
                      {businessPlan.priceDeviations.map((d) => (
                        <tr key={d.reference}>
                          <Td className="font-medium">{d.reference}</Td>
                          <Td>{d.trancheCode}</Td>
                          <Td>{formatMAD(d.plannedPrice)}</Td>
                          <Td>{formatMAD(d.soldPrice)}</Td>
                          <Td className={d.deltaAmount < 0 ? "text-red-600" : "text-emerald-600"}>
                            {formatMAD(d.deltaAmount)} ({formatPercent(d.deltaPct, 1)})
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Changements de standing */}
          {standingChanges.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Changements de standing</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Standing prévu</Th><Th>Standing actuel</Th><Th>Sens</Th></tr></thead>
                  <tbody>
                    {standingChanges.map((c) => (
                      <tr key={c.reference}>
                        <Td className="font-medium">{c.reference}</Td>
                        <Td>{c.trancheCode}</Td>
                        <Td>{c.plannedLabel}</Td>
                        <Td>{c.currentLabel}</Td>
                        <Td>
                          <Badge className={c.direction === "DOWNGRADE" ? "bg-red-100 text-red-800 border-red-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"}>
                            {c.direction === "DOWNGRADE" ? `Déclassement (−${c.rankDelta})` : `Montée en gamme (+${-c.rankDelta})`}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Mainlevées */}
          <Card>
            <CardHeader><CardTitle>Suivi des mainlevées</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat label="Lots vendus" value={String(mainlevees.soldUnits)} />
                <Stat label="Mainlevées obtenues" value={String(mainlevees.releasedUnits)} hint={formatPercent(mainlevees.releaseRatePct, 1)} />
                <Stat label="En attente" value={String(mainlevees.pendingUnits)} hint="hypothèque à lever" />
                <Stat label="Montant levé" value={formatMAD(mainlevees.releasedAmount)} />
              </div>
              {mainlevees.pendingReferences.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Mainlevées en attente</p>
                  <Table>
                    <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Date de vente</Th></tr></thead>
                    <tbody>
                      {mainlevees.pendingReferences.map((m) => (
                        <tr key={m.reference}>
                          <Td className="font-medium">{m.reference}</Td>
                          <Td>{m.trancheCode}</Td>
                          <Td>{m.soldAt ? formatDate(m.soldAt) : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ventilations */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Avancement par tranche</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <thead><tr><Th>Tranche</Th><Th>Statut</Th><Th>Avancement</Th><Th>Ventes fermes</Th></tr></thead>
                  <tbody>
                    {tranches.map((t) => {
                      const bt = byTranche.find((b) => b.key === t.code);
                      return (
                        <tr key={t.id}>
                          <Td className="font-medium">{t.code}{t.name ? ` — ${t.name}` : ""}</Td>
                          <Td><Badge className={TRANCHE_STATUS_COLORS[t.status]}>{TRANCHE_STATUS_LABELS[t.status]}</Badge></Td>
                          <Td><ProgressBar value={t.progressPct} /></Td>
                          <Td>{bt ? `${bt.firmUnits}/${bt.totalUnits} (${formatPercent(bt.firmSaleRatePct, 0)})` : "—"}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ventes par standing</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <thead><tr><Th>Standing</Th><Th>Lots</Th><Th>Ventes fermes</Th><Th>CA réalisé</Th></tr></thead>
                  <tbody>
                    {byStanding.map((b) => (
                      <tr key={b.key}>
                        <Td className="font-medium">{b.label}</Td>
                        <Td>{b.totalUnits}</Td>
                        <Td>{b.firmUnits} ({formatPercent(b.firmSaleRatePct, 0)})</Td>
                        <Td>{formatMAD(b.caRealise)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Détail des lots */}
          <Card>
            <CardHeader><CardTitle>Détail des lots</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Type</Th><Th>Standing</Th><Th>Statut</Th><Th>Prix BP</Th><Th>Prix vente</Th><Th>Mainlevée</Th></tr></thead>
                <tbody>
                  {tranches.flatMap((t) =>
                    t.units.map((unit) => {
                      const downgrade = unit.standing !== unit.plannedStanding;
                      return (
                        <tr key={unit.id}>
                          <Td className="font-medium">{unit.reference}</Td>
                          <Td>{t.code}</Td>
                          <Td>{UNIT_TYPE_LABELS[unit.type] ?? unit.type}</Td>
                          <Td>
                            {standingLabel(unit.standing as StandingCode)}
                            {downgrade && <span className="text-red-600 text-xs"> (prévu : {standingLabel(unit.plannedStanding as StandingCode)})</span>}
                          </Td>
                          <Td><Badge className={UNIT_STATUS_COLORS[unit.status]}>{UNIT_STATUS_LABELS[unit.status]}</Badge></Td>
                          <Td>{formatMAD(unit.plannedPrice)}</Td>
                          <Td>{unit.soldPrice != null ? formatMAD(unit.soldPrice) : "—"}</Td>
                          <Td>{["VENDU", "LIVRE"].includes(unit.status) ? (unit.mortgageReleased ? "✓ Levée" : "En attente") : "—"}</Td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
