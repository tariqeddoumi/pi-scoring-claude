import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui";
import { AccessDenied } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

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
    </div>
  );
}
