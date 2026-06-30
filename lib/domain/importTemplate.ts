// =====================================================================
//  importTemplate.ts — Définition PURE du modèle de fichier d'import
//  (portefeuille de projets de promotion). Décrit, par domaine, les
//  colonnes attendues par le parseur d'import (server/actions/imports.ts),
//  leurs valeurs autorisées et une ligne d'exemple cohérente. Aucune IO :
//  la route API consomme `buildTemplateAoa()` puis l'encode en .xlsx.
//
//  Invariant (testé) : tout en-tête de colonne d'entrée correspond à une
//  clé reconnue par l'import (INPUT_LABELS), et la ligne d'exemple passe
//  le mapping sans erreur. Le modèle reste ainsi synchronisé back/front.
// =====================================================================

import { INPUT_LABELS } from "@/lib/inputLabels";

export interface TemplateColumn {
  /** En-tête exact attendu dans le fichier (alias projet ou clé d'entrée). */
  header: string;
  /** Domaine / regroupement (pour le dictionnaire). */
  group: string;
  /** Libellé FR lisible. */
  label: string;
  /** Valeurs ou format attendus (ex. « oui / non », « % », « claire | partielle »). */
  allowed: string;
  /** Valeur d'exemple (ligne 2 de la feuille « Projets »). */
  example: string | number;
}

// Métadonnées de format des clés d'entrée : booléen (oui/non), liste de
// modalités, ou numérique avec unité. Source unique de vérité pour le
// dictionnaire généré (cohérent avec le moteur de scoring).
type FieldMeta = { kind: "bool" } | { kind: "select"; values: string[] } | { kind: "num"; unit?: string };

const FIELD_META: Record<string, FieldMeta> = {
  // D1 — Sponsor & gouvernance
  promoter_completed_projects: { kind: "num", unit: "nombre" },
  promoter_gearing: { kind: "num", unit: "%" },
  governance_quality: { kind: "select", values: ["opaque", "partielle", "claire"] },
  mono_project_concentration: { kind: "num", unit: "%" },
  promoter_type: { kind: "select", values: ["opportuniste", "regional", "structure"] },
  equity_injected_ratio: { kind: "num", unit: "%" },
  // D2 — Qualité du projet
  land_permits_status: { kind: "select", values: ["absentes", "partielles", "definitives"] },
  market_positioning: { kind: "select", values: ["sur_positionne", "moyen", "aligne"] },
  technical_complexity: { kind: "select", values: ["elevee", "moyenne", "standard"] },
  sav_litigation: { kind: "select", values: ["eleve", "moyen", "faible"] },
  macro_sensitivity: { kind: "select", values: ["elevee", "faible"] },
  progress_vs_plan: { kind: "num", unit: "%" },
  land_cost_ratio: { kind: "num", unit: "%" },
  // D3 — Commercial & cash-flow
  pre_sale_rate: { kind: "num", unit: "%" },
  sales_vs_plan: { kind: "num", unit: "%" },
  dso_days: { kind: "num", unit: "jours" },
  cash_coverage: { kind: "num", unit: "x" },
  funding_gap_pct: { kind: "num", unit: "%" },
  stock_rotation_months: { kind: "num", unit: "mois" },
  stressed_margin_pct: { kind: "num", unit: "%" },
  funding_gap_persistent: { kind: "bool" },
  // D4 — Structuration financière & LGD
  gross_margin_pct: { kind: "num", unit: "%" },
  ltc: { kind: "num", unit: "%" },
  ltv_stressed: { kind: "num", unit: "%" },
  guarantee_coverage: { kind: "num", unit: "%" },
  first_rank: { kind: "select", values: ["oui", "non"] },
  interest_coverage: { kind: "num", unit: "x" },
  equity_negative: { kind: "bool" },
  // D5 / Réglementaire (1/W)
  construction_delay_months: { kind: "num", unit: "mois" },
  admin_problems_over_1y: { kind: "bool" },
  construction_delay_over_1y: { kind: "bool" },
  commercialization_below_50_1y: { kind: "bool" },
  finished_2y_no_sales: { kind: "bool" },
  project_stopped_months: { kind: "num", unit: "mois" },
  project_stopped_over_1y: { kind: "bool" },
  dpd_days: { kind: "num", unit: "jours" },
  judicial_recovery: { kind: "bool" },
  legal_exposure: { kind: "select", values: ["clear", "watch", "litigation"] },
  debt_equity_ratio: { kind: "num", unit: "x" },
  revenue_drop_pct: { kind: "num", unit: "%" },
  seizure_notice: { kind: "bool" },
  financials_late_7m: { kind: "bool" },
  negative_credit_bureau: { kind: "bool" },
  bp_significant_gap: { kind: "bool" },
  financials_unavailable: { kind: "bool" },
  // Restructuration (art.17-31)
  restructured: { kind: "select", values: ["no", "yes"] },
  restructuring_count: { kind: "num", unit: "nombre" },
  restructuring_deferral_months: { kind: "num", unit: "mois" },
  restructuring_viable: { kind: "bool" },
  second_restructuring_in_observation: { kind: "bool" },
  dpd_on_restructured: { kind: "num", unit: "jours" },
};

