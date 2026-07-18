import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectMonitoring } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge, Stat, Table, Th, Td } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { formatMAD, formatDate, formatPercent } from "@/lib/utils";
import { standingLabel, type StandingCode } from "@/lib/domain/commercialisation";
import { TRANCHE_STATUSES, UNIT_STATUSES, UNIT_TYPES } from "@/lib/domain/referentiels";
import type { RiskLevel } from "@/lib/domain/visitReports";
import { VisitReportForm } from "@/components/VisitReportForm";
import { SyncToScoringButton } from "@/components/SyncToScoringButton";
import { ProjectEventsPanel } from "@/components/ProjectEventsPanel";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { DisbursementPlanCard } from "@/components/DisbursementPlanCard";
import { SyncCoreBankingButton } from "@/components/SyncCoreBankingButton";
import { BusinessPlanRevisionForm } from "@/components/BusinessPlanRevisionForm";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS, type RoleName } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const RISK_LABELS: Record<RiskLevel, string> = { FAIBLE: "Risque faible", MODERE: "Risque modéré", ELEVE: "Risque élevé" };
const RISK_COLORS: Record<RiskLevel, string> = {
  FAIBLE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  MODERE: "bg-amber-100 text-amber-800 border-amber-300",
  ELEVE: "bg-red-100 text-red-800 border-red-300",
};

