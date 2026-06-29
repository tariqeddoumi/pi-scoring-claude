import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail, getActiveCalibration, getScoringHistory } from "@/server/queries";
import { ScoreTimeline } from "@/components/ScoreTimeline";
import { Card, CardContent, CardHeader, CardTitle, Badge, Stat, Table, Th, Td, Button } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { ScoreGauge } from "@/components/ScoreGauge";
import { RunScoringButton } from "@/components/RunScoringButton";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { CommitteeDecisionForm } from "@/components/CommitteeDecisionForm";
import { GfaVefaCard } from "@/components/GfaVefaCard";
import { FacilitiesCard } from "@/components/FacilitiesCard";
import { RiskMetricsCard } from "@/components/RiskMetricsCard";
import { projectEad } from "@/lib/domain/facility";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { getCurrentAppUser } from "@/lib/supabase/server";
import type { WorkflowStateName, CommitteeOutcomeName } from "@/lib/workflow";
import { WORKFLOW_LABELS, COMMITTEE_OUTCOME_LABELS } from "@/lib/workflow";
import { hasPermission, PERMISSIONS, type RoleName } from "@/lib/rbac";
import { formatMAD, formatDate, formatPercent } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS, SEVERITY_LABELS, SEVERITY_COLORS } from "@/lib/labels";
import { INPUT_SECTIONS, INPUT_LABELS, fmtInput } from "@/lib/inputLabels";
import { SEGMENTS, ZONES, PROJECT_STATUSES } from "@/lib/domain/referentiels";

export const dynamic = "force-dynamic";

const TABS = [
  "Identification", "Promoteur", "Foncier", "Autorisations", "Commercialisation",
  "Financement", "Cash-flow", "Garanties", "Classification BKAM", "Provisionnement", "Scoring", "Audit",
];

