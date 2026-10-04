// Liste des projets (lignes de la page /projects et de son export) : une seule
// source, pour que le fichier exporté contienne exactement ce qui est affiché.

import { getProjectsWithLatestRun, getRescoringQueue } from "@/server/queries";
import type { ProjectRow } from "@/lib/projectFilters";

export async function loadProjectRows(): Promise<ProjectRow[]> {
  const [projects, rescoring] = await Promise.all([
    getProjectsWithLatestRun(),
    // Le calcul de fraîcheur ne doit pas empêcher l'affichage de la liste.
    getRescoringQueue().catch(() => null),
  ]);
  const stale = new Set(rescoring ? rescoring.items.map((i) => i.id) : []);
  return projects.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    promoter: p.promoter.name,
    city: p.city,
    segment: p.segment,
    loanAmount: p.loanAmount,
    score: p.scoringRuns[0]?.scoreFinal ?? null,
    decision: p.scoringRuns[0]?.decision ?? null,
    regulatoryClass: p.classificationRuns[0]?.resultClass ?? null,
    state: p.workflowSteps[0]?.toState ?? "DRAFT",
    updatedAt: p.updatedAt,
    needsRescoring: stale.has(p.id),
  }));
}
