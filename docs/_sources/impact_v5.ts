// Simulation d'impact v4 → v5 sur les projets PROMOTION de la base (données extraites le 1er octobre 2026).
// Usage (racine du dépôt) : npx tsx docs/_sources/impact_v5.ts > docs/_sources/impact_v5.json
import { runScoring } from "@/server/engines/scoringEngine";
import { PROMOTION_SCORING_MODEL_V4 } from "@/lib/domain/models/piPromotionV4";
import { PROMOTION_SCORING_MODEL_V5 } from "@/lib/domain/models/piPromotionV5";
import type { ProjectInputs, RegulatoryClassCode } from "@/lib/domain/types";

const demo: ProjectInputs = {
  promoter_completed_projects: 6, promoter_gearing: 95, governance_quality: "claire", mono_project_concentration: 40, promoter_type: "structure",
  equity_injected_ratio: 95, land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard", progress_vs_plan: 95,
  sav_litigation: "faible", macro_sensitivity: "moyenne", land_cost_ratio: 24, pre_sale_rate: 55, sales_vs_plan: 95, dso_days: 100, cash_coverage: 1.25,
  funding_gap_pct: 0, stock_rotation_months: 18, stressed_margin_pct: 16, gross_margin_pct: 25, ltc: 65, ltv_stressed: 70, guarantee_coverage: 115,
  first_rank: "oui", interest_coverage: 2.8, dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
  commercialization_below_50_1y: false, construction_delay_over_1y: false,
};
type P = { ref: string; name: string; segment: string; zone: string; region: string; cls: RegulatoryClassCode; blocksGo: boolean; isDefault: boolean; dq: string | null; inputs: ProjectInputs };
const projects: P[] = [
  { ref: "PI-2026-001", name: "Résidence Les Jardins de l'Atlas", segment: "moyen_haut", zone: "casa_centre", region: "casablanca_settat", cls: "SAIN", blocksGo: false, isDefault: false, dq: null, inputs: {
    promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire", mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
    land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard", progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible",
    land_cost_ratio: 22, pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0, stock_rotation_months: 16, stressed_margin_pct: 18,
    gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2, dpd_days: 0, construction_delay_months: 0,
    project_stopped_months: 0, restructured: "no", legal_exposure: "clear" } },
  { ref: "PI-2026-002", name: "Résidence Annour", segment: "intermediaire", zone: "marrakech", region: "marrakech_safi", cls: "PRE_DOUTEUX", blocksGo: false, isDefault: true, dq: null, inputs: {
    promoter_completed_projects: 1, promoter_gearing: 160, governance_quality: "partielle", mono_project_concentration: 70, promoter_type: "opportuniste", equity_injected_ratio: 70,
    land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne", progress_vs_plan: 75, sav_litigation: "moyen", macro_sensitivity: "elevee",
    land_cost_ratio: 32, pre_sale_rate: 18, sales_vs_plan: 70, dso_days: 260, cash_coverage: 0.85, funding_gap_pct: 15, stock_rotation_months: 32, stressed_margin_pct: 9,
    gross_margin_pct: 13, ltc: 84, ltv_stressed: 88, guarantee_coverage: 60, first_rank: "non", interest_coverage: 1.2, dpd_days: 110, construction_delay_months: 8,
    project_stopped_months: 0, restructured: "yes", restructuring_count: 1, restructuring_deferral_months: 12, legal_exposure: "watch", funding_gap_persistent: true,
    commercialization_below_50_1y: true, construction_delay_over_1y: false } },
  { ref: "PI-2026-101", name: "Tranche Verdure", segment: "moyen_haut", zone: "casa_centre", region: "casablanca_settat", cls: "SAIN", blocksGo: false, isDefault: false, dq: "INCOMPLETE", inputs: demo },
  { ref: "PI-2026-102", name: "Les Oliviers", segment: "intermediaire", zone: "rabat_centre", region: "marrakech_safi", cls: "PRE_DOUTEUX", blocksGo: false, isDefault: true, dq: "INCOMPLETE", inputs: { ...demo, dpd_days: 120 } },
  { ref: "PI-2026-104", name: "Riad El Fath", segment: "intermediaire", zone: "marrakech", region: "marrakech_safi", cls: "SENSIBLE", blocksGo: false, isDefault: false, dq: "INCOMPLETE", inputs: { ...demo, commercialization_below_50_1y: true } },
  { ref: "PI-2026-105", name: "Cèdres Business", segment: "bureaux", zone: "fes_oriental", region: "fes_meknes", cls: "SAIN", blocksGo: false, isDefault: false, dq: "INCOMPLETE", inputs: demo },
  { ref: "PI-2026-106", name: "Ocean View", segment: "moyen_haut", zone: "tanger", region: "tanger_tetouan_al_hoceima", cls: "SENSIBLE", blocksGo: false, isDefault: false, dq: "INCOMPLETE", inputs: { ...demo, commercialization_below_50_1y: true } },
  { ref: "PI-2026-108", name: "Médina Lofts", segment: "villas", zone: "marrakech", region: "marrakech_safi", cls: "CTX", blocksGo: true, isDefault: true, dq: "INCOMPLETE", inputs: { ...demo, dpd_days: 200, legal_exposure: "litigation" } },
  { ref: "PI-2026-109", name: "Green Valley", segment: "intermediaire", zone: "rabat_peripherie", region: "rabat_sale_kenitra", cls: "SAIN", blocksGo: false, isDefault: false, dq: "INCOMPLETE", inputs: demo },
  { ref: "PI-2026-110", name: "Zénith Towers", segment: "moyen_haut", zone: "casa_centre", region: "casablanca_settat", cls: "SENSIBLE", blocksGo: false, isDefault: false, dq: "INCOMPLETE", inputs: { ...demo, commercialization_below_50_1y: true } },
];

