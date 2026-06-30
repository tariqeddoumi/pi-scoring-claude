import { projectReportHtml } from "@/server/export";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { securityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let actor;
  try {
    actor = await authorize(PERMISSIONS.EXPORT_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Accès refusé", { status: 403 });
    throw e;
  }
  securityEvent("export", {
    actorId: actor.id,
    role: actor.role.name,
    resource: `project:${id}`,
  });
  try {
    const html = await projectReportHtml(id);
    if (!html) return new Response("Projet introuvable", { status: 404 });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    return new Response(`Export indisponible: ${(e as Error).message}`, { status: 503 });
  }
}
