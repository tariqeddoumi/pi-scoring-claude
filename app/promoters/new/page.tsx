import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PromoterForm } from "@/components/PromoterForm";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function NewPromoterPage() {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_WRITE))) return <AccessDenied />;
  const res = await safe(() =>
    prisma.group.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  );
  if (!res.ok) return <DbSetupNotice error={res.error} />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/promoters" className="text-sm text-muted-foreground hover:underline">← Promoteurs</Link>
        <h1 className="text-2xl font-bold">Nouveau promoteur</h1>
      </div>
      <PromoterForm groups={res.data} />
    </div>
  );
}
