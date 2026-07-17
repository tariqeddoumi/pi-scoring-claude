import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail, getActiveCalibration, getScoringHistory, getCounterpartyExposure, getScoreFreshness } from "@/server/queries";
import { FRESHNESS_LABELS } from "@/lib/domain/reviewPolicy";
import { computeCompleteness } from "@/lib/domain/completeness";
import { nextActionFor } from "@/lib/domain/nextAction";
import { WIZARD_STEPS, EXPLOITATION_WIZARD_STEPS } from "@/lib/wizardFields";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { ScoreTimeline } from "@/components/ScoreTimeline";
import { Card, CardContent, CardHeader, CardTitle, Badge, Stat, Table, Th, Td, Button } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { ScoreGauge } from "@/components/ScoreGauge";
import { RunScoringButton } from "@/components/RunScoringButton";
import { OverridePanel, type OverrideRow } from "@/components/OverridePanel";
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
import { SEGMENTS, ZONES, PROJECT_STATUSES, LAND_STATUSES } from "@/lib/domain/referentiels";

export const dynamic = "force-dynamic";

const TABS = [
  "Identification", "Promoteur", "Foncier", "Autorisations", "Commercialisation",
  "Financement", "Cash-flow", "Garanties", "Classification BKAM", "Provisionnement", "Scoring", "Audit",
];