// Valeur d'exemple par clé d'entrée : un projet « GO » sain et cohérent,
// utile comme gabarit et pour la démonstration du scoring post-import.
const EXAMPLE: Record<string, string | number> = {
  promoter_completed_projects: 4, promoter_gearing: 90, governance_quality: "claire",
  mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
  land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard",
  sav_litigation: "faible", macro_sensitivity: "faible", progress_vs_plan: 100, land_cost_ratio: 22,
  pre_sale_rate: 45, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.4, funding_gap_pct: 0,
  stock_rotation_months: 15, stressed_margin_pct: 18, funding_gap_persistent: "non",
  gross_margin_pct: 28, ltc: 55, ltv_stressed: 65, guarantee_coverage: 130, first_rank: "oui",
  interest_coverage: 3.5, equity_negative: "non",
  construction_delay_months: 0, admin_problems_over_1y: "non", construction_delay_over_1y: "non",
  commercialization_below_50_1y: "non", finished_2y_no_sales: "non", project_stopped_months: 0,
  project_stopped_over_1y: "non", dpd_days: 0, judicial_recovery: "non", legal_exposure: "clear",
  debt_equity_ratio: 1.5, revenue_drop_pct: 0, seizure_notice: "non", financials_late_7m: "non",
  negative_credit_bureau: "non", bp_significant_gap: "non", financials_unavailable: "non",
  restructured: "no", restructuring_count: 0, restructuring_deferral_months: 0,
  restructuring_viable: "oui", second_restructuring_in_observation: "non", dpd_on_restructured: 0,
};

// Ordre d'affichage des colonnes d'entrée, regroupées par domaine du modèle.
const INPUT_GROUPS: { group: string; keys: string[] }[] = [
  { group: "D1 · Sponsor & gouvernance", keys: ["promoter_completed_projects", "promoter_gearing", "governance_quality", "mono_project_concentration", "promoter_type", "equity_injected_ratio"] },
  { group: "D2 · Qualité du projet", keys: ["land_permits_status", "market_positioning", "technical_complexity", "sav_litigation", "macro_sensitivity", "progress_vs_plan", "land_cost_ratio"] },
  { group: "D3 · Commercial & cash-flow", keys: ["pre_sale_rate", "sales_vs_plan", "dso_days", "cash_coverage", "funding_gap_pct", "stock_rotation_months", "stressed_margin_pct", "funding_gap_persistent"] },
  { group: "D4 · Structuration financière & LGD", keys: ["gross_margin_pct", "ltc", "ltv_stressed", "guarantee_coverage", "first_rank", "interest_coverage", "equity_negative"] },
  { group: "D5 · Vulnérabilité réglementaire (1/W)", keys: ["construction_delay_months", "admin_problems_over_1y", "construction_delay_over_1y", "commercialization_below_50_1y", "finished_2y_no_sales", "project_stopped_months", "project_stopped_over_1y", "dpd_days", "judicial_recovery", "legal_exposure", "debt_equity_ratio", "revenue_drop_pct", "seizure_notice", "financials_late_7m", "negative_credit_bureau", "bp_significant_gap", "financials_unavailable"] },
  { group: "Restructuration (art.17-31)", keys: ["restructured", "restructuring_count", "restructuring_deferral_months", "restructuring_viable", "second_restructuring_in_observation", "dpd_on_restructured"] },
];

