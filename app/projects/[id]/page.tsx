import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge, Stat, Table, Th, Td, Button } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { ScoreGauge } from "@/components/ScoreGauge";
import { RunScoringButton } from "@/components/RunScoringButton";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { formatMAD, formatDate, formatPercent } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS, SEVERITY_LABELS, SEVERITY_COLORS } from "@/lib/labels";
import { INPUT_SECTIONS, INPUT_LABELS, fmtInput } from "@/lib/inputLabels";

export const dynamic = "force-dynamic";

const TABS = [
  "Identification", "Promoteur", "Foncier", "Autorisations", "Commercialisation",
  "Financement", "Cash-flow", "Garanties", "Classification BKAM", "Provisionnement", "Scoring", "Audit",
];

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
          <Link href={`/projects/${p.id}/scoring`}><Button variant="outline">Wizard de scoring</Button></Link>
          <a href={`/api/export/project/${p.id}`} target="_blank" rel="noreferrer">
            <Button variant="outline">Rapport comité (PDF)</Button>
          </a>
        </div>
      </div>

      <RunScoringButton projectId={p.id} />

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
                <tr><Td className="text-muted-foreground">Segment / Zone</Td><Td>{p.segment ?? "—"} / {p.zone ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Ville / Région</Td><Td>{p.city ?? "—"} / {p.region ?? "—"}</Td></tr>
                <tr><Td className="text-muted-foreground">Groupe d'intérêt</Td><Td>{p.groupId ?? "—"}</Td></tr>
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
            </div>
          ) : <p className="text-muted-foreground text-sm">Aucun run de scoring. Cliquez sur « Lancer le scoring ».</p>}
        </TabsContent>

        <TabsContent value="Audit">
          <Card><CardHeader><CardTitle>Historique workflow</CardTitle></CardHeader><CardContent className="p-0">
            <Table>
              <thead><tr><Th>Date</Th><Th>Étape</Th><Th>Acteur</Th></tr></thead>
              <tbody>
                {p.workflowSteps.map((w) => (
                  <tr key={w.id}><Td>{formatDate(w.createdAt)}</Td><Td>{w.toState}</Td><Td>{w.actor.name}</Td></tr>
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
