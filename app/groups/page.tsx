import Link from "next/link";
import { getGroups } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge, Stat } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { CLASS_LABELS, CLASS_COLORS } from "@/lib/labels";
import { formatMAD } from "@/lib/utils";
import { classSeverity } from "@/lib/domain/groups";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_READ))) return <AccessDenied />;
  const res = await safe(getGroups);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const groups = res.data;

  const totalExposure = groups.reduce((s, g) => s + g.exposure, 0);
  const atRisk = groups.filter((g) => g.severeClass && classSeverity(g.severeClass) >= 2).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Groupes d'intérêt</h1>
        <p className="text-sm text-muted-foreground">
          Contreparties consolidées et effet de contagion BKAM (19/G art.33 · 1/W art.50) : la
          classe la plus sévère d'un membre se propage aux entités liées lors du prochain calcul.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Groupes" value={groups.length} />
        <Stat label="Exposition consolidée" value={formatMAD(totalExposure)} />
        <Stat label="Groupes en risque" value={atRisk} hint="≥ pré-douteux sur un membre" />
        <Stat label="Entités liées" value={groups.reduce((s, g) => s + g.members.length, 0)} />
      </div>

      {groups.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Aucun groupe d'intérêt défini.</CardContent></Card>
      )}

      {groups.map((g) => (
        <Card key={g.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              {g.name}
              {g.sector && <span className="text-sm font-normal text-muted-foreground">{g.sector}</span>}
              <span className="ml-auto flex items-center gap-2 text-sm font-normal">
                {g.consolidation.weightedScore != null && (
                  <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">
                    Note consolidée {g.consolidation.weightedScore}/100
                  </Badge>
                )}
                <span className="text-muted-foreground">Exposition {formatMAD(g.exposure)}</span>
                {g.severeClass && (
                  <Badge className={CLASS_COLORS[g.severeClass]}>Contagion : {CLASS_LABELS[g.severeClass]}</Badge>
                )}
                <a href={`/api/export/group/${g.id}`} target="_blank" rel="noreferrer" className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted">Dossier comité (PDF)</a>
              </span>
            </CardTitle>
            {g.consolidation.operationalExposure > 0 && (
              <p className="text-xs text-muted-foreground">
                Dont {formatMAD(g.consolidation.operationalExposure)} d'actif(s) d'exploitation
                ({g.consolidation.operationalComponents}) exclu(s) de la note (modèle promotion inadapté),
                mais comptés dans l'exposition et le risque consolidés.
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>Référence</Th><Th>Projet</Th><Th>Nature</Th><Th>Classe</Th><Th>Score</Th><Th>Exposition</Th></tr>
              </thead>
              <tbody>
                {g.members.map((m) => {
                  const isDriver = m.cls && m.cls === g.severeClass;
                  const operated = m.assetType === "EXPLOITATION";
                  return (
                    <tr key={m.id} className={isDriver ? "bg-amber-50" : ""}>
                      <Td className="font-medium">
                        <Link href={`/projects/${m.id}`} className="text-primary hover:underline">{m.reference}</Link>
                      </Td>
                      <Td>{m.name}{isDriver && <span className="ml-2 text-xs text-amber-700">● entité la plus dégradée</span>}</Td>
                      <Td>
                        {operated
                          ? <Badge className="bg-orange-100 text-orange-800 border-orange-300">Exploitation</Badge>
                          : <Badge className="bg-slate-100 text-slate-700 border-slate-300">Promotion</Badge>}
                      </Td>
                      <Td>{m.cls ? <Badge className={CLASS_COLORS[m.cls]}>{CLASS_LABELS[m.cls]}</Badge> : "—"}</Td>
                      <Td className="whitespace-nowrap">{operated ? <span className="text-muted-foreground text-xs">hors note</span> : (m.scoreFinal != null ? `${m.scoreFinal}/100` : "—")}</Td>
                      <Td className="whitespace-nowrap">{formatMAD(m.exposure)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
