import * as XLSX from "xlsx";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { securityEvent } from "@/lib/securityLog";
import { toCsv } from "@/server/export";
import { loadProjectRows } from "@/server/services/projectList";
import { parseProjectFilters, projectListTable } from "@/lib/projectFilters";
import { CLASS_LABELS, DECISION_LABELS } from "@/lib/labels";
import { WORKFLOW_LABELS, type WorkflowStateName } from "@/lib/workflow";
import { CITIES, SEGMENTS } from "@/lib/domain/referentiels";
import type { Decision, RegulatoryClassCode } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/**
 * Export de la liste des projets avec les mêmes filtres et le même tri que la
 * page /projects (paramètres d'URL identiques), toutes pages confondues.
 * ?format=xlsx (défaut) ou csv.
 * Réservé à export.run.
 */
export async function GET(req: Request) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.EXPORT_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Accès refusé", { status: 403 });
    throw e;
  }
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const format = params.format === "csv" ? "csv" : "xlsx";
  const f = parseProjectFilters(params);
  securityEvent("export", { actorId: actor.id, role: actor.role.name, resource: `projects_${format}` });

  try {
    const rows = await loadProjectRows(f);
    const table = projectListTable(rows, {
      city: (c) => (c ? CITIES.labelOf(c) : ""),
      segment: (c) => (c ? SEGMENTS.labelOf(c) : ""),
      decision: (d) => (d ? DECISION_LABELS[d as Decision] ?? d : ""),
      cls: (c) => (c ? CLASS_LABELS[c as RegulatoryClassCode] ?? c : ""),
      state: (s) => WORKFLOW_LABELS[s as WorkflowStateName] ?? s,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      return new Response(toCsv(table), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="projets_${stamp}.csv"`,
        },
      });
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(table);
    ws["!cols"] = [14, 32, 30, 16, 22, 16, 11, 26, 18, 30, 12, 12].map((wch) => ({ wch }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: table.length - 1, c: table[0]!.length - 1 } }) };
    // Format numérique des montants (colonne F) et des scores (colonne G).
    for (let r = 1; r < table.length; r++) {
      const amount = ws[XLSX.utils.encode_cell({ r, c: 5 })];
      if (amount && typeof amount.v === "number") amount.z = "#,##0";
      const score = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      if (score && typeof score.v === "number") score.z = "0.00";
    }
    XLSX.utils.book_append_sheet(wb, ws, "Projets");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="projets_${stamp}.xlsx"`,
      },
    });
  } catch (e) {
    return new Response(`Export indisponible : ${(e as Error).message}`, { status: 503 });
  }
}
