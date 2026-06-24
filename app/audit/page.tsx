import { getAuditLog } from "@/server/queries";
import { Card, CardContent, Table, Th, Td, Badge } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, string> = {
  CALCULATE: "bg-blue-100 text-blue-800 border-blue-300",
  CLASSIFY: "bg-purple-100 text-purple-800 border-purple-300",
  PROVISION: "bg-amber-100 text-amber-800 border-amber-300",
  CREATE: "bg-emerald-100 text-emerald-800 border-emerald-300",
  UPDATE: "bg-slate-100 text-slate-800 border-slate-300",
};

export default async function AuditPage() {
  if (!(await currentUserCan(PERMISSIONS.AUDIT_READ))) return <AccessDenied />;
  const res = await safe(() => getAuditLog(150));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const logs = res.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Piste d'audit</h1>
      <p className="text-sm text-muted-foreground">Journalisation systématique de tout calcul et changement (snapshots avant/après).</p>
      <Card>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Date</Th><Th>Action</Th><Th>Entité</Th><Th>Acteur</Th><Th>Détail</Th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap">{formatDate(l.createdAt)}</Td>
                  <Td><Badge className={ACTION_COLORS[l.action] ?? "bg-muted"}>{l.action}</Badge></Td>
                  <Td>{l.entity}</Td>
                  <Td>{l.actor?.name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground max-w-md truncate">{JSON.stringify(l.after ?? l.metadata ?? {})}</Td>
                </tr>
              ))}
              {logs.length === 0 && <tr><Td className="text-muted-foreground">Aucune entrée d'audit.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
