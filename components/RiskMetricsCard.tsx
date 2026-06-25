import { Card, CardContent, CardHeader, CardTitle, Badge, Stat } from "@/components/ui";
import { formatMAD, formatPercent } from "@/lib/utils";
import { computeRiskMetrics, SLOTTING_LABELS } from "@/lib/domain/riskMetrics";
import { computeEcl } from "@/lib/domain/ifrs9";
import type { RegulatoryClassCode } from "@/lib/domain/types";

const SLOTTING_COLORS: Record<string, string> = {
  STRONG: "bg-emerald-100 text-emerald-800 border-emerald-300",
  GOOD: "bg-lime-100 text-lime-800 border-lime-300",
  SATISFACTORY: "bg-amber-100 text-amber-800 border-amber-300",
  WEAK: "bg-orange-100 text-orange-800 border-orange-300",
  DEFAULT: "bg-red-100 text-red-800 border-red-300",
};
const STAGE_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  2: "bg-amber-100 text-amber-800 border-amber-300",
  3: "bg-red-100 text-red-800 border-red-300",
};

export function RiskMetricsCard({
  score,
  cls,
  ead,
  eligibleGuarantees,
  bkamProvision,
}: {
  score: number | null;
  cls: RegulatoryClassCode | null;
  ead: number;
  eligibleGuarantees: number;
  bkamProvision?: number | null;
}) {
  if (!score && !cls) return null;
  const m = computeRiskMetrics({ score, cls, ead, eligibleGuarantees });
  const ecl = computeEcl({ stage: m.stage, pd12m: m.pd, lgd: m.lgd, ead: m.ead });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Métriques de risque — Bâle / IFRS 9
          <Badge className={SLOTTING_COLORS[m.slotting]}>{SLOTTING_LABELS[m.slotting]}</Badge>
          <Badge className={STAGE_COLORS[m.stage]}>IFRS 9 — Stage {m.stage}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="PD" value={formatPercent(m.pd * 100, 2)} hint="probabilité de défaut" />
          <Stat label="LGD" value={formatPercent(m.lgd * 100, 1)} hint="perte en cas de défaut" />
          <Stat label="EAD" value={formatMAD(m.ead)} hint="exposition au défaut" />
          <Stat label="Perte attendue (EL)" value={formatMAD(m.expectedLoss)} hint="PD × LGD × EAD" />
          <Stat label="RWA" value={formatMAD(m.rwa)} hint={`pondération ${Math.round(m.riskWeight * 100)}%`} />
        </div>

        <div className="rounded-md border border-border p-3">
          <div className="text-sm font-medium mb-2">Double cadre de provisionnement</div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="ECL IFRS 9" value={formatMAD(ecl.ecl)} hint={ecl.horizon === "12M" ? "12 mois (Stage 1)" : `lifetime (Stage ${m.stage})`} />
            {bkamProvision != null && <Stat label="Provision BKAM" value={formatMAD(bkamProvision)} hint="prudentiel" />}
            {bkamProvision != null && (
              <Stat
                label="Écart IFRS 9 − BKAM"
                value={`${ecl.ecl - bkamProvision >= 0 ? "+" : ""}${formatMAD(ecl.ecl - bkamProvision)}`}
                hint="comptable vs prudentiel"
              />
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Lecture internationale (approche slotting supervisée Bâle pour le financement spécialisé,
          pertes attendues IRB, staging IFRS 9) dérivée du score et de la classe BKAM. Paramètres
          PD/LGD/pondérations indicatifs — à calibrer sur l'historique de la banque.
        </p>
      </CardContent>
    </Card>
  );
}
