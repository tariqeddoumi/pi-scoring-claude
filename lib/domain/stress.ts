// =====================================================================
//  stress.ts — Chocs de stress appliqués aux entrées d'un dossier avant
//  re-scoring. Au-delà des deux leviers de base (préventes, impayés), une
//  batterie de scénarios structurés (§9.1 du diagnostic) : prix −10/−15 %,
//  coût +10 %, retard +6 mois, ventes −20 %, taux +200 bps, et un scénario
//  sévère combiné. Le re-calcul classe/score/pertes utilise les MÊMES moteurs
//  que l'application. Logique pure, déterministe et testable.
//  Toutes les transmissions sont monotones (un choc ne peut qu'aggraver) et
//  bornées ; les coefficients sont indicatifs et à calibrer.
// =====================================================================

import type { ProjectInputs } from "@/lib/domain/types";

export interface StressShock {
  preSaleDrop: number; // points de % retranchés au taux de prévente
  dpdAdd: number; // jours ajoutés au retard de paiement
  // --- Batterie structurée (optionnels, 0 par défaut) ---
  priceDrop?: number; // baisse de prix (points) → marges ↓, LTV ↑
  costOverrun?: number; // dépassement de coût (points) → marges ↓, LTC/impasse ↑
  delayMonths?: number; // retard chantier (mois) → avancement/ventes ↓
  salesDrop?: number; // baisse des ventes (points) → ventes/préventes ↓, rotation ↑
  rateAddBps?: number; // hausse de taux (points de base) → couvertures ↓
}

export const NO_SHOCK: StressShock = { preSaleDrop: 0, dpdAdd: 0 };

// Batterie de scénarios standard (diagnostic §9.1).
export const STRESS_SCENARIOS: { key: string; label: string; shock: StressShock }[] = [
  { key: "price10", label: "Prix −10 %", shock: { ...NO_SHOCK, priceDrop: 10 } },
  { key: "price15", label: "Prix −15 %", shock: { ...NO_SHOCK, priceDrop: 15 } },
  { key: "cost10", label: "Coût +10 %", shock: { ...NO_SHOCK, costOverrun: 10 } },
  { key: "delay6", label: "Retard +6 mois", shock: { ...NO_SHOCK, delayMonths: 6 } },
  { key: "sales20", label: "Ventes −20 %", shock: { ...NO_SHOCK, salesDrop: 20 } },
  { key: "rate200", label: "Taux +200 bps", shock: { ...NO_SHOCK, rateAddBps: 200 } },
  { key: "severe", label: "Sévère combiné", shock: { preSaleDrop: 0, dpdAdd: 0, priceDrop: 15, costOverrun: 10, delayMonths: 6, salesDrop: 20, rateAddBps: 200 } },
];

/** Applique le choc aux entrées (clone, ne mute pas l'original). */
export function applyStress(inputs: ProjectInputs, s: StressShock): ProjectInputs {
  const out: ProjectInputs = { ...inputs };
  const dec = (key: string, amount: number, floor = 0) => {
    if (amount > 0 && typeof out[key] === "number") out[key] = Math.max(floor, (out[key] as number) - amount);
  };
  const inc = (key: string, amount: number) => {
    if (amount > 0 && typeof out[key] === "number") out[key] = (out[key] as number) + amount;
  };

  // --- Leviers de base ---
  dec("pre_sale_rate", Math.max(0, s.preSaleDrop));
  const baseDpd = typeof out.dpd_days === "number" ? out.dpd_days : 0;
  out.dpd_days = Math.max(0, baseDpd + Math.max(0, s.dpdAdd));
  if (s.preSaleDrop > 0) dec("sales_vs_plan", s.preSaleDrop);

  // --- Prix −X% : marges ↓ (points), LTV stressée ↑, encaissements ↓ ---
  const priceDrop = Math.max(0, s.priceDrop ?? 0);
  dec("gross_margin_pct", priceDrop);
  dec("stressed_margin_pct", priceDrop);
  inc("ltv_stressed", priceDrop);
  dec("pre_sale_rate", priceDrop * 0.5);

  // --- Coût +X% : marges ↓, LTC ↑, impasse de trésorerie ↑ ---
  const costOverrun = Math.max(0, s.costOverrun ?? 0);
  dec("gross_margin_pct", costOverrun);
  dec("stressed_margin_pct", costOverrun);
  inc("ltc", costOverrun);
  inc("funding_gap_pct", costOverrun);

  // --- Retard +N mois : avancement ↓, ventes ↓, déclencheur > 1 an ---
  const delayMonths = Math.max(0, s.delayMonths ?? 0);
  if (delayMonths > 0) {
    inc("construction_delay_months", delayMonths);
    dec("progress_vs_plan", delayMonths * 3);
    dec("sales_vs_plan", delayMonths * 2);
    if (typeof out.construction_delay_months === "number" && out.construction_delay_months >= 12) {
      out.construction_delay_over_1y = true;
    }
  }

  // --- Ventes −X% : ventes/préventes ↓, rotation de stock ↑ ---
  const salesDrop = Math.max(0, s.salesDrop ?? 0);
  dec("sales_vs_plan", salesDrop);
  dec("pre_sale_rate", salesDrop * 0.6);
  inc("stock_rotation_months", salesDrop * 0.3);

  // --- Taux +N bps : couverture d'intérêts et cash coverage ↓ ---
  const rateAddBps = Math.max(0, s.rateAddBps ?? 0);
  if (rateAddBps > 0) {
    dec("interest_coverage", (rateAddBps / 100) * 0.3);
    dec("cash_coverage", (rateAddBps / 100) * 0.05);
  }

  return out;
}
