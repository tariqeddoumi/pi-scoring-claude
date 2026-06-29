import Link from "next/link";
import { getProjectFormOptions } from "@/server/queries";
import { ProjectForm } from "@/components/ProjectForm";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_WRITE))) return <AccessDenied />;
  const res = await safe(getProjectFormOptions);
  if (!res.ok) return <DbSetupNotice error={res.error} />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/projects" className="text-sm text-muted-foreground hover:underline">← Projets</Link>
        <h1 className="text-2xl font-bold">Nouveau projet</h1>
      </div>
      <ProjectForm options={res.data} />
    </div>
  );
}
