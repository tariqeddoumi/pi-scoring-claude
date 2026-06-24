import { projectReportHtml } from "@/server/export";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await currentUserCan(PERMISSIONS.EXPORT_RUN))) {
    return new Response("Accès refusé", { status: 403 });
  }
  try {
    const html = await projectReportHtml(params.id);
    if (!html) return new Response("Projet introuvable", { status: 404 });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    return new Response(`Export indisponible: ${(e as Error).message}`, { status: 503 });
  }
}
