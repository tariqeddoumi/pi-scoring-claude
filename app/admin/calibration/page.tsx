import { getActiveCalibration, getCalibrationHistory } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { CalibrationForm } from "@/components/CalibrationForm";

export const dynamic = "force-dynamic";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)} %`;

export default async function CalibrationPage() {
  if (!(await currentUserCan(PERMISSIONS.MODEL_READ))) return <AccessDenied />;
  const canEdit = await currentUserCan(PERMISSIONS.MODEL_WRITE);
  const res = await safe(getActiveCalibration);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const c = res.data;
  const histRes = await safe(() => getCalibrationHistory(20));
  const history = histRes.ok ? histRes.data : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calibrage du risque</h1>
        <p className="text-sm text-muted-foreground">
          Paramètres alimentant les métriques Bâle / IFRS 9 (PD par catégorie de slotting, LGD,
          maturité). Éditables par le risk manager — à ajuster sur l'historique de défauts et de
          recouvrement de la banque. Les modifications s'appliquent au prochain rendu des écrans.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Paramètres actifs — {c.label}</CardTitle></CardHeader>
        <CardContent>
          <CalibrationForm
            initial={{
              label: c.label,
              pdStrong: c.pd.STRONG,
              pdGood: c.pd.GOOD,
              pdSatisfactory: c.pd.SATISFACTORY,
              pdWeak: c.pd.WEAK,
              lgdUnsecured: c.lgdUnsecured,
              lgdFloor: c.lgdFloor,
              maturityYears: c.maturityYears,
            }}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Historique des versions</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Libellé</Th><Th>Auteur</Th><Th>PD (S/G/Sat/W)</Th><Th>LGD / plancher</Th><Th>Maturité</Th><Th>Statut</Th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <Td className="whitespace-nowrap">{formatDate(h.createdAt)}</Td>
                    <Td>{h.label}</Td>
                    <Td className="text-muted-foreground">{h.updatedByEmail ?? "—"}</Td>
                    <Td className="whitespace-nowrap">{pct(h.pdStrong, 2)} / {pct(h.pdGood, 2)} / {pct(h.pdSatisfactory, 1)} / {pct(h.pdWeak, 1)}</Td>
                    <Td className="whitespace-nowrap">{pct(h.lgdUnsecured, 0)} / {pct(h.lgdFloor, 0)}</Td>
                    <Td>{h.maturityYears} ans</Td>
                    <Td>{h.active ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Active</Badge> : <span className="text-muted-foreground text-xs">historique</span>}</Td>
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