// Libellés : source unique = référentiels. Couleurs : spécifiques à cet écran.
const TRANCHE_STATUS_COLORS: Record<string, string> = {
  PLANIFIEE: "bg-slate-100 text-slate-700 border-slate-300",
  EN_TRAVAUX: "bg-blue-100 text-blue-800 border-blue-300",
  LIVREE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CLOTUREE: "bg-violet-100 text-violet-800 border-violet-300",
};
const UNIT_STATUS_COLORS: Record<string, string> = {
  DISPONIBLE: "bg-slate-100 text-slate-700 border-slate-300",
  RESERVE: "bg-amber-100 text-amber-800 border-amber-300",
  COMPROMIS: "bg-blue-100 text-blue-800 border-blue-300",
  VENDU: "bg-emerald-100 text-emerald-800 border-emerald-300",
  LIVRE: "bg-emerald-200 text-emerald-900 border-emerald-400",
  DESISTE: "bg-red-100 text-red-800 border-red-300",
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

export default async function ProjectMonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await safe(() => getProjectMonitoring(id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const data = res.data;
  if (!data) return notFound();

  const { project, tranches, summary, reports, visitAnalysis, bpDrift, bpRevisions, unitsForRevision, timeline } = data;
  const { sales, revenue, byTranche, byStanding, byType, businessPlan, standingChanges, mainlevees } = summary;
  const hasUnits = sales.totalUnits > 0 || sales.withdrawn > 0;

  const actor = await getCurrentAppUser();
  const canWrite = actor ? hasPermission(actor.role.name as RoleName, PERMISSIONS.PROJECT_WRITE) : false;

  // Timeline sérialisée pour le composant client (dates ISO).
  const timelineView = timeline.map((t) => ({
    kind: t.kind,
    id: t.id,
    date: new Date(t.date).toISOString(),
    title: t.title,
    detail: t.detail ?? null,
    severity: t.severity,
    actor: t.actor ?? null,
    amount: t.amount ?? null,
    resolved: t.resolved,
    affectsScoring: t.affectsScoring,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">← {project.name}</Link>
        <h1 className="text-2xl font-bold">Suivi & événements</h1>
        <p className="text-muted-foreground text-sm">{project.reference} · {tranches.length} tranche(s) · {sales.totalUnits} lot(s) actif(s) · {reports.length} rapport(s) de visite</p>
      </div>

      <ProjectSubnav projectId={project.id} active="suivi" />

      {/* ===================== Rapports de visite & avancement chantier ===================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>Suivi de chantier — analyse des rapports de visite</CardTitle>
            <Badge className={RISK_COLORS[visitAnalysis.riskLevel]}>{RISK_LABELS[visitAnalysis.riskLevel]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Avancement constaté" value={visitAnalysis.trend.latestProgressPct != null ? formatPercent(visitAnalysis.trend.latestProgressPct, 0) : "—"} hint={visitAnalysis.trend.deltaPct != null ? `${visitAnalysis.trend.deltaPct >= 0 ? "+" : ""}${visitAnalysis.trend.deltaPct} pts vs visite préc.` : undefined} />
            <Stat label="Écart au plan" value={visitAnalysis.planGapPct != null ? `${visitAnalysis.planGapPct} pts` : "—"} hint={visitAnalysis.planGapPct != null ? (visitAnalysis.planGapPct > 0 ? "en retard" : "en avance") : "avancement officiel"} />
            <Stat label="Vitesse" value={visitAnalysis.trend.velocityPctPerMonth != null ? `${visitAnalysis.trend.velocityPctPerMonth} pts/mois` : "—"} />
            <Stat label="Dernière visite" value={visitAnalysis.latestVisitDate ? formatDate(visitAnalysis.latestVisitDate) : "—"} hint={visitAnalysis.daysSinceLastVisit != null ? `il y a ${visitAnalysis.daysSinceLastVisit} j` : undefined} />
          </div>

          {visitAnalysis.findings.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Informations pertinentes</p>
              <ul className="text-sm list-disc pl-5 space-y-0.5">
                {visitAnalysis.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {visitAnalysis.anomalies.openIssues.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Anomalies ouvertes :</span>
              {visitAnalysis.anomalies.openIssues.includes("weather") && <Badge className="bg-sky-100 text-sky-800 border-sky-300">Intempéries</Badge>}
              {visitAnalysis.anomalies.openIssues.includes("quality") && <Badge className="bg-orange-100 text-orange-800 border-orange-300">Qualité</Badge>}
              {visitAnalysis.anomalies.openIssues.includes("safety") && <Badge className="bg-red-100 text-red-800 border-red-300">Sécurité</Badge>}
              {visitAnalysis.anomalies.openIssues.includes("delay") && <Badge className="bg-amber-100 text-amber-800 border-amber-300">Retard</Badge>}
            </div>
          )}

          {reports.length > 0 && (
            <Table>
              <thead><tr><Th>Date</Th><Th>Tranche</Th><Th>Avanc.</Th><Th>Effectif</Th><Th>Anomalies</Th><Th>Statut</Th><Th>Contrôleur</Th></tr></thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap font-medium">{formatDate(r.visitDate)}</Td>
                    <Td>{r.trancheCode ?? "—"}</Td>
                    <Td>{r.observedProgressPct != null ? formatPercent(r.observedProgressPct, 0) : "—"}</Td>
                    <Td>{r.workforceCount ?? "—"}</Td>
                    <Td className="space-x-1">
                      {r.weatherImpact && <span title="Intempéries">🌧️</span>}
                      {r.qualityIssue && <span title="Qualité">⚠️</span>}
                      {r.safetyIssue && <span title="Sécurité">🦺</span>}
                      {r.delayRisk && <span title="Retard">⏱️</span>}
                      {!r.weatherImpact && !r.qualityIssue && !r.safetyIssue && !r.delayRisk && <span className="text-muted-foreground">—</span>}
                    </Td>
                    <Td>{r.status === "FINALIZED" ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Finalisé</Badge> : <Badge className="bg-slate-100 text-slate-700 border-slate-300">Brouillon</Badge>}</Td>
                    <Td className="text-muted-foreground">{r.inspectorName ?? r.author?.name ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {canWrite && <VisitReportForm projectId={project.id} />}
        </CardContent>
      </Card>

      {data.disbursement.alert && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <span className="font-medium">Décaissements en avance de phase</span> — {data.disbursement.reason}{" "}
          Vigilance renforcée recommandée (visite de chantier, justification de l&apos;emploi des fonds).
        </div>
      )}

      {/* ===================== Planning des déblocages (BP initial) ===================== */}
      <DisbursementPlanCard
        projectId={project.id}
        rows={data.disbursementPlan.rows.map((r) => ({
          ...r,
          plannedDate: r.plannedDate ? new Date(r.plannedDate).toISOString() : null,
        }))}
        unlinked={data.disbursementPlan.unlinked.map((e) => ({
          id: e.id,
          eventDate: new Date(e.eventDate).toISOString(),
          amount: e.amount,
          title: e.title,
          source: e.source,
        }))}
        totals={data.disbursementPlan.totals}
        canWrite={canWrite}
      />

      {canWrite && <SyncCoreBankingButton projectId={project.id} />}

      {/* ===================== Journal du projet (tous événements) ===================== */}
      <ProjectEventsPanel projectId={project.id} timeline={timelineView} canWrite={canWrite} />

      {canWrite && (
        <Card>
          <CardHeader><CardTitle>Alimenter le scoring depuis le suivi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <SyncToScoringButton projectId={project.id} />
            <p className="text-xs text-muted-foreground">
              Synchronise la commercialisation, l&apos;avancement chantier ET les événements matériels du journal
              (arrêt de chantier, litige, saisie, restructuration…) vers les entrées de scoring/classification 1/W.
            </p>
          </CardContent>
        </Card>
      )}

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

          {/* Révision & dérive du business plan */}
          <Card>
            <CardHeader><CardTitle>Business plan — révision & dérive vs origine</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {bpDrift.hasOriginalBaseline ? (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Stat label="Lots re-standingés" value={String(bpDrift.restandinged)} hint={`${bpDrift.downgraded} déclassés`} />
                    <Stat label="Prix cibles révisés" value={String(bpDrift.priceRevised)} />
                    <Stat label="Calendriers décalés" value={String(bpDrift.scheduleShifted)} />
                    <Stat label="CA cible vs origine" value={formatMAD(bpDrift.targetCaDeltaAmount)} hint={formatPercent(bpDrift.targetCaDeltaPct, 1)} />
                  </div>
                  {bpDrift.items.length > 0 && (
                    <Table>
                      <thead><tr><Th>Lot</Th><Th>Tranche</Th><Th>Élément</Th><Th>Origine</Th><Th>Courant</Th><Th>Écart</Th></tr></thead>
                      <tbody>
                        {bpDrift.items.map((it, i) => (
                          <tr key={i}>
                            <Td className="font-medium">{it.reference}</Td>
                            <Td>{it.trancheCode}</Td>
                            <Td>{it.field === "standing" ? "Standing" : it.field === "price" ? "Prix cible" : "Date de vente"}</Td>
                            <Td>{it.field === "standing" ? it.beforeLabel : it.field === "price" ? formatMAD(Number(it.beforeLabel)) : it.beforeLabel}</Td>
                            <Td>{it.field === "standing" ? it.afterLabel : it.field === "price" ? formatMAD(Number(it.afterLabel)) : it.afterLabel}</Td>
                            <Td className={it.direction === "DOWNGRADE" || (it.deltaPct != null && it.deltaPct < 0) || (it.daysShift != null && it.daysShift > 0) ? "text-red-600" : "text-muted-foreground"}>
                              {it.field === "standing" ? (it.direction === "DOWNGRADE" ? `Déclassement (−${it.rankDelta})` : `Montée (+${-(it.rankDelta ?? 0)})`)
                                : it.field === "price" ? formatPercent(it.deltaPct ?? 0, 1)
                                : `${(it.daysShift ?? 0) > 0 ? "+" : ""}${it.daysShift} j`}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Business plan initial intact (aucune révision enregistrée).</p>
              )}

              {bpRevisions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Historique des révisions</p>
                  <Table>
                    <thead><tr><Th>Version</Th><Th>Date</Th><Th>Motif</Th><Th>Changements</Th><Th>Auteur</Th></tr></thead>
                    <tbody>
                      {bpRevisions.map((r) => (
                        <tr key={r.id}>
                          <Td className="font-medium">v{r.version}</Td>
                          <Td className="whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                          <Td>{r.reason}</Td>
                          <Td>{Array.isArray(r.changes) ? (r.changes as unknown[]).length : 0}</Td>
                          <Td className="text-muted-foreground">{r.requestedByName ?? "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {canWrite && <BusinessPlanRevisionForm projectId={project.id} units={unitsForRevision} />}
            </CardContent>
          </Card>

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
                          <Td><Badge className={TRANCHE_STATUS_COLORS[t.status]}>{TRANCHE_STATUSES.labelOf(t.status)}</Badge></Td>
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
                          <Td>{UNIT_TYPES.labelOf(unit.type)}</Td>
                          <Td>
                            {standingLabel(unit.standing as StandingCode)}
                            {downgrade && <span className="text-red-600 text-xs"> (prévu : {standingLabel(unit.plannedStanding as StandingCode)})</span>}
                          </Td>
                          <Td><Badge className={UNIT_STATUS_COLORS[unit.status]}>{UNIT_STATUSES.labelOf(unit.status)}</Badge></Td>
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