const WF_STATE_COLORS: Record<WorkflowStateName, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-300",
  ANALYST_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
  MANAGER_VALIDATION: "bg-violet-100 text-violet-800 border-violet-300",
  COMMITTEE: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
};

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const res = await safe(() => getProjectDetail(params.id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const p = res.data;
  if (!p) return notFound();

  const inputs: Record<string, any> = {};
  for (const i of p.inputs) {
    inputs[i.key] = i.valueNum ?? i.valueStr ?? i.valueBool ?? null;
  }
  const run = p.scoringRuns[0];
  const cls = p.classificationRuns[0];
  const prov = p.provisionRuns[0];
  const calib = await getActiveCalibration();
  const scoreHistory = await getScoringHistory(p.id);

  const actor = await getCurrentAppUser();
  const currentState = (p.workflowSteps[0]?.toState ?? "DRAFT") as WorkflowStateName;

  const sectionTable = (sectionKey: keyof typeof INPUT_SECTIONS) => {
    const s = INPUT_SECTIONS[sectionKey]!;
    return (
      <Card>
        <CardHeader><CardTitle>{s.title}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <tbody>
              {s.keys.map((k) => (
                <tr key={k}>
                  <Td className="text-muted-foreground w-1/2">{INPUT_LABELS[k] ?? k}</Td>
                  <Td className="font-medium">{fmtInput(inputs[k] ?? null)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/projects" className="text-sm text-muted-foreground hover:underline">← Projets</Link>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-muted-foreground text-sm">{p.reference} · {p.promoter.name} · {p.city ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          {cls && <Badge className={CLASS_COLORS[cls.resultClass]}>{CLASS_LABELS[cls.resultClass]}</Badge>}
          {run?.decision && <Badge className={DECISION_COLORS[run.decision]}>{DECISION_LABELS[run.decision]}</Badge>}
          {actor && hasPermission(actor.role.name as RoleName, PERMISSIONS.PROJECT_WRITE) && (
            <Link href={`/projects/${p.id}/edit`}><Button variant="outline">Éditer</Button></Link>
          )}
          {p.assetType === "PROMOTION" && (
            <Link href={`/projects/${p.id}/suivi`}><Button variant="outline">Suivi de commercialisation</Button></Link>
          )}
          <Link href={`/projects/${p.id}/scoring`}><Button variant="outline">Wizard de scoring</Button></Link>
          <a href={`/api/export/project/${p.id}`} target="_blank" rel="noreferrer">
            <Button variant="outline">Dossier comité (PDF)</Button>
          </a>
        </div>
      </div>

      <RunScoringButton projectId={p.id} />

      {actor && (
        <WorkflowPanel projectId={p.id} currentState={currentState} role={actor.role.name as RoleName} />
      )}

      {actor && currentState === "COMMITTEE" && hasPermission(actor.role.name as RoleName, PERMISSIONS.SCORING_VALIDATE) && (
        <CommitteeDecisionForm projectId={p.id} />
      )}

      {p.committeeDecisions[0] && (
        <Card>
          <CardHeader><CardTitle>Dernière décision de comité</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(() => {
              const cd = p.committeeDecisions[0]!;
              return (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={cd.outcome.startsWith("FAVORABLE") ? "bg-emerald-100 text-emerald-800 border-emerald-300" : cd.outcome === "DEFAVORABLE" ? "bg-red-100 text-red-800 border-red-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                      {COMMITTEE_OUTCOME_LABELS[cd.outcome as CommitteeOutcomeName]}
                    </Badge>
                    <span className="text-muted-foreground">
                      Président : {cd.chair.name} · {formatDate(cd.createdAt)}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-4 gap-2">
                    <span>Quorum : {cd.presentCount}/{cd.quorum}</span>
                    <span>Pour : {cd.votesFor}</span>
                    <span>Contre : {cd.votesAgainst}</span>
                    <span>Abst. : {cd.votesAbstain}</span>
                  </div>
                  {cd.approvedAmount != null && <p>Montant approuvé : <span className="font-medium">{formatMAD(cd.approvedAmount)}</span></p>}
                  {cd.conditions && <p>Conditions : {cd.conditions}</p>}
                  {cd.validUntil && <p>Validité jusqu'au {formatDate(cd.validUntil)}</p>}
                  {cd.minutesRef && <p className="text-muted-foreground">PV : {cd.minutesRef}</p>}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {actor && (
        <GfaVefaCard
          projectId={p.id}
          assetType={p.assetType}
          saleMode={p.saleMode}
          hasGFA={p.hasGFA}
          gfaAmount={p.gfaAmount}
          gfaProvider={p.gfaProvider}
          exposure={p.loanAmount ?? 0}
          canEdit={hasPermission(actor.role.name as RoleName, PERMISSIONS.PROJECT_WRITE)}
        />
      )}

      <FacilitiesCard facilities={p.facilities} loanAmount={p.loanAmount ?? 0} />

      <RiskMetricsCard
        score={run?.scoreFinal ?? null}
        cls={cls?.resultClass ?? null}
        ead={prov?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead}
        eligibleGuarantees={prov?.eligibleGuarantees ?? 0}
        bkamProvision={prov?.provisionAmount ?? null}
        calib={calib}
      />

      {p.workflowSteps.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Historique du circuit</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {p.workflowSteps.map((s) => (
                <li key={s.id} className="flex items-start gap-3 text-sm">
                  <span className="text-muted-foreground whitespace-nowrap w-32 shrink-0">{formatDate(s.createdAt)}</span>
                  <span className="flex items-center gap-2 flex-wrap">
                    <Badge className={WF_STATE_COLORS[s.fromState as WorkflowStateName]}>{WORKFLOW_LABELS[s.fromState as WorkflowStateName]}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge className={WF_STATE_COLORS[s.toState as WorkflowStateName]}>{WORKFLOW_LABELS[s.toState as WorkflowStateName]}</Badge>
                  </span>
                  <span className="text-muted-foreground">
                    par {s.actor?.name ?? "—"}
                    {s.comment ? ` · « ${s.comment} »` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="Identification">
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="Identification">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>Identification</CardTitle></CardHeader><CardContent className="p-0">
              <Table><tbody>
                <tr><Td className="text-muted-foreground">Référence</Td><Td className="font-medium">{p.reference}</Td></tr>
                <tr><Td className="text-muted-foreground">Type</Td><Td>{p.projectType ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Segment / Zone</Td><Td>{SEGMENTS.labelOf(p.segment)} / {ZONES.labelOf(p.zone)}</Td></tr>
                <tr><Td className="text-muted-foreground">Ville / Région</Td><Td>{p.city ?? "—"} / {p.region ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Groupe d'intérêt</Td><Td>{p.group ? <Link href="/groups" className="text-primary hover:underline">{p.group.name}</Link> : "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Unités</Td><Td>{p.totalUnits ?? "—"}</Td></tr>
              </tbody></Table>
            </CardContent></Card>
            <div className="grid grid-cols-2 gap-4 content-start">
              <Stat label="Coût total" value={formatMAD(p.totalCost)} />
              <Stat label="Crédit" value={formatMAD(p.loanAmount)} />
              <Stat label="Fonds propres" value={formatMAD(p.ownEquity)} />
              <Stat label="Chargé d'affaires" value={p.rm?.name ?? "—"} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="Promoteur">{sectionTable("promoteur")}</TabsContent>
        <TabsContent value="Foncier">{sectionTable("foncier")}</TabsContent>
        <TabsContent value="Autorisations">{sectionTable("autorisations")}</TabsContent>
        <TabsContent value="Commercialisation">{sectionTable("commercialisation")}</TabsContent>
        <TabsContent value="Financement">{sectionTable("financement")}</TabsContent>
        <TabsContent value="Cash-flow">{sectionTable("cashflow")}</TabsContent>

        <TabsContent value="Garanties">
          <Card><CardHeader><CardTitle>Garanties affectées</CardTitle></CardHeader><CardContent className="p-0">
            <Table>
              <thead><tr><Th>Type</Th><Th>Valeur</Th><Th>Quotité</Th><Th>Rang</Th><Th>Anc. souffrance</Th></tr></thead>
              <tbody>
                {p.guarantees.map((g) => (
                  <tr key={g.id}>
                    <Td>{g.type.label}</Td>
                    <Td>{formatMAD(g.marketValue)}</Td>
                    <Td>{formatPercent(g.type.quotity * 100, 0)}</Td>
                    <Td>{g.rank}</Td>
                    <Td>{g.yearsInSouffrance} an(s)</Td>
                  </tr>
                ))}
                {p.guarantees.length === 0 && <tr><Td className="text-muted-foreground">Aucune garantie.</Td></tr>}
              </tbody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="Classification BKAM">
          {cls ? (
            <Card><CardHeader><CardTitle>Classification — {cls.regime.name}</CardTitle></CardHeader><CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className={CLASS_COLORS[cls.resultClass]}>{CLASS_LABELS[cls.resultClass]}</Badge>
                {cls.isWatchList && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Watch List</Badge>}
                {cls.groupContagionClass && <Badge className="bg-purple-100 text-purple-800 border-purple-300">Contagion groupe : {CLASS_LABELS[cls.groupContagionClass]}</Badge>}
              </div>
              {cls.restructuringNote && <p className="text-sm"><span className="font-medium">Restructuration : </span>{cls.restructuringNote}</p>}
              <div>
                <p className="text-sm font-medium mb-1">Déclencheurs</p>
                <ul className="text-sm list-disc pl-5 space-y-0.5">
                  {(cls.triggeredBy as any[]).map((t, i) => (
                    <li key={i}><span className="font-medium">{t.targetClass}</span> — {t.reason}</li>
                  ))}
                  {(cls.triggeredBy as any[]).length === 0 && <li className="text-muted-foreground">Aucun (créance saine).</li>}
                </ul>
              </div>
            </CardContent></Card>
          ) : <p className="text-muted-foreground text-sm">Lancez un scoring pour classifier.</p>}
        </TabsContent>

        <TabsContent value="Provisionnement">
          {prov ? (
            <Card><CardHeader><CardTitle>Provisionnement BKAM</CardTitle></CardHeader><CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <Stat label="EAD" value={formatMAD(prov.ead)} />
                <Stat label="Agios réservés" value={formatMAD(prov.reservedAgios)} />
                <Stat label="Garanties éligibles" value={formatMAD(prov.eligibleGuarantees)} />
                <Stat label="Base provisionnable" value={formatMAD(prov.provisionBase)} />
                <Stat label="Taux" value={formatPercent(prov.rate * 100, 0)} />
                <Stat label="Provision" value={formatMAD(prov.provisionAmount)} hint={prov.isIrregular ? "Créance irrégulière (couverte 100%)" : undefined} />
              </div>
              <p className="text-sm font-medium mb-1">Détail garanties éligibles</p>
              <Table>
                <thead><tr><Th>Type</Th><Th>Valeur</Th><Th>Quotité base</Th><Th>Quotité effective</Th><Th>Admise</Th></tr></thead>
                <tbody>
                  {(prov.guaranteeBreakdown as any[] ?? []).map((l, i) => (
                    <tr key={i}>
                      <Td>{l.typeCode}</Td><Td>{formatMAD(l.marketValue)}</Td>
                      <Td>{formatPercent(l.baseQuotity * 100, 0)}</Td>
                      <Td>{formatPercent(l.effectiveQuotity * 100, 0)}{l.abatementApplied ? " ↓" : ""}</Td>
                      <Td className="font-medium">{formatMAD(l.eligibleValue)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent></Card>
          ) : <p className="text-muted-foreground text-sm">Aucun provisionnement calculé.</p>}
        </TabsContent>

        <TabsContent value="Scoring">
          {run ? (
            <div className="grid lg:grid-cols-3 gap-4">
              <Card><CardContent className="flex flex-col items-center py-6">
                <ScoreGauge score={run.scoreFinal ?? 0} />
                <div className="mt-2 text-center">
                  {run.decision && <Badge className={DECISION_COLORS[run.decision]}>{DECISION_LABELS[run.decision]}</Badge>}
                </div>
              </CardContent></Card>
              <Card className="lg:col-span-2"><CardHeader><CardTitle>Scores par domaine</CardTitle></CardHeader><CardContent className="p-0">
                <Table>
                  <thead><tr><Th>Domaine</Th><Th>Score /100</Th><Th>Poids</Th><Th>Contribution</Th></tr></thead>
                  <tbody>
                    {run.domainResults.map((d) => (
                      <tr key={d.id}>
                        <Td>{d.domain.code} — {d.domain.name}</Td>
                        <Td className="font-medium">{d.score.toFixed(0)}</Td>
                        <Td>{formatPercent(d.domain.weight * 100, 0)}</Td>
                        <Td>{d.weighted.toFixed(1)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent></Card>
              <Card className="lg:col-span-3"><CardHeader><CardTitle>Red flags D5 déclenchés</CardTitle></CardHeader><CardContent className="space-y-1">
                {(run.triggeredRedFlags as any[] ?? []).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge className={SEVERITY_COLORS[f.severity as keyof typeof SEVERITY_COLORS]}>{SEVERITY_LABELS[f.severity as keyof typeof SEVERITY_LABELS]}</Badge>
                    <span>{f.name}</span>
                    {f.malus > 0 && <span className="text-red-600">−{f.malus}</span>}
                  </div>
                ))}
                {(run.triggeredRedFlags as any[] ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun red flag.</p>}
              </CardContent></Card>
              <div className="lg:col-span-3"><ScoreTimeline runs={scoreHistory} /></div>
            </div>
          ) : <p className="text-muted-foreground text-sm">Aucun run de scoring. Cliquez sur « Lancer le scoring ».</p>}
        </TabsContent>

        <TabsContent value="Audit">
          <Card><CardHeader><CardTitle>Historique workflow</CardTitle></CardHeader><CardContent className="p-0">
            <Table>
              <thead><tr><Th>Date</Th><Th>Transition</Th><Th>Acteur</Th><Th>Commentaire</Th></tr></thead>
              <tbody>
                {p.workflowSteps.map((w) => (
                  <tr key={w.id}>
                    <Td className="whitespace-nowrap">{formatDate(w.createdAt)}</Td>
                    <Td>{w.fromState ? `${WORKFLOW_LABELS[w.fromState as WorkflowStateName]} → ` : ""}{WORKFLOW_LABELS[w.toState as WorkflowStateName]}</Td>
                    <Td>{w.actor.name}</Td>
                    <Td className="text-muted-foreground">{w.comment ?? "—"}</Td>
                  </tr>
                ))}
                {p.workflowSteps.length === 0 && <tr><Td className="text-muted-foreground">Aucune étape enregistrée.</Td></tr>}
              </tbody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
