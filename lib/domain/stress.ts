// =====================================================================
//  stress.ts — Choc de stress appliqué aux entrées d'un dossier avant
//  re-scoring. Deux leviers simples et parlants pour un démarrage :
//    - baisse des préventes (points de % retranchés à pre_sale_rate) ;
//    - hausse des impayés (jours ajoutés à dpd_days).
//  Le re-calcul de la classe/score/pertes se fait avec les MÊMES moteurs
//  que l'application. Logique pure et testable.
// =====================================================================

import type { ProjectInputs } from "@/lib/domain/types";

export interface StressShock {
  preSaleDrop: number; // points de % retranchés au taux de prévente
  dpdAdd: number; // jours ajoutés au retard de paiement
}

export const NO_SHOCK: StressShock = { preSaleDrop: 0, dpdAdd: 0 };

/** Applique le choc aux entrées (clone, ne mute pas l'original). */
export function applyStress(inputs: ProjectInputs, s: StressShock): ProjectInputs {
  const out: ProjectInputs = { ...inputs };
  if (typeof out.pre_sale_rate === "number") {
    out.pre_sale_rate = Math.max(0, out.pre_sale_rate - Math.max(0, s.preSaleDrop));
  }
  const baseDpd = typeof out.dpd_days === "number" ? out.dpd_days : 0;
  out.dpd_days = Math.max(0, baseDpd + Math.max(0, s.dpdAdd));
  // Un repli des préventes dégrade aussi la dynamique commerciale.
  if (typeof out.sales_vs_plan === "number" && s.preSaleDrop > 0) {
    out.sales_vs_plan = Math.max(0, out.sales_vs_plan - s.preSaleDrop);
  }
  return out;
}
