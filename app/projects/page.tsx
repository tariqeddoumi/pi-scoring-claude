import Link from "next/link";
import { getProjectsWithLatestRun } from "@/server/queries";
import { Card, CardContent, Table, Th, Td, Badge, Button } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatMAD } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS } from "@/lib/labels";
import { SEGMENTS } from "@/lib/domain/referentiels";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const res = await safe(getProjectsWithLatestRun);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const projects = res.data;
  const canWrite = await currentUserCan(PERMISSIONS.PROJECT_WRITE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Projets de promotion immobilière</h1>
        {canWrite && <Link href="/projects/new"><Button>+ Nouveau projet</Button></Link>}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Réf.</Th><Th>Projet</Th><Th>Promoteur</Th><Th>Ville</Th>
                <Th>Segment</Th><Th>Crédit</Th><Th>Score</Th><Th>Classe</Th><Th>Décision</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const run = p.scoringRuns[0];
                const cls = p.classificationRuns[0]?.resultClass;
                return (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <Td><Link className="text-primary hover:underline" href={`/projects/${p.id}`}>{p.reference}</Link></Td>
                    <Td>{p.name}</Td>
                    <Td>{p.promoter.name}</Td>
                    <Td>{p.city ?? "—"}</Td>
                    <Td>{SEGMENTS.labelOf(p.segment)}</Td>
                    <Td>{formatMAD(p.loanAmount)}</Td>
                    <Td>{run?.scoreFinal != null ? run.scoreFinal.toFixed(0) : "—"}</Td>
                    <Td>{cls ? <Badge className={CLASS_COLORS[cls]}>{CLASS_LABELS[cls]}</Badge> : "—"}</Td>
                    <Td>{run?.decision ? <Badge className={DECISION_COLORS[run.decision]}>{DECISION_LABELS[run.decision]}</Badge> : "—"}</Td>
                  </tr>
                );
              })}
              {projects.length === 0 && <tr><Td className="text-muted-foreground">Aucun projet.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
