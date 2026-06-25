import { getActiveCalibration } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { CalibrationForm } from "@/components/CalibrationForm";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  if (!(await currentUserCan(PERMISSIONS.MODEL_READ))) return <AccessDenied />;
  const canEdit = await currentUserCan(PERMISSIONS.MODEL_WRITE);
  const res = await safe(getActiveCalibration);
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const c = res.data;

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
    </div>
  );
}
