import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectDetail, getScoringHistory } from "@/server/queries";
import { ScoringWizard } from "@/components/ScoringWizard";
import { ScoreTimeline } from "@/components/ScoreTimeline";
import { WIZARD_STEPS, EXPLOITATION_WIZARD_STEPS, type FieldDef } from "@/lib/wizardFields";
import { uncoveredModelFields } from "@/lib/modelInputs";
import { loadActiveModelConfig } from "@/server/services/modelLoader";
import { prisma } from "@/lib/prisma";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { ProjectSubnav } from "@/components/ProjectSubnav";

export const dynamic = "force-dynamic";

export default async function ScoringWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await safe(() => getProjectDetail(id));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const p = res.data;
  if (!p) return notFound();

  const initial: Record<string, any> = {};
  for (const i of p.inputs) initial[i.key] = i.valueNum ?? i.valueStr ?? i.valueBool ?? null;

  // Le wizard suit la nature de l'actif : modèle promotion (vente) ou modèle
  // exploitation (hôtel / immobilier de rapport).
  const isExploitation = p.assetType === "EXPLOITATION";
  const baseSteps = isExploitation ? EXPLOITATION_WIZARD_STEPS : WIZARD_STEPS;

  // Alignement sur le modèle PUBLIÉ : tout critère ou alerte dont la clé n'est
  // pas encore présentée par les étapes standard (ajout via l'administration
  // du modèle) est proposé dans une étape dédiée, avec ses modalités.
  const modelRes = await safe(() => loadActiveModelConfig(prisma, isExploitation ? "PI_EXPLOITATION" : "PI_PROMOTION"));
  const covered = baseSteps.flatMap((s) => s.fields.map((f) => f.key));
  const extraFields: FieldDef[] = modelRes.ok
    ? uncoveredModelFields(modelRes.data.config, covered).map((f) => ({
        key: f.key,
        type: f.kind,
        label: f.label,
        options: f.options,
        hint: `${f.source === "criterion" ? "Critère" : "Alerte"} ${f.code} du modèle ${modelRes.data.config.version}`,
      }))
    : [];
  const steps = extraFields.length
    ? [...baseSteps, { id: "modele", title: "Autres critères du modèle publié", fields: extraFields }]
    : baseSteps;

  const historyRes = await safe(() => getScoringHistory(p.id));
  const history = historyRes.ok ? historyRes.data : [];

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:underline">← {p.name}</Link>
        <h1 className="text-2xl font-bold">Saisie & scoring</h1>
        <p className="text-sm text-muted-foreground">
          {isExploitation
            ? "Actif d'exploitation : critères opérés (DSCR, occupation, opérateur, LTV)."
            : "Saisie multi-onglets avec sauvegarde brouillon et calcul BKAM."}
        </p>
      </div>
      <ProjectSubnav projectId={p.id} active="scoring" />
      <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
        Pièces du client (business plan, autorisations, état des préventes…) :{" "}
        <Link href={`/projects/${p.id}/documents`} className="font-medium text-primary hover:underline">déposez-les dans « Documents »</Link>{" "}
        pour pré-remplir cette saisie et suivre les pièces manquantes.
      </p>
      <ScoringWizard projectId={p.id} initial={initial} steps={steps} />
      <ScoreTimeline runs={history} />
    </div>
  );
}