const WF_STATE_COLORS: Record<WorkflowStateName, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-300",
  BRANCH_REVIEW: "bg-cyan-100 text-cyan-800 border-cyan-300",
  ANALYST_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
  MANAGER_VALIDATION: "bg-violet-100 text-violet-800 border-violet-300",
  COMMITTEE: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await safe(() => getProjectDetail(id));
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
  const counterparty = await getCounterpartyExposure(p.promoterId);
  const freshness = await getScoreFreshness(p.id);

  const actor = await getCurrentAppUser();
  const currentState = (p.workflowSteps[0]?.toState ?? "DRAFT") as WorkflowStateName;
  const canValidate = !!actor && hasPermission(actor.role.name as RoleName, PERMISSIONS.SCORING_VALIDATE);
  const overrideRows: OverrideRow[] = p.regulatoryOverrides.map((o) => ({
    id: o.id, forcedClass: o.forcedClass, engineClass: o.engineClass,
    justification: o.justification, status: o.status, active: o.active,
    requestedBy: o.requestedBy?.name ?? "—", decidedBy: o.decidedBy?.name ?? null,
    createdAt: o.createdAt.toISOString(),
  }));

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
          <Link href={`/projects/${p.id}/suivi`}>
            <Button variant="outline">{p.assetType === "PROMOTION" ? "Suivi (commercialisation & événements)" : "Suivi (événements & visites)"}</Button>
          </Link>
          <Link href={`/projects/${p.id}/scoring`}><Button variant="outline">Wizard de scoring</Button></Link>
          <a href={`/api/export/project/${p.id}`} target="_blank" rel="noreferrer">
            <Button variant="outline">Dossier comité (PDF)</Button>
          </a>
          <a href={`/api/export/project/${p.id}/xlsx`}>
            <Button variant="outline">Dossier comité (Excel)</Button>
          </a>
        </div>
      </div>

      <ProjectSubnav projectId={p.id} active="fiche" />

      {/* ================= Synthèse du dossier (lecture 10 secondes) ================= */}
      {(() => {
        const steps = p.assetType === "EXPLOITATION" ? EXPLOITATION_WIZARD_STEPS : WIZARD_STEPS;
        const completeness = computeCompleteness(steps, inputs);
        const action = actor
          ? nextActionFor({
              state: currentState,
              role: actor.role.name as RoleName,
              needsRescoring: freshness.needsRescoring,
              completenessPct: completeness.pct,
              hasScore: Boolean(run),
            })
          : null;
        return (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Stat label="Score final" value={run?.scoreFinal != null ? `${run.scoreFinal}/100` : "—"} hint={run?.decision ? DECISION_LABELS[run.decision] : "aucun scoring"} />
                <Stat label="Classe BKAM" value={cls ? CLASS_LABELS[cls.resultClass] : "—"} hint={cls?.isWatchList ? "watch list" : undefined} />
                <Stat label="Provision" value={prov ? formatMAD(prov.provisionAmount) : "—"} />
                <Stat label="Étape du circuit" value={WORKFLOW_LABELS[currentState]} />
                <Stat
                  label="Fraîcheur du score"
                  value={FRESHNESS_LABELS[freshness.status]}
                  hint={freshness.nextReviewAt ? `échéance ${formatDate(freshness.nextReviewAt)}` : undefined}
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium whitespace-nowrap">Saisie du dossier</span>
                <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full ${completeness.pct === 100 ? "bg-emerald-500" : completeness.pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${completeness.pct}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums font-medium">{completeness.pct} %</span>
                {completeness.missingCritical.length > 0 && (
                  <Badge className="bg-red-100 text-red-800 border-red-300">
                    {completeness.missingCritical.length} champ(s) critique(s) manquant(s)
                  </Badge>
                )}
              </div>
              {completeness.pct < 100 && (
                <p className="text-xs text-muted-foreground">
                  Étapes incomplètes : {completeness.steps.filter((s) => s.missingKeys.length > 0).map((s) => `${s.title} (${s.filled}/${s.total})`).join(" · ")}
                </p>
              )}

              {action && (
                <div className={`rounded-md border p-3 text-sm flex flex-wrap items-center gap-3 ${
                  action.actionable ? "border-blue-300 bg-blue-50 text-blue-900" : "border-border bg-muted/40 text-muted-foreground"
                }`}>
                  <span>
                    <span className="font-medium">{action.actionable ? "À vous de jouer : " : ""}{action.title}</span>
                    {" — "}{action.description}
                  </span>
                  {action.target && (
                    <Link
                      href={`/projects/${p.id}/${action.target}`}
                      className="ml-auto shrink-0 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90"
                    >
                      {action.target === "scoring" ? "Ouvrir la saisie & scoring" : "Ouvrir le suivi"}
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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

      {p.attachments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pièces jointes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead><tr><Th>Document</Th><Th>Section</Th><Th>Taille</Th><Th>Ajouté le</Th></tr></thead>
              <tbody>
                {p.attachments.map((a) => (
                  <tr key={a.id}>
                    <Td><a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{a.fileName}</a></Td>
                    <Td>{a.section ?? "—"}</Td>
                    <Td>{a.sizeBytes != null ? `${Math.round(a.sizeBytes / 1024)} Ko` : "—"}</Td>
                    <Td className="whitespace-nowrap">{formatDate(a.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RiskMetricsCard
        score={run?.scoreFinal ?? null}
        cls={cls?.resultClass ?? null}
        ead={prov?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead}
        eligibleGuarantees={prov?.eligibleGuarantees ?? 0}
        bkamProvision={prov?.provisionAmount ?? null}
        assetType={p.assetType as "PROMOTION" | "EXPLOITATION"}
        calib={calib}
        dpdDays={typeof inputs.dpd_days === "number" ? inputs.dpd_days : null}
        initialScore={scoreHistory[0]?.scoreFinal ?? null}
        restructured={inputs.restructured === "yes"}
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
          <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>Identification</CardTitle></CardHeader><CardContent className="p-0">
              <Table><tbody>
                <tr><Td className="text-muted-foreground">Référence</Td><Td className="font-medium">{p.reference}</Td></tr>
                <tr><Td className="text-muted-foreground">Promoteur</Td><Td><Link href={`/promoters/${p.promoterId}`} className="text-primary hover:underline">{p.promoter.name}</Link></Td></tr>
                <tr><Td className="text-muted-foreground">Type</Td><Td>{p.projectType ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Segment / Zone</Td><Td>{SEGMENTS.labelOf(p.segment)} / {ZONES.labelOf(p.zone)}</Td></tr>
                <tr><Td className="text-muted-foreground">Ville / Région</Td><Td>{p.city ?? "—"} / {p.region ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Adresse</Td><Td>{p.address ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Groupe d'intérêt</Td><Td>{p.group ? <Link href="/groups" className="text-primary hover:underline">{p.group.name}</Link> : "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Unités</Td><Td>{p.totalUnits ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Surfaces (terrain / construit)</Td><Td>{p.landAreaSqm != null ? `${p.landAreaSqm} m²` : "—"} / {p.builtAreaSqm != null ? `${p.builtAreaSqm} m²` : "—"}</Td></tr>
              </tbody></Table>
            </CardContent></Card>
            <div className="grid grid-cols-2 gap-4 content-start">
              <Stat label="Coût total" value={formatMAD(p.totalCost)} />
              <Stat label="Crédit" value={formatMAD(p.loanAmount)} />
              <Stat label="Fonds propres" value={formatMAD(p.ownEquity)} />
              <Stat label="Chargé d'affaires" value={p.rm?.name ?? "—"} />
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>Foncier & autorisations (fiche)</CardTitle></CardHeader><CardContent className="p-0">
              <Table><tbody>
                <tr><Td className="text-muted-foreground">Titre(s) foncier(s)</Td><Td>{p.landTitleRef ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Statut foncier</Td><Td>{LAND_STATUSES.labelOf(p.landStatus)}</Td></tr>
                <tr><Td className="text-muted-foreground">Autorisation de construire</Td><Td>{p.buildPermitRef ?? "—"}{p.buildPermitDate ? ` (${formatDate(p.buildPermitDate)})` : ""}</Td></tr>
              </tbody></Table>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Calendrier & description</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Démarrage travaux : </span>{p.startDate ? formatDate(p.startDate) : "—"}</p>
              <p><span className="text-muted-foreground">Livraison prévue : </span>{p.expectedDeliveryDate ? formatDate(p.expectedDeliveryDate) : "—"}</p>
              {p.description && <p className="whitespace-pre-wrap border-t border-border pt-2">{p.description}</p>}
            </CardContent></Card>
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
         <div className="space-y-4">
          {cls ? (
            <Card><CardHeader><CardTitle>Classification — {cls.regime.name}</CardTitle></CardHeader><CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className={CLASS_COLORS[cls.resultClass]}>{CLASS_LABELS[cls.resultClass]}</Badge>
                {cls.isWatchList && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Watch List</Badge>}
                {cls.groupContagionClass && <Badge className="bg-purple-100 text-purple-800 border-purple-300">Contagion groupe : {CLASS_LABELS[cls.groupContagionClass]}</Badge>}
                {cls.dataQualityStatus && cls.dataQualityStatus !== "COMPLETE" && (
                  <Badge className={cls.dataQualityStatus === "INCOMPLETE_BLOCKING" ? "bg-red-100 text-red-800 border-red-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                    {cls.dataQualityStatus === "INCOMPLETE_BLOCKING" ? "Données critiques manquantes" : "Données incomplètes"}
                  </Badge>
                )}
              </div>
              {Array.isArray(cls.missingCriticalData) && (cls.missingCriticalData as string[]).length > 0 && (
                <p className="text-xs text-muted-foreground">Manquant : {(cls.missingCriticalData as string[]).join(", ")}</p>
              )}
              {cls.restructuringNote && <p className="text-sm"><span className="font-medium">Restructuration : </span>{cls.restructuringNote}</p>}
              {cls.overrideNote && <p className="text-sm text-purple-700"><span className="font-medium">Dérogation : </span>{cls.overrideNote}</p>}
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
          <Card><CardHeader><CardTitle>Dérogations comité (1/W)</CardTitle></CardHeader><CardContent>
            <OverridePanel projectId={p.id} overrides={overrideRows} canValidate={canValidate} />
          </CardContent></Card>

          {counterparty && counterparty.count > 1 && (
            <Card><CardHeader><CardTitle>Contrepartie — expositions liées</CardTitle></CardHeader><CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>{counterparty.promoter.name}</span>
                <span className="text-muted-foreground">{counterparty.count} projet(s)</span>
                <span className="text-muted-foreground">Exposition totale {formatMAD(counterparty.totalExposure)}</span>
                {counterparty.severeClass && <Badge className={CLASS_COLORS[counterparty.severeClass]}>Classe la plus sévère : {CLASS_LABELS[counterparty.severeClass]}</Badge>}
              </div>
              <Table>
                <thead><tr><Th>Référence</Th><Th>Projet</Th><Th>Classe</Th><Th>Exposition</Th></tr></thead>
                <tbody>
                  {counterparty.members.map((mb) => (
                    <tr key={mb.id} className={mb.id === p.id ? "bg-muted/40" : undefined}>
                      <Td className="font-mono text-xs">{mb.reference}</Td>
                      <Td>{mb.name}{mb.id === p.id ? <span className="ml-1 text-xs text-muted-foreground">(ce projet)</span> : null}</Td>
                      <Td>{mb.cls ? <Badge className={CLASS_COLORS[mb.cls]}>{CLASS_LABELS[mb.cls]}</Badge> : "—"}</Td>
                      <Td>{formatMAD(mb.exposure)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="text-xs text-muted-foreground">Contagion contrepartie (art.33/50) : la classe la plus sévère se propage aux autres expositions de la contrepartie au prochain calcul.</p>
            </CardContent></Card>
          )}
         </div>
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
              <Card className="lg:col-span-3"><CardHeader><CardTitle>Détail par critère (explicabilité)</CardTitle></CardHeader><CardContent className="p-0">
                <Table>
                  <thead><tr><Th>Domaine</Th><Th>Critère</Th><Th>Valeur source</Th><Th>Note /10</Th><Th>Poids</Th><Th>Contribution</Th><Th>Règle retenue</Th></tr></thead>
                  <tbody>
                    {[...run.criterionResults]
                      .sort((a, b) => (a.criterion.domain.code + a.criterion.code).localeCompare(b.criterion.domain.code + b.criterion.code))
                      .map((c) => (
                        <tr key={c.id} className={c.gateBlocked ? "bg-red-50" : undefined}>
                          <Td className="text-muted-foreground">{c.criterion.domain.code}</Td>
                          <Td>{c.criterion.name}{c.gateBlocked ? <span className="ml-1 text-red-600 text-xs font-medium">(gate)</span> : null}</Td>
                          <Td className="font-mono text-xs">{c.rawValue ?? "—"}</Td>
                          <Td className="font-medium">{c.score}</Td>
                          <Td>{formatPercent(c.criterion.weight * 100, 0)}</Td>
                          <Td>{c.weighted.toFixed(2)}</Td>
                          <Td className="text-xs text-muted-foreground">{c.matchedRef ?? "—"}</Td>
                        </tr>
                      ))}
                    {run.criterionResults.length === 0 && <tr><Td className="text-muted-foreground">Aucun détail de critère.</Td></tr>}
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
