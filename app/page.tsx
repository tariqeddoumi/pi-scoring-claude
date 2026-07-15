import Link from "next/link";
import { getPortfolioStats, getFrontDashboard, getRescoringQueue } from "@/server/queries";
import { FRESHNESS_LABELS } from "@/lib/domain/reviewPolicy";
import { Card, CardContent, CardHeader, CardTitle, Stat, Badge, Table, Th, Td } from "@/components/ui";
import { PortfolioChart } from "@/components/PortfolioChart";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { formatMAD, formatDate } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS } from "@/lib/labels";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { isFrontRole, hasPermission, PERMISSIONS, type RoleName } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
//  Tableau de bord FRONT (chargé d'affaires, directeur de centre, région) :
//  mes dossiers, dossiers en attente de mon action, pipeline du circuit.
// ---------------------------------------------------------------------------
async function FrontDashboard({ userId, role, roleLabel, canCreate }: {
  userId: string; role: RoleName; roleLabel: string; canCreate: boolean;
}) {
  const res = await safe(() => getFrontDashboard(userId, role));
  if (!res.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Mon activité</h1>
        <DbSetupNotice error={res.error} />
      </div>
    );
  }
  const { pipeline, toProcess, mine, myExposure, totalCount } = res.data;
  const rescoring = await safe(getRescoringQueue);
  const rescoreCount = rescoring.ok ? rescoring.data.total : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mon activité</h1>
          <p className="text-muted-foreground text-sm">{roleLabel} · circuit d'octroi promotion immobilière</p>
        </div>
        {canCreate && (
          <Link href="/projects/new" className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-2 hover:opacity-90">
            + Nouveau dossier
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Dossiers en portefeuille" value={totalCount} />
        <Stat label="Mes dossiers (CA)" value={mine.length} />
        <Stat label="Mon exposition" value={formatMAD(myExposure)} />
        <Stat label="En attente de mon action" value={toProcess.length} />
        <Stat label="Scorings à rafraîchir" value={rescoreCount} hint="revue périodique / événement" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            À traiter
            <Badge className="bg-blue-100 text-blue-800 border-blue-300">{toProcess.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Référence</Th><Th>Projet</Th><Th>Promoteur</Th>
                <Th>Étape</Th><Th>Exposition</Th><Th>Depuis</Th>
              </tr>
            </thead>
            <tbody>
              {toProcess.slice(0, 10).map((p) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <Td><Link className="text-primary hover:underline" href={`/projects/${p.id}`}>{p.reference}</Link></Td>
                  <Td>{p.name}</Td>
                  <Td>{p.promoter}</Td>
                  <Td><Badge className="bg-slate-100 text-slate-700 border-slate-300">{p.stateLabel}</Badge></Td>
                  <Td className="whitespace-nowrap">{formatMAD(p.exposure)}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDate(p.since)}</Td>
                </tr>
              ))}
              {toProcess.length === 0 && (
                <tr><Td className="text-muted-foreground" >Aucun dossier n&apos;attend votre intervention.</Td></tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Pipeline du circuit décisionnel</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pipeline.length === 0 && <p className="text-sm text-muted-foreground">Aucun dossier.</p>}
            {pipeline.map((s) => (
              <div key={s.state} className="flex items-center justify-between text-sm">
                <span>{s.label}</span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">{formatMAD(s.exposure)}</span>
                  <Badge className="bg-muted">{s.count}</Badge>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mon portefeuille</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>Référence</Th><Th>Projet</Th><Th>Étape</Th><Th>Score</Th></tr>
              </thead>
              <tbody>
                {mine.slice(0, 8).map((p) => (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <Td><Link className="text-primary hover:underline" href={`/projects/${p.id}`}>{p.reference}</Link></Td>
                    <Td>{p.name}</Td>
                    <Td><Badge className="bg-slate-100 text-slate-700 border-slate-300">{p.stateLabel}</Badge></Td>
                    <Td>
                      {p.score != null ? (
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{p.score}</span>
                          {p.decision && (
                            <Badge className={DECISION_COLORS[p.decision as keyof typeof DECISION_COLORS]}>
                              {DECISION_LABELS[p.decision as keyof typeof DECISION_LABELS] ?? p.decision}
                            </Badge>
                          )}
                        </span>
                      ) : "—"}
                    </Td>
                  </tr>
                ))}
                {mine.length === 0 && (
                  <tr><Td className="text-muted-foreground" >Aucun dossier ne vous est affecté comme chargé d&apos;affaires.</Td></tr>
                )}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Tableau de bord RISQUE / ADMIN / AUDIT : vue portefeuille (existant).
// ---------------------------------------------------------------------------
async function RiskDashboard() {
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
  const rescoring = await safe(getRescoringQueue);
  const rescoreItems = rescoring.ok ? rescoring.data.items : [];

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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Projets suivis" value={total} />
        <Stat label="Exposition totale" value={formatMAD(totalExposure)} />
        <Stat label="Provisions BKAM" value={formatMAD(totalProvision)} />
        <Stat label="Taux de couverture" value={`${coverage.toFixed(1)} %`} />
        <Stat label="Scorings à rafraîchir" value={rescoreItems.length} hint="revue périodique / événement" />
      </div>

      {rescoreItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Scorings à rafraîchir
              <Badge className="bg-amber-100 text-amber-800 border-amber-300">{rescoreItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>Référence</Th><Th>Projet</Th><Th>Promoteur</Th><Th>Classe</Th><Th>Motif</Th><Th>Exposition</Th></tr>
              </thead>
              <tbody>
                {rescoreItems.slice(0, 10).map((it) => (
                  <tr key={it.id} className="hover:bg-muted/50">
                    <Td><Link className="text-primary hover:underline" href={`/projects/${it.id}`}>{it.reference}</Link></Td>
                    <Td>{it.name}</Td>
                    <Td>{it.promoter}</Td>
                    <Td>{it.cls ? <Badge className={CLASS_COLORS[it.cls]}>{CLASS_LABELS[it.cls]}</Badge> : "—"}</Td>
                    <Td>
                      <Badge className={it.freshness.status === "EVENT_TRIGGERED" ? "bg-purple-100 text-purple-800 border-purple-300" : "bg-amber-100 text-amber-800 border-amber-300"}>
                        {FRESHNESS_LABELS[it.freshness.status]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap">{formatMAD(it.exposure)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Répartition par classe BKAM</CardTitle></CardHeader>
          <CardContent><PortfolioChart data={byClass} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Décisions de scoring</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(byDecision).length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun scoring exécuté pour l&apos;instant.</p>
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

export default async function DashboardPage() {
  // Vue adaptée au profil : le réseau (front) voit son activité et son
  // pipeline ; le risque / l'admin / l'audit voient la vue portefeuille.
  const user = await getCurrentAppUser();
  const role = (user?.role.name ?? "AUDITOR") as RoleName;

  if (user && isFrontRole(role)) {
    return (
      <FrontDashboard
        userId={user.id}
        role={role}
        roleLabel={user.role.label}
        canCreate={hasPermission(role, PERMISSIONS.PROJECT_WRITE)}
      />
    );
  }
  return <RiskDashboard />;
}
