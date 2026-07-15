import Link from "next/link";
import { notFound } from "next/navigation";
import { getPromoterDetail } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge, Stat } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatMAD, formatNumber } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS } from "@/lib/labels";
import { LEGAL_FORMS } from "@/lib/domain/referentiels";
import { PromoterLinksPanel, type PromoterLinkView } from "@/components/PromoterLinksPanel";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default async function PromoterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUserCan(PERMISSIONS.PROJECT_READ))) return <AccessDenied />;
  const canWrite = await currentUserCan(PERMISSIONS.PROJECT_WRITE);

  const res = await safe(() => getPromoterDetail(id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  if (!res.data) notFound();
  const { promoter: p, others } = res.data;

  const links: PromoterLinkView[] = [
    ...p.linksFrom.map((l) => ({
      id: l.id, otherId: l.to.id, otherName: l.to.name,
      direction: "to" as const, type: l.type, note: l.note,
    })),
    ...p.linksTo.map((l) => ({
      id: l.id, otherId: l.from.id, otherName: l.from.name,
      direction: "from" as const, type: l.type, note: l.note,
    })),
  ];

  const exposure = p.projects.reduce((n, pr) => n + (pr.loanAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/promoters" className="text-sm text-muted-foreground hover:underline">← Promoteurs</Link>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-muted-foreground">
            {p.legalForm ? LEGAL_FORMS.labelOf(p.legalForm) : "Forme non renseignée"}
            {p.group ? <> · Groupe <Link href="/groups" className="text-primary hover:underline">{p.group.name}</Link></> : null}
          </p>
        </div>
        {canWrite && (
          <Link href={`/promoters/${p.id}/edit`} className="text-sm rounded-md border border-border px-3 py-2 hover:bg-muted">
            Éditer la signalétique
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Projets" value={p.projects.length} />
        <Stat label="Exposition totale" value={formatMAD(exposure)} />
        <Stat label="Expérience" value={p.yearsExperience != null ? `${p.yearsExperience} ans` : "—"} />
        <Stat label="Notation interne" value={p.internalRating ?? "—"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Identification</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Registre de commerce" value={p.rcNumber} />
            <Field label="ICE" value={p.iceNumber} />
            <Field label="Identifiant fiscal" value={p.ifNumber} />
            <Field label="CNSS" value={p.cnssNumber} />
            <Field label="Patente" value={p.patenteNumber} />
            <Field label="Capital social" value={p.capital != null ? formatMAD(p.capital) : null} />
            <Field label="Année de création" value={p.foundedYear} />
            <Field label="Dirigeant principal" value={p.managerName} />
            <div className="col-span-2">
              <Field label="Actionnariat" value={p.shareholders} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Coordonnées & relation</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Adresse" value={p.address} />
            <Field label="Ville" value={p.city} />
            <Field label="Email" value={p.contactEmail} />
            <Field label="Téléphone" value={p.contactPhone} />
            <Field label="Site web" value={p.website} />
            <Field label="Projets réalisés" value={p.completedProjects != null ? formatNumber(p.completedProjects) : null} />
            <div className="col-span-2">
              <Field label="Autres relations bancaires" value={p.bankRelations} />
            </div>
            <div className="col-span-2">
              <Field label="Notes" value={p.notes} />
            </div>
          </CardContent>
        </Card>
      </div>

      <PromoterLinksPanel promoterId={p.id} links={links} others={others} canEdit={canWrite} />

      <Card>
        <CardHeader><CardTitle>Projets du promoteur</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Référence</Th><Th>Projet</Th><Th>Exposition</Th>
                <Th>Classe BKAM</Th><Th>Décision</Th>
              </tr>
            </thead>
            <tbody>
              {p.projects.map((pr) => {
                const cls = pr.classificationRuns[0]?.resultClass;
                const dec = pr.scoringRuns[0]?.decision;
                return (
                  <tr key={pr.id} className="hover:bg-muted/50">
                    <Td><Link className="text-primary hover:underline" href={`/projects/${pr.id}`}>{pr.reference}</Link></Td>
                    <Td>{pr.name}</Td>
                    <Td className="whitespace-nowrap">{formatMAD(pr.loanAmount)}</Td>
                    <Td>{cls ? <Badge className={CLASS_COLORS[cls]}>{CLASS_LABELS[cls]}</Badge> : "—"}</Td>
                    <Td>{dec ? <Badge className={DECISION_COLORS[dec]}>{DECISION_LABELS[dec]}</Badge> : "—"}</Td>
                  </tr>
                );
              })}
              {p.projects.length === 0 && (
                <tr><Td className="text-muted-foreground" >Aucun projet pour ce promoteur.</Td></tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
