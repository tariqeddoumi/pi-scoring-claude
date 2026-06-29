import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail, getScoringHistory } from "@/server/queries";
import { ScoringWizard } from "@/components/ScoringWizard";
import { ScoreTimeline } from "@/components/ScoreTimeline";
import { WIZARD_STEPS, EXPLOITATION_WIZARD_STEPS } from "@/lib/wizardFields";
import { DbSetupNotice, safe } from "@/lib/dbGuard";

export const dynamic = "force-dynamic";

export default async function ScoringWizardPage({ params }: { params: { id: string } }) {
  const res = await safe(() => getProjectDetail(params.id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const p = res.data;
  if (!p) return notFound();

  const initial: Record<string, any> = {};
  for (const i of p.inputs) initial[i.key] = i.valueNum ?? i.valueStr ?? i.valueBool ?? null;

  // Le wizard suit la nature de l'actif : modèle promotion (vente) ou modèle
  // exploitation (hôtel / immobilier de rapport).
  const isExploitation = p.assetType === "EXPLOITATION";
  const steps = isExploitation ? EXPLOITATION_WIZARD_STEPS : WIZARD_STEPS;

  const historyRes = await safe(() => getScoringHistory(p.id));
  const history = historyRes.ok ? historyRes.data : [];

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:underline">← {p.name}</Link>
        <h1 className="text-2xl font-bold">Wizard de scoring</h1>
        <p className="text-sm text-muted-foreground">
          {isExploitation
            ? "Actif d'exploitation : critères opérés (DSCR, occupation, opérateur, LTV)."
            : "Saisie multi-onglets avec sauvegarde brouillon et calcul BKAM."}
        </p>
      </div>
      <ScoringWizard projectId={p.id} initial={initial} steps={steps} />
      <ScoreTimeline runs={history} />
    </div>
  );
}
