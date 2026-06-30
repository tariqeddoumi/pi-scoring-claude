import * as XLSX from "xlsx";
import { buildTemplateAoa } from "@/lib/domain/importTemplate";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { securityEvent } from "@/lib/securityLog";

export const dynamic = "force-dynamic";

/**
 * Génère le modèle de fichier d'import (.xlsx) : une feuille « Projets »
 * (en-têtes + ligne d'exemple) et une feuille « Dictionnaire » décrivant
 * chaque colonne. Réservé à import.run (mêmes droits que l'import lui-même).
 */
export async function GET() {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.IMPORT_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Accès refusé", { status: 403 });
    throw e;
  }
  securityEvent("export", { actorId: actor.id, role: actor.role.name, resource: "import_template" });

  const { projets, dictionnaire } = buildTemplateAoa();
  const wb = XLSX.utils.book_new();

  const wsProjets = XLSX.utils.aoa_to_sheet(projets);
  wsProjets["!cols"] = projets[0]!.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsProjets, "Projets");

  const wsDict = XLSX.utils.aoa_to_sheet(dictionnaire);
  wsDict["!cols"] = [{ wch: 34 }, { wch: 32 }, { wch: 40 }, { wch: 44 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsDict, "Dictionnaire");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele_import_projets.xlsx"',
    },
  });
}
