import { getRegimes } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatPercent, formatMAD, formatDate } from "@/lib/utils";
import { CLASS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function RegimesPage() {
  if (!(await currentUserCan(PERMISSIONS.REGIME_READ))) return <AccessDenied />;
  const res = await safe(getRegimes);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const regimes = res.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin réglementaire — Régimes BKAM</h1>
      {regimes.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {r.name}
              {r.active && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Actif</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              En vigueur dès {formatDate(r.effectiveFrom)} · seuil évaluation hyp. {formatMAD(r.hypEvaluationThreshold)} · restructuration {r.restructuringPolicy}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Classes & taux de provision</p>
              <Table>
                <thead><tr><Th>Classe</Th><Th>WL</Th><Th>Défaut</Th><Th>Bloque GO</Th><Th>Taux provision</Th></tr></thead>
                <tbody>
                  {r.classes.map((c) => (
                    <tr key={c.id}>
                      <Td>{CLASS_LABELS[c.code]}</Td>
                      <Td>{c.isWatchList ? "✓" : "—"}</Td>
                      <Td>{c.isDefault ? "✓" : "—"}</Td>
                      <Td>{c.blocksGo ? "✓" : "—"}</Td>
                      <Td>{formatPercent((c.provisionRates[0]?.rate ?? 0) * 100, 0)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Types de garanties (quotités & abattements)</p>
              <Table>
                <thead><tr><Th>Code</Th><Th>Quotité</Th><Th>Abattement</Th><Th>Éligible</Th></tr></thead>
                <tbody>
                  {r.guaranteeTypes.map((g) => (
                    <tr key={g.id}>
                      <Td>{g.label}</Td>
                      <Td>{formatPercent(g.quotity * 100, 0)}</Td>
                      <Td>{g.abatementProfile}</Td>
                      <Td>{g.eligible ? "✓" : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Déclencheurs ({r.triggers.length})</p>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                {(() => {
                  const codeById = new Map(r.classes.map((c) => [c.id, c.code] as const));
                  return r.triggers.slice(0, 30).map((t) => {
                    const code = codeById.get(t.classId);
                    return (
                      <li key={t.id}>{t.kind} → {code ? CLASS_LABELS[code] : ""} : {t.description}</li>
                    );
                  });
                })()}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
