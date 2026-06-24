import { portfolioCsv } from "@/server/export";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { securityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

export async function GET() {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.EXPORT_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Accès refusé", { status: 403 });
    throw e;
  }
  securityEvent("export", { actorId: actor.id, role: actor.role.name, resource: "portfolio" });
  try {
    const csv = await portfolioCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="portefeuille_pi_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return new Response(`Export indisponible: ${(e as Error).message}`, { status: 503 });
  }
}
