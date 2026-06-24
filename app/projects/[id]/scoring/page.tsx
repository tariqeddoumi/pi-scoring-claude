import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail } from "@/server/queries";
import { ScoringWizard } from "@/components/ScoringWizard";
import { DbSetupNotice, safe } from "@/lib/dbGuard";

export const dynamic = "force-dynamic";

export default async function ScoringWizardPage({ params }: { params: { id: string } }) {
  const res = await safe(() => getProjectDetail(params.id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const p = res.data;
  if (!p) return notFound();

  const initial: Record<string, any> = {};
  for (const i of p.inputs) initial[i.key] = i.valueNum ?? i.valueStr ?? i.valueBool ?? null;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:underline">← {p.name}</Link>
        <h1 className="text-2xl font-bold">Wizard de scoring</h1>
        <p className="text-sm text-muted-foreground">Saisie multi-onglets avec sauvegarde brouillon et calcul BKAM.</p>
      </div>
      <ScoringWizard projectId={p.id} initial={initial} />
    </div>
  );
}
