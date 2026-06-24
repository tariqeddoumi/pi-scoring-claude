import { getMigrationMatrix } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge, Stat } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { CLASS_LABELS, CLASS_COLORS } from "@/lib/labels";
import { severityRank, type MigClass } from "@/lib/domain/migrationMatrix";

export const dynamic = "force-dynamic";

// Couleur de cellule : diagonale (stable) neutre, amélioration verte, dégradation rouge.
function cellTone(from: MigClass, to: MigClass, n: number): string {
  if (n === 0) return "";
  const delta = severityRank(to) - severityRank(from);
  if (delta === 0) return "bg-slate-100 text-slate-700 font-medium";
  if (delta < 0) return "bg-emerald-100 text-emerald-800 font-medium";
  return "bg-red-100 text-red-800 font-medium";
}

export default async function MigrationPage() {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_READ))) return <AccessDenied />;
  const res = await safe(getMigrationMatrix);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const { matrix, projectsTracked, projectsWithHistory } = res.data;
  const { order, counts, rowTotals, totalTransitions, stable, upgrades, downgrades } = matrix;

  const pct = (n: number) => (totalTransitions > 0 ? `${Math.round((n / totalTransitions) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Matrice de migration des notes</h1>
        <p className="text-sm text-muted-foreground">
          Transitions de classe réglementaire BKAM entre deux classifications successives d'un
          même dossier. Vert = amélioration, rouge = dégradation, gris = stabilité.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Transitions observées" value={totalTransitions} hint={`${projectsWithHistory}/${projectsTracked} dossiers avec historique`} />
        <Stat label="Stabilité" value={pct(stable)} hint={`${stable} transitions`} />
        <Stat label="Améliorations" value={pct(upgrades)} hint={`${upgrades} transitions`} />
        <Stat label="Dégradations" value={pct(downgrades)} hint={`${downgrades} transitions`} />
      </div>

      {totalTransitions === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucune migration observable : il faut au moins deux classifications datées par dossier.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Matrice (lignes = classe de départ · colonnes = classe d'arrivée)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Départ \ Arrivée</Th>
                  {order.map((c) => (
                    <Th key={c} className="text-center">{CLASS_LABELS[c]}</Th>
                  ))}
                  <Th className="text-center">Total</Th>
                </tr>
              </thead>
              <tbody>
                {order.map((from) => (
                  <tr key={from}>
                    <Td><Badge className={CLASS_COLORS[from]}>{CLASS_LABELS[from]}</Badge></Td>
                    {order.map((to) => {
                      const n = counts[from][to];
                      return (
                        <td key={to} className={`px-3 py-2 border border-border/60 text-center ${cellTone(from, to, n)}`}>
                          {n || ""}
                        </td>
                      );
                    })}
                    <Td className="text-center text-muted-foreground">{rowTotals[from] || ""}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