// Colonnes d'identification du projet (en-têtes = alias reconnus par le mapping).
const META_COLUMNS: TemplateColumn[] = [
  { header: "Référence", group: "Identification", label: "Référence unique du projet", allowed: "texte (obligatoire, clé d'upsert)", example: "PI-2026-001" },
  { header: "Nom du projet", group: "Identification", label: "Nom du projet", allowed: "texte (obligatoire)", example: "Résidence Al Manar" },
  { header: "Promoteur", group: "Identification", label: "Nom du promoteur", allowed: "texte (obligatoire)", example: "Promoteur Exemple SARL" },
  { header: "Ville", group: "Identification", label: "Ville", allowed: "texte", example: "Casablanca" },
  { header: "Région", group: "Identification", label: "Région", allowed: "texte", example: "Casablanca-Settat" },
  { header: "Type de projet", group: "Identification", label: "Type de projet", allowed: "texte", example: "residentiel" },
  { header: "Segment", group: "Identification", label: "Segment (ajustement modèle)", allowed: "social | intermediaire | moyen_haut | touristique | bureaux | commerces | villas", example: "moyen_haut" },
  { header: "Zone", group: "Identification", label: "Zone (ajustement modèle)", allowed: "casa_centre | casa_peripherie | rabat_centre | … | regions_interieures", example: "casa_centre" },
  { header: "Crédit", group: "Identification", label: "Montant du crédit (MAD)", allowed: "nombre", example: 120_000_000 },
  { header: "Coût total", group: "Identification", label: "Coût total du programme (MAD)", allowed: "nombre", example: 180_000_000 },
  { header: "Fonds propres", group: "Identification", label: "Fonds propres / apport (MAD)", allowed: "nombre", example: 60_000_000 },
];

function allowedText(meta: FieldMeta | undefined): string {
  if (!meta) return "texte";
  if (meta.kind === "bool") return "oui / non";
  if (meta.kind === "select") return meta.values.join(" | ");
  return meta.unit ? `nombre (${meta.unit})` : "nombre";
}

/** Liste ordonnée et complète des colonnes du modèle (identification + entrées). */
export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  ...META_COLUMNS,
  ...INPUT_GROUPS.flatMap(({ group, keys }) =>
    keys.map((key): TemplateColumn => ({
      header: key,
      group,
      label: INPUT_LABELS[key] ?? key,
      allowed: allowedText(FIELD_META[key]),
      example: EXAMPLE[key] ?? "",
    })),
  ),
];

/**
 * Construit les deux feuilles du classeur modèle sous forme de tableaux de
 * tableaux (AoA), prêtes à être encodées en .xlsx :
 *  - « Projets » : ligne d'en-têtes + 1 ligne d'exemple (projet GO).
 *  - « Dictionnaire » : colonne, domaine, libellé, valeurs attendues, exemple.
 */
export function buildTemplateAoa(): {
  projets: (string | number)[][];
  dictionnaire: (string | number)[][];
} {
  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const exampleRow = TEMPLATE_COLUMNS.map((c) => c.example);
  const dictionnaire: (string | number)[][] = [
    ["Colonne", "Domaine", "Libellé", "Valeurs attendues", "Exemple"],
    ...TEMPLATE_COLUMNS.map((c) => [c.header, c.group, c.label, c.allowed, c.example]),
  ];
  return { projets: [headers, exampleRow], dictionnaire };
}
