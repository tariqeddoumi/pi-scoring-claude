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
      sel("macro_sensitivity", [["elevee", "Élevée"], ["faible", "Faible"]]),
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