// Scénario « données v5 renseignées, situation saine » : ce que le chargé d'affaires saisit
// pour un programme sans difficulté particulière (programme entier, marché équilibré,
// entreprise qualifiée, aucun équipement exigé, tirages en phase, pas de dépassement).
const v5Neutral: ProjectInputs = {
  regional_market_tension: "equilibre", contractor_quality: "qualifiee", equipment_unbudgeted_pct: 0, tranche_dependency: "programme_entier",
  slow_liquidity_share_pct: 0, cancellation_rate_pct: 5, drawdown_vs_progress_pct: 100, cost_overrun_pct: 2,
  drawdown_ahead_of_works: false, drawdown_schedule_late: false, equipment_delivery_at_risk: false, component_exit_unsecured: false,
};

const run = (model: typeof PROMOTION_SCORING_MODEL_V4, p: P, inputs: ProjectInputs) => runScoring({
  model, inputs, segment: p.segment, zone: p.zone, regulatoryClass: p.cls, classBlocksGo: p.blocksGo, isDefault: p.isDefault,
  dataQualityBlocking: p.dq === "INCOMPLETE_BLOCKING", extraCriticalKeys: ["dpd_days"],
});

const rows = projects.map((p) => {
  const a = run(PROMOTION_SCORING_MODEL_V4, p, p.inputs);
  const b = run(PROMOTION_SCORING_MODEL_V5, p, p.inputs);
  const c = run(PROMOTION_SCORING_MODEL_V5, p, { ...p.inputs, ...v5Neutral });
  return {
    ref: p.ref, name: p.name, region: p.region, cls: p.cls,
    v4: { score: a.scoreFinal, decision: a.decision, technique: a.scoreTechnique, incomplete: a.dataIncomplete },
    v5_brut: { score: b.scoreFinal, decision: b.decision, technique: b.scoreTechnique },
    v5_renseigne: { score: c.scoreFinal, decision: c.decision, technique: c.scoreTechnique },
  };
});
console.log(JSON.stringify(rows, null, 1));
