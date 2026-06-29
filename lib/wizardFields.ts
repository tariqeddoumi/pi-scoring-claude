// Métadonnées des champs du wizard de scoring (type + options).

export type FieldType = "number" | "select" | "bool";
export interface FieldDef {
  key: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  step?: string;
}

const sel = (key: string, opts: [string, string][]): FieldDef => ({
  key, type: "select", options: opts.map(([value, label]) => ({ value, label })),
});

// Étapes du wizard pour les ACTIFS D'EXPLOITATION (hôtels / immobilier de rapport).
export const EXPLOITATION_WIZARD_STEPS: { id: string; title: string; fields: FieldDef[] }[] = [
  {
    id: "exploitation", title: "Performance & occupation",
    fields: [
      { key: "occupancy_rate", type: "number" },
      sel("lease_indexation", [["none", "Non indexés"], ["partial", "Partiellement indexés"], ["full", "Pleinement indexés"]]),
      sel("revenue_stability", [["volatile", "Volatile"], ["moderate", "Modérée"], ["stable", "Stable"]]),
      sel("seasonality", [["high", "Forte"], ["moderate", "Modérée"], ["low", "Faible"]]),
    ],
  },
  {
    id: "dette", title: "Couverture de la dette",
    fields: [
      { key: "dscr", type: "number", step: "0.01" },
      { key: "debt_yield", type: "number", step: "0.1" },
      { key: "interest_coverage", type: "number", step: "0.1" },
    ],
  },
  {
    id: "locataires", title: "Locataires & opérateur",
    fields: [
      { key: "walt_years", type: "number", step: "0.1" },
      sel("tenant_quality", [["weak", "Faible"], ["standard", "Standard"], ["strong", "Solide (grands comptes)"]]),
      sel("operator_quality", [["independent", "Indépendant"], ["regional", "Régional"], ["international", "International"]]),
    ],
  },
  {
    id: "actif", title: "Actif & marché",
    fields: [
      { key: "ltv_stabilized", type: "number", step: "0.1" },
      sel("asset_quality", [["poor", "Médiocre"], ["standard", "Standard"], ["prime", "Prime"]]),
      sel("location_demand", [["weak", "Faible"], ["moderate", "Modérée"], ["strong", "Forte"]]),
      sel("refinancing_risk", [["high", "Élevé"], ["moderate", "Modéré"], ["low", "Faible"]]),
    ],
  },
  {
    id: "reglementaire", title: "Déclencheurs réglementaires",
    fields: [
      { key: "dpd_days", type: "number" },
      sel("restructured", [["no", "Non"], ["yes", "Oui"]]),
      sel("legal_exposure", [["clear", "Sain"], ["watch", "Surveillance"], ["litigation", "Contentieux"]]),
    ],
  },
];

export const WIZARD_STEPS: { id: string; title: string; fields: FieldDef[] }[] = [
  {
    id: "promoteur", title: "Promoteur & Gouvernance",
    fields: [
      { key: "promoter_completed_projects", type: "number" },
      { key: "promoter_gearing", type: "number", step: "0.1" },
      sel("governance_quality", [["opaque", "Opaque"], ["partielle", "Partielle"], ["claire", "Claire"]]),
      { key: "mono_project_concentration", type: "number" },
      sel("promoter_type", [["opportuniste", "Opportuniste"], ["regional", "Régional"], ["structure", "Structuré"]]),
      { key: "equity_injected_ratio", type: "number" },
    ],
  },
  {
    id: "projet", title: "Qualité du projet (Foncier / Autorisations)",
    fields: [
      sel("land_permits_status", [["absentes", "Absentes"], ["partielles", "Partielles"], ["definitives", "Définitives"]]),
      sel("market_positioning", [["sur_positionne", "Sur-positionné"], ["moyen", "Correct"], ["aligne", "Aligné"]]),
      sel("technical_complexity", [["elevee", "Élevée"], ["moyenne", "Moyenne"], ["standard", "Standard"]]),
      { key: "progress_vs_plan", type: "number" },
      sel("sav_litigation", [["eleve", "Élevé"], ["moyen", "Moyen"], ["faible", "Faible"]]),
      sel("macro_sensitivity", [["elevee", "Élevée"], ["moyenne", "Moyenne"], ["faible", "Faible"]]),
      { key: "land_cost_ratio", type: "number" },
    ],
  },
  {
    id: "commercial", title: "Commercialisation & Cash-flow",
    fields: [
      { key: "pre_sale_rate", type: "number" },
      { key: "sales_vs_plan", type: "number" },
      { key: "dso_days", type: "number" },
      { key: "cash_coverage", type: "number", step: "0.01" },
      { key: "funding_gap_pct", type: "number", step: "0.1" },
      { key: "stock_rotation_months", type: "number" },
      { key: "stressed_margin_pct", type: "number", step: "0.1" },
      { key: "funding_gap_persistent", type: "bool" },
    ],
  },
  {
    id: "financement", title: "Structuration financière & LGD",
    fields: [
      { key: "gross_margin_pct", type: "number", step: "0.1" },
      { key: "ltc", type: "number" },
      { key: "ltv_stressed", type: "number" },
      { key: "guarantee_coverage", type: "number" },
      sel("first_rank", [["oui", "1er rang"], ["non", "Non 1er rang"]]),
      { key: "interest_coverage", type: "number", step: "0.1" },
      { key: "equity_negative", type: "bool" },
    ],
  },
  {
    id: "regulatoire", title: "Vulnérabilité réglementaire BAM",
    fields: [
      { key: "dpd_days", type: "number" },
      { key: "construction_delay_months", type: "number" },
      { key: "project_stopped_months", type: "number" },
      sel("restructured", [["no", "Non"], ["yes", "Oui"]]),
      { key: "restructuring_count", type: "number" },
      { key: "restructuring_deferral_months", type: "number" },
      sel("legal_exposure", [["clear", "Aucune"], ["watch", "Sous surveillance"], ["litigation", "Contentieux"]]),
      { key: "commercialization_below_50_1y", type: "bool" },
      { key: "construction_delay_over_1y", type: "bool" },
      { key: "project_stopped_over_1y", type: "bool" },
      { key: "finished_2y_no_sales", type: "bool" },
      { key: "judicial_recovery", type: "bool" },
      { key: "debt_equity_ratio", type: "number", step: "0.1" },
      { key: "revenue_drop_pct", type: "number" },
    ],
  },
];
