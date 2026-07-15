import Link from "next/link";
import { getPromoters } from "@/server/queries";
import { Card, CardContent, Table, Th, Td, Badge } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { LEGAL_FORMS } from "@/lib/domain/referentiels";

export const dynamic = "force-dynamic";

export default async function PromotersPage() {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_READ))) return <AccessDenied />;
  const canWrite = await currentUserCan(PERMISSIONS.PROJECT_WRITE);

  const res = await safe(getPromoters);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const promoters = res.data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Promoteurs</h1>
          <p className="text-sm text-muted-foreground">
            Signalétique, groupe d&apos;intérêt et liens entre promoteurs (parties liées).
          </p>
        </div>
        {canWrite && (
          <Link href="/promoters/new" className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-2 hover:opacity-90">
            + Nouveau promoteur
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Raison sociale</Th>
                <Th>Forme</Th>
                <Th>RC / ICE</Th>
                <Th>Dirigeant</Th>
                <Th>Groupe</Th>
                <Th>Projets</Th>
                <Th>Liens</Th>
                <Th>Notation</Th>
              </tr>
            </thead>
            <tbody>
              {promoters.map((p) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <Td className="font-medium">
                    <Link href={`/promoters/${p.id}`} className="text-primary hover:underline">{p.name}</Link>
                  </Td>
                  <Td>{p.legalForm ? LEGAL_FORMS.labelOf(p.legalForm) : "—"}</Td>
                  <Td className="text-muted-foreground whitespace-nowrap">
                    {[p.rcNumber, p.iceNumber].filter(Boolean).join(" / ") || "—"}
                  </Td>
                  <Td>{p.managerName ?? "—"}</Td>
                  <Td>{p.group?.name ?? p.groupName ?? "—"}</Td>
                  <Td><Badge className="bg-muted">{p._count.projects}</Badge></Td>
                  <Td><Badge className="bg-muted">{p._count.linksFrom + p._count.linksTo}</Badge></Td>
                  <Td>{p.internalRating ?? "—"}</Td>
                </tr>
              ))}
              {promoters.length === 0 && (
                <tr><Td className="text-muted-foreground" >Aucun promoteur enregistré.</Td></tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
