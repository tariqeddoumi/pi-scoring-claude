// =====================================================================
//  program.ts — Consolidation d'un programme immobilier multi-composantes.
//  Un grand programme (logements, villas, hôtel, commerces…) est décomposé en
//  composantes scorées séparément ; la note consolidée est la moyenne des
//  scores PROMOTION pondérée par l'exposition. Les actifs d'EXPLOITATION
//  (hôtel…) sont exclus de cette note (modèle promotion inadapté) mais comptés
//  dans l'exposition et le risque consolidés. Logique pure et testable.
// =====================================================================

import type { RegulatoryClassCode } from "@/lib/domain/types";
import { mostSevereClass } from "@/lib/domain/groups";

const round2 = (v: number) => Math.round(v * 100) / 100;

export type AssetTypeCode = "PROMOTION" | "EXPLOITATION";

export interface ProgramComponent {
  scoreFinal: number | null;
  exposure: number;
  assetType: AssetTypeCode;
  cls?: RegulatoryClassCode | null;
}

export interface ProgramConsolidation {
  /** Note pondérée par exposition sur les composantes PROMOTION scorées (null si aucune). */
  weightedScore: number | null;
  totalExposure: number;
  promotionExposure: number; // exposition des composantes promotion
  operationalExposure: number; // exposition des actifs d'exploitation (hors note)
  scoredExposure: number; // promotion effectivement scorée
  components: number;
  operationalComponents: number;
  worstClass: RegulatoryClassCode | undefined;
}

export function consolidateProgram(components: ProgramComponent[]): ProgramConsolidation {
  let totalExposure = 0;
  let promotionExposure = 0;
  let operationalExposure = 0;
  let scoredExposure = 0;
  let weightedSum = 0;
  let operationalComponents = 0;

  for (const c of components) {
    const exp = Math.max(0, c.exposure);
    totalExposure += exp;
    if (c.assetType === "EXPLOITATION") {
      operationalExposure += exp;
      operationalComponents += 1;
      continue; // exclu de la note promotion
    }
    promotionExposure += exp;
    if (c.scoreFinal != null && exp > 0) {
      scoredExposure += exp;
      weightedSum += c.scoreFinal * exp;
    }
  }

  return {
    weightedScore: scoredExposure > 0 ? round2(weightedSum / scoredExposure) : null,
    totalExposure: round2(totalExposure),
    promotionExposure: round2(promotionExposure),
    operationalExposure: round2(operationalExposure),
    scoredExposure: round2(scoredExposure),
    components: components.length,
    operationalComponents,
    worstClass: mostSevereClass(components.map((c) => c.cls)),
  };
}
