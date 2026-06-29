import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectFormOptions, getProjectForEdit } from "@/server/queries";
import { ProjectForm } from "@/components/ProjectForm";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_WRITE))) return <AccessDenied />;
  const res = await safe(() => Promise.all([getProjectFormOptions(), getProjectForEdit(params.id)]));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const [options, project] = res.data;
  if (!project) return notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground hover:underline">← {project.name}</Link>
        <h1 className="text-2xl font-bold">Éditer le projet</h1>
      </div>
      <ProjectForm options={options} initial={project} />
    </div>
  );
}
