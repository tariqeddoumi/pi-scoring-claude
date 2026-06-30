import * as XLSX from "xlsx";
import { committeeWorkbookSheets } from "@/server/export";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { securityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

/**
 * Dossier de comité détaillé d'un projet au format Excel (.xlsx) : synthèse,
 * scoring critère par critère, classification 1/W et provisionnement.
 * Réservé à export.run.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let actor;
  try {
    actor = await authorize(PERMISSIONS.EXPORT_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Accès refusé", { status: 403 });
    throw e;
  }
  securityEvent("export", { actorId: actor.id, role: actor.role.name, resource: `project_xlsx:${id}` });

  try {
    const sheets = await committeeWorkbookSheets(id);
    if (!sheets) return new Response("Projet introuvable", { status: 404 });

    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
      ws["!cols"] = [{ wch: 40 }, { wch: 28 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dossier_comite_${id}.xlsx"`,
      },
    });
  } catch (e) {
    return new Response(`Export indisponible: ${(e as Error).message}`, { status: 503 });
  }
}
