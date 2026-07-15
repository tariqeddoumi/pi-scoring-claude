import Link from "next/link";
import { notFound } from "next/navigation";
import { getPromoterDetail } from "@/server/queries";
import { PromoterForm } from "@/components/PromoterForm";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function EditPromoterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUserCan(PERMISSIONS.PROJECT_WRITE))) return <AccessDenied />;

  const res = await safe(() => getPromoterDetail(id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  if (!res.data) notFound();
  const { promoter: p, groups } = res.data;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/promoters/${p.id}`} className="text-sm text-muted-foreground hover:underline">← {p.name}</Link>
        <h1 className="text-2xl font-bold">Éditer la signalétique</h1>
      </div>
      <PromoterForm groups={groups} initial={p} />
    </div>
  );
}
