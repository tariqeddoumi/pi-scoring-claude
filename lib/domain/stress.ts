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

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Marge après choc, par IDENTITÉ COMPTABLE (diagnostic F08) et non par ajout de
 * points. Marge m = (CA − coût)/CA = 1 − coût/CA. Un facteur `caFactor` sur le
 * CA et `coutFactor` sur le coût donnent : m' = 1 − (1 − m)·coutFactor/caFactor.
 * Les marges négatives sont CONSERVÉES (pas de plancher à 0 qui masquerait la
 * profondeur de la perte).
 */
function stressMargin(m: number, caFactor: number, coutFactor: number): number {
  const frac = 1 - (1 - m / 100) * (coutFactor / caFactor);
  return round2(frac * 100);
}

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

  // --- Prix −X% : identités comptables (F08) ---
  // CA × (1−p) → marges recalculées ; valeur de sûreté × (1−p) → LTV = dette/valeur
  // donc LTV' = LTV/(1−p) ; encaissements sécurisés fragilisés (heuristique bornée).
  const priceDrop = Math.max(0, s.priceDrop ?? 0);
  if (priceDrop > 0) {
    const caFactor = 1 - priceDrop / 100;
    if (typeof out.gross_margin_pct === "number") out.gross_margin_pct = stressMargin(out.gross_margin_pct, caFactor, 1);
    if (typeof out.stressed_margin_pct === "number") out.stressed_margin_pct = stressMargin(out.stressed_margin_pct, caFactor, 1);
    if (typeof out.ltv_stressed === "number" && caFactor > 0) out.ltv_stressed = round2((out.ltv_stressed as number) / caFactor);
    dec("pre_sale_rate", priceDrop * 0.5);
  }

  // --- Coût +X% : identités comptables (F08) ---
  // coût × (1+c) → marges recalculées ; la banque finançant le surcoût :
  // dette' = dette + c·coût, coût' = coût·(1+c) ⇒ LTC' = (LTC + c)/(1+c).
  const costOverrun = Math.max(0, s.costOverrun ?? 0);
  if (costOverrun > 0) {
    const coutFactor = 1 + costOverrun / 100;
    if (typeof out.gross_margin_pct === "number") out.gross_margin_pct = stressMargin(out.gross_margin_pct, 1, coutFactor);
    if (typeof out.stressed_margin_pct === "number") out.stressed_margin_pct = stressMargin(out.stressed_margin_pct, 1, coutFactor);
    if (typeof out.ltc === "number") out.ltc = round2(((out.ltc as number) + costOverrun) / coutFactor);
    inc("funding_gap_pct", costOverrun);
  }

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
