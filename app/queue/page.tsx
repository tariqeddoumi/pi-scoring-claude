import Link from "next/link";
import { getWorkflowQueue } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { type RoleName } from "@/lib/rbac";
import { formatMAD, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const user = await getCurrentAppUser();
  if (!user) return <AccessDenied />;
  const role = user.role.name as RoleName;

  const res = await safe(() => getWorkflowQueue(role));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const { groups, total } = res.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Mes dossiers à traiter</h1>
        <Badge className="bg-blue-100 text-blue-800 border-blue-300">{total}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Dossiers en attente d'une action de votre rôle ({user.role.label}), selon l'état du
        circuit décisionnel.
      </p>

      {total === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun dossier n'attend votre intervention pour le moment.
          </CardContent>
        </Card>
      )}

      {groups.map((g) => (
        <Card key={g.state}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {g.label}
              <Badge className="bg-muted">{g.items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Référence</Th>
                  <Th>Projet</Th>
                  <Th>Promoteur</Th>
                  <Th>Exposition</Th>
                  <Th>Depuis</Th>
                  <Th>Dernier acteur</Th>
                  <Th>Actions possibles</Th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((it) => (
                  <tr key={it.id}>
                    <Td className="whitespace-nowrap font-medium">
                      <Link href={`/projects/${it.id}`} className="text-primary hover:underline">
                        {it.reference}
                      </Link>
                    </Td>
                    <Td>{it.name}</Td>
                    <Td>{it.promoter}</Td>
                    <Td className="whitespace-nowrap">{formatMAD(it.exposure)}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(it.since)}</Td>
                    <Td className="text-muted-foreground">{it.lastActor ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {it.actions.map((a) => (
                          <Badge key={a} className="bg-slate-100 text-slate-700 border-slate-300">{a}</Badge>
                        ))}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
