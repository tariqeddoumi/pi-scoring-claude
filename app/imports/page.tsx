import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge } from "@/components/ui";
import { AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { getImportBatches } from "@/server/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const IMPORT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-300",
  PROCESSING: "bg-blue-100 text-blue-800 border-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  FAILED: "bg-red-100 text-red-800 border-red-300",
  PARTIAL: "bg-amber-100 text-amber-800 border-amber-300",
};

const TEMPLATE_COLUMNS = [
  ["reference", "Référence unique du projet"],
  ["name", "Nom du projet"],
  ["promoter_name", "Nom du promoteur"],
  ["city / region", "Localisation"],
  ["segment / zone", "Segmentation modèle V1.0"],
  ["loan_amount / total_cost / own_equity", "Montants (MAD)"],
  ["pre_sale_rate / cash_coverage / ltc / ltv_stressed …", "KPI de scoring (colonnes = inputKey)"],
  ["dpd_days / restructured / legal_exposure", "Déclencheurs réglementaires"],
];

export default async function ImportsPage() {
  if (!(await currentUserCan(PERMISSIONS.IMPORT_RUN))) return <AccessDenied />;
  const res = await safe(() => getImportBatches());
  const batches = res.ok ? res.data : [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Import Excel / CSV</h1>
      <p className="text-sm text-muted-foreground">
        Chargez un portefeuille via un fichier dont les colonnes correspondent aux clés d'entrée
        (<code className="bg-muted px-1 rounded">inputKey</code>). Le mapping et le rapport d'erreurs sont
        journalisés dans <code className="bg-muted px-1 rounded">ImportBatch</code>.
      </p>

      <Card>
        <CardHeader><CardTitle>Modèle de colonnes attendu</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Colonne</Th><Th>Description</Th></tr></thead>
            <tbody>
              {TEMPLATE_COLUMNS.map(([c, d]) => (
                <tr key={c}><Td className="font-mono text-xs">{c}</Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Téléverser un fichier</CardTitle></CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
            <p className="text-sm">Glissez-déposez un fichier .xlsx / .csv</p>
            <p className="text-xs mt-1">
              Le pipeline d'import (parsing → mapping → validation Zod → rapport) est exposé côté serveur
              via <code className="bg-muted px-1 rounded">ImportBatch</code>. Brancher un parseur (ex. SheetJS) selon l'environnement.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historique des imports</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead><tr><Th>Date</Th><Th>Fichier</Th><Th>Entité</Th><Th>Statut</Th><Th>Lignes (OK/total)</Th><Th>Par</Th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <Td className="whitespace-nowrap">{formatDate(b.createdAt)}</Td>
                  <Td className="font-mono text-xs">{b.fileName}</Td>
                  <Td>{b.entity}</Td>
                  <Td><Badge className={IMPORT_STATUS_COLORS[b.status] ?? ""}>{b.status}</Badge></Td>
                  <Td>{b.successRows}/{b.totalRows}{b.errorRows > 0 ? ` · ${b.errorRows} erreur(s)` : ""}</Td>
                  <Td className="text-muted-foreground">{b.importedBy?.name ?? "—"}</Td>
                </tr>
              ))}
              {batches.length === 0 && <tr><Td className="text-muted-foreground">Aucun import enregistré.</Td></tr>}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
