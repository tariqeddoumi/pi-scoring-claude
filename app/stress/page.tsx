import Link from "next/link";
import { getStressTest, getStressBattery } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle, Table, Th, Td, Badge, Stat, Button } from "@/components/ui";
import { DbSetupNotice, AccessDenied, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { CLASS_LABELS, CLASS_COLORS } from "@/lib/labels";
import { formatMAD } from "@/lib/utils";

export const dynamic = "force-dynamic";

function num(v: string | string[] | undefined, def: number): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function Delta({ base, stressed }: { base: number; stressed: number }) {
  const d = stressed - base;
  const pct = base > 0 ? Math.round((d / base) * 100) : null;
  const cls = d > 0 ? "text-red-600" : d < 0 ? "text-emerald-600" : "text-muted-foreground";
  return <span className={cls}>{d >= 0 ? "+" : ""}{formatMAD(d)}{pct != null ? ` (${d >= 0 ? "+" : ""}${pct}%)` : ""}</span>;
}

export default async function StressPage({
  searchParams,
}: {
  searchParams: Promise<{ preSaleDrop?: string; dpdAdd?: string }>;
}) {
  if (!(await currentUserCan(PERMISSIONS.PROJECT_READ))) return <AccessDenied />;
  const sp = await searchParams;
  const preSaleDrop = num(sp.preSaleDrop, 20);
  const dpdAdd = num(sp.dpdAdd, 120);

  const res = await safe(() => getStressTest({ preSaleDrop, dpdAdd }));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const d = res.data;
  const batteryRes = await safe(() => getStressBattery());
  const battery = batteryRes.ok ? batteryRes.data : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stress test portefeuille</h1>
        <p className="text-sm text-muted-foreground">
          Choc appliqué aux entrées (baisse des préventes, hausse des impayés), puis re-exécution
          des moteurs de classification, scoring et provisionnement. Comparaison base vs scénario stressé.
        </p>
      </div>

      {battery && (
        <Card>
          <CardHeader><CardTitle>Batterie de scénarios standard (§9.1)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>Scénario</Th><Th className="text-right">Perte attendue</Th><Th className="text-right">Δ EL</Th><Th className="text-right">Provision</Th><Th className="text-right">Δ Provision</Th><Th className="text-right">Dégradés</Th><Th className="text-right">Stage 3</Th></tr>
              </thead>
              <tbody>
                <tr className="text-muted-foreground">
                  <Td>Base (sans choc)</Td>
                  <Td className="text-right whitespace-nowrap">{formatMAD(battery.base.totalEl)}</Td>
                  <Td className="text-right">—</Td>
                  <Td className="text-right whitespace-nowrap">{formatMAD(battery.base.totalProvision)}</Td>
                  <Td className="text-right">—</Td>
                  <Td className="text-right">—</Td>
                  <Td className="text-right">{battery.base.stageDist[3] ?? 0}</Td>
                </tr>
                {battery.scenarios.map((sc) => (
                  <tr key={sc.key}>
                    <Td className="font-medium">{sc.label}</Td>
                    <Td className="text-right whitespace-nowrap">{formatMAD(sc.totalEl)}</Td>
                    <Td className="text-right whitespace-nowrap text-red-600">{sc.elDelta >= 0 ? "+" : ""}{formatMAD(sc.elDelta)}</Td>
                    <Td className="text-right whitespace-nowrap">{formatMAD(sc.totalProvision)}</Td>
                    <Td className="text-right whitespace-nowrap text-red-600">{sc.provDelta >= 0 ? "+" : ""}{formatMAD(sc.provDelta)}</Td>
                    <Td className="text-right">{sc.downgrades}/{battery.total}</Td>
                    <Td className="text-right">{sc.stage3}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Scénario de choc personnalisé</CardTitle></CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Baisse des préventes</span>
              <div className="flex items-center gap-1">
                <input type="number" name="preSaleDrop" defaultValue={preSaleDrop} min={0} max={100} className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <span className="text-muted-foreground">pts</span>
              </div>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Hausse des impayés</span>
              <div className="flex items-center gap-1">
                <input type="number" name="dpdAdd" defaultValue={dpdAdd} min={0} max={720} className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <span className="text-muted-foreground">jours</span>
              </div>
            </label>
            <Button type="submit">Appliquer le choc</Button>
            <Link href="/stress?preSaleDrop=0&dpdAdd=0" className="text-sm text-muted-foreground hover:underline self-center">Réinitialiser</Link>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Dossiers dégradés" value={d.downgrades} hint={`sur ${d.total}`} />
        <Stat label="Nouveaux défauts (Stage 3)" value={d.newDefaults} />
        <Stat label="Stages base → stressé" value={`${d.base.stageDist[3] ?? 0} → ${d.stressed.stageDist[3] ?? 0}`} hint="Stage 3" />
        <Stat label="Préventes / DPD" value={`-${preSaleDrop} pts / +${dpdAdd} j`} />
      </div>

      <Card>
        <CardHeader><CardTitle>Impact sur les pertes & provisions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr><Th>Mesure</Th><Th className="text-right">Base</Th><Th className="text-right">Stressé</Th><Th className="text-right">Variation</Th></tr>
            </thead>
            <tbody>
              <tr>
                <Td>Perte attendue (EL — Bâle)</Td>
                <Td className="text-right whitespace-nowrap">{formatMAD(d.base.totalEl)}</Td>
                <Td className="text-right whitespace-nowrap">{formatMAD(d.stressed.totalEl)}</Td>
                <Td className="text-right whitespace-nowrap"><Delta base={d.base.totalEl} stressed={d.stressed.totalEl} /></Td>
              </tr>
              <tr>
                <Td>ECL IFRS 9</Td>
                <Td className="text-right whitespace-nowrap">{formatMAD(d.base.totalEcl)}</Td>
                <Td className="text-right whitespace-nowrap">{formatMAD(d.stressed.totalEcl)}</Td>
                <Td className="text-right whitespace-nowrap"><Delta base={d.base.totalEcl} stressed={d.stressed.totalEcl} /></Td>
              </tr>
              <tr>
                <Td>Provision BKAM</Td>
                <Td className="text-right whitespace-nowrap">{formatMAD(d.base.totalProvision)}</Td>
                <Td className="text-right whitespace-nowrap">{formatMAD(d.stressed.totalProvision)}</Td>
                <Td className="text-right whitespace-nowrap"><Delta base={d.base.totalProvision} stressed={d.stressed.totalProvision} /></Td>
              </tr>
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {d.impacts.some((i) => i.elDelta !== 0 || i.downgraded) && (
        <Card>
          <CardHeader><CardTitle>Dossiers les plus impactés</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <thead>
                <tr><Th>Référence</Th><Th>Projet</Th><Th>Classe base → stressé</Th><Th className="text-right">Δ Perte attendue</Th></tr>
              </thead>
              <tbody>
                {d.impacts.filter((i) => i.elDelta !== 0 || i.downgraded).map((i) => (
                  <tr key={i.id} className={i.downgraded ? "bg-red-50" : ""}>
                    <Td className="font-medium"><Link href={`/projects/${i.id}`} className="text-primary hover:underline">{i.reference}</Link></Td>
                    <Td>{i.name}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge className={CLASS_COLORS[i.baseClass]}>{CLASS_LABELS[i.baseClass]}</Badge>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <Badge className={CLASS_COLORS[i.stressedClass]}>{CLASS_LABELS[i.stressedClass]}</Badge>
                    </Td>
                    <Td className="text-right whitespace-nowrap text-red-600">{i.elDelta >= 0 ? "+" : ""}{formatMAD(i.elDelta)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        EAD et garanties éligibles sont maintenus constants ; seuls la classe, le score et donc les
        pertes/provisions sont recalculés sous choc, avec le calibrage de risque actif.
      </p>
    </div>
  );
}
