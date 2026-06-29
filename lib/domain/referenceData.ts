// =====================================================================
//  referenceData.ts — Données de référence métier (paramétrables)
//  Seed initial : modèle de scoring Promotion Immobilière V1.0
//  (D1..D4 pondérés + D5 malus, échelle KPI 0..5, ajustements segment/zone)
//  et régimes réglementaires BKAM 19/G/2002 & 1/W/2025 (classes, triggers
//  immobiliers, restructuration, provisions, garanties).
//  Aucune règle n'est codée en dur dans les moteurs : tout vient d'ici puis
//  de la base (administrable via Model Builder / Admin régime).
// =====================================================================

import type {
  GuaranteeTypeConfig,
  RegulatoryRegimeConfig,
  ScoringModelConfig,
} from "./types";

// ---------------------------------------------------------------------
//  MODELE DE SCORING PROMOTION IMMOBILIERE V2.0 — échelle critère 1..10
//  Notes critère sur 1..10 (barèmes 1 / 6 / 10), agrégées en score domaine
//  0..100, puis score interne 0..100. Pondérations de domaines normalisées
//  à 100% (D1..D4) ; D5 reste une couche d'alertes (malus / gates).
//  S_eco = 0,25·D1 + 0,20·D2 + 0,31·D3 + 0,24·D4
//  S_adj = S_eco × (1 + α_Seg + β_Zone) ; S_final = S_adj − M(D5)
//  Migration V1→V2 : barèmes 0/3/5 → 1/6/10 (plus de note 0 hors gate),
//  seuil de gate relevé de 0 à 1, somme des poids de domaines portée à 100%
//  (corrige l'incohérence des 90% renormalisés). Les scores 0..100 et les
//  seuils de décision (75/65/50) sont préservés.
// ---------------------------------------------------------------------

export const PROMOTION_SCORING_MODEL: ScoringModelConfig = {
  modelCode: "PI_PROMOTION",
  version: "v2.0.0",
  scoreScale: 10,
  bamCoefficients: {
    SAIN: 1.0,
    SENSIBLE: 0.9,
    PRE_DOUTEUX: 0.7,
    DOUTEUX: 0.4,
    COMPROMIS: 0.2,
    CTX: 0.0,
  },
  // ≥75 Sain · 65-74 Surveillance · 50-64 Sensible probable · <50 Sensible
  decisionThresholds: { go: 75, goWithConditions: 65, watchList: 50 },
  segmentAdjustments: {
    social: 0.0,
    intermediaire: -0.05,
    moyen_haut: 0.0,
    touristique: -0.07,
    bureaux: -0.05,
    commerces: -0.03,
    villas: -0.04,
  },
  zoneAdjustments: {
    casa_centre: 0.0,
    casa_peripherie: -0.05,
    rabat_centre: 0.02,
    rabat_peripherie: 0.0,
    tanger: 0.0,
    marrakech: -0.07,
    agadir: 0.0,
    fes_oriental: -0.03,
    regions_interieures: -0.05,
  },
  domains: [
    {
      code: "D1",
      name: "Sponsor & Gouvernance",
      weight: 0.25,
      criteria: [
        {
          code: "D1C1", name: "Projets similaires livrés (5 ans)", type: "NUM", weight: 0.2,
          inputKey: "promoter_completed_projects", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 1, score: 1, label: "Aucun (critique)" },
            { minIncl: 1, maxExcl: 3, score: 6, label: "1-2 (vigilance)" },
            { minIncl: 3, maxExcl: null, score: 10, label: "≥3 (OK)" },
          ],
        },
        {
          code: "D1C2", name: "Gearing promoteur (dettes nettes / FP)", type: "NUM", weight: 0.25,
          inputKey: "promoter_gearing", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 100, score: 10, label: "≤100% (OK)" },
            { minIncl: 100, maxExcl: 150, score: 6, label: "100-150% (vigilance)" },
            { minIncl: 150, maxExcl: null, score: 1, label: ">150% (critique)" },
          ],
        },
        {
          code: "D1C3", name: "Gouvernance & structure juridique", type: "QUAL", weight: 0.15,
          inputKey: "governance_quality", isGate: false,
          options: [
            { value: "opaque", label: "Opaque", score: 1 },
            { value: "partielle", label: "Partielle", score: 6 },
            { value: "claire", label: "Claire / structurée", score: 10 },
          ],
        },
        {
          code: "D1C4", name: "Concentration mono-projet (CA projet / CA total)", type: "NUM", weight: 0.15,
          inputKey: "mono_project_concentration", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 40, score: 10, label: "≤40% (OK)" },
            { minIncl: 40, maxExcl: 60, score: 6, label: "40-60% (vigilance)" },
            { minIncl: 60, maxExcl: null, score: 1, label: ">60% (critique)" },
          ],
        },
        {
          code: "D1C5", name: "Typologie promoteur", type: "QUAL", weight: 0.1,
          inputKey: "promoter_type", isGate: false,
          options: [
            { value: "opportuniste", label: "Opportuniste", score: 2 },
            { value: "regional", label: "Régional", score: 6 },
            { value: "structure", label: "Structuré", score: 10 },
          ],
        },
        {
          code: "D1C6", name: "Apport effectif (injecté / prévu)", type: "NUM", weight: 0.15,
          inputKey: "equity_injected_ratio", isGate: true, gateThreshold: 1,
          ranges: [
            { minIncl: null, maxExcl: 80, score: 1, label: "<80% (critique)" },
            { minIncl: 80, maxExcl: 100, score: 6, label: "80-100% (vigilance)" },
            { minIncl: 100, maxExcl: null, score: 10, label: "≥100% (OK)" },
          ],
        },
      ],
    },
    {
      code: "D2",
      name: "Qualité intrinsèque du projet",
      weight: 0.20,
      criteria: [
        {
          code: "D2C1", name: "Foncier & autorisations", type: "QUAL", weight: 0.2,
          inputKey: "land_permits_status", isGate: true, gateThreshold: 1,
          options: [
            { value: "absentes", label: "Titre non purgé / autorisations absentes", score: 1 },
            { value: "partielles", label: "Partielles", score: 6 },
            { value: "definitives", label: "Titre purgé + autorisations définitives", score: 10 },
          ],
        },
        {
          code: "D2C2", name: "Marché & positionnement", type: "QUAL", weight: 0.2,
          inputKey: "market_positioning", isGate: false,
          options: [
            { value: "sur_positionne", label: "Sur-positionné / sur-offre", score: 2 },
            { value: "moyen", label: "Correct", score: 6 },
            { value: "aligne", label: "Aligné / forte demande", score: 10 },
          ],
        },
        {
          code: "D2C3", name: "Complexité technique", type: "QUAL", weight: 0.15,
          inputKey: "technical_complexity", isGate: false,
          options: [
            { value: "elevee", label: "Élevée", score: 2 },
            { value: "moyenne", label: "Moyenne", score: 6 },
            { value: "standard", label: "Standard", score: 10 },
          ],
        },
        {
          code: "D2C4", name: "Avancement vs planning", type: "NUM", weight: 0.15,
          inputKey: "progress_vs_plan", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 80, score: 1, label: "<80% (critique)" },
            { minIncl: 80, maxExcl: 100, score: 6, label: "80-100% (vigilance)" },
            { minIncl: 100, maxExcl: null, score: 10, label: "≥100% (OK)" },
          ],
        },
        {
          code: "D2C5", name: "Litiges clients / SAV", type: "QUAL", weight: 0.1,
          inputKey: "sav_litigation", isGate: false,
          options: [
            { value: "eleve", label: "Élevé", score: 2 },
            { value: "moyen", label: "Moyen", score: 6 },
            { value: "faible", label: "Faible", score: 10 },
          ],
        },
        {
          code: "D2C6", name: "Sensibilité macro / subvention", type: "QUAL", weight: 0.1,
          inputKey: "macro_sensitivity", isGate: false,
          options: [
            { value: "elevee", label: "Élevée", score: 2 },
            { value: "moyenne", label: "Moyenne", score: 6 },
            { value: "faible", label: "Faible", score: 10 },
          ],
        },
        {
          code: "D2C7", name: "Coût foncier / CA", type: "NUM", weight: 0.1,
          inputKey: "land_cost_ratio", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 25, score: 10, label: "≤25% (OK)" },
            { minIncl: 25, maxExcl: 35, score: 6, label: "25-35% (vigilance)" },
            { minIncl: 35, maxExcl: null, score: 1, label: ">35% (critique)" },
          ],
        },
      ],
    },
    {
      code: "D3",
      name: "Commercial & Cash-flow",
      weight: 0.31,
      criteria: [
        {
          code: "D3C1", name: "Préventes sécurisées (encaissées / CA)", type: "NUM", weight: 0.25,
          inputKey: "pre_sale_rate", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 25, score: 1, label: "<25% (critique)" },
            { minIncl: 25, maxExcl: 40, score: 6, label: "25-40% (vigilance)" },
            { minIncl: 40, maxExcl: null, score: 10, label: "≥40% (OK)" },
          ],
        },
        {
          code: "D3C2", name: "Ventes vs planning", type: "NUM", weight: 0.1,
          inputKey: "sales_vs_plan", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 80, score: 1, label: "<80% (critique)" },
            { minIncl: 80, maxExcl: 100, score: 6, label: "80-100% (vigilance)" },
            { minIncl: 100, maxExcl: null, score: 10, label: "≥100% (OK)" },
          ],
        },
        {
          code: "D3C3", name: "DSO (jours)", type: "NUM", weight: 0.1,
          inputKey: "dso_days", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 120, score: 10, label: "≤120j (OK)" },
            { minIncl: 120, maxExcl: 240, score: 6, label: "120-240j (vigilance)" },
            { minIncl: 240, maxExcl: null, score: 1, label: ">240j (critique)" },
          ],
        },
        {
          code: "D3C4", name: "Cash coverage (cash / échéances)", type: "NUM", weight: 0.2,
          inputKey: "cash_coverage", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 1, score: 1, label: "<1,0x (critique)" },
            { minIncl: 1, maxExcl: 1.2, score: 6, label: "1,0-1,2x (vigilance)" },
            { minIncl: 1.2, maxExcl: null, score: 10, label: "≥1,2x (OK)" },
          ],
        },
        {
          code: "D3C5", name: "Impasse brute", type: "NUM", weight: 0.15,
          inputKey: "funding_gap_pct", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 0.01, score: 10, label: "≤0% (OK)" },
            { minIncl: 0.01, maxExcl: 10, score: 6, label: "0-10% (vigilance)" },
            { minIncl: 10, maxExcl: null, score: 1, label: ">10% (critique)" },
          ],
        },
        {
          code: "D3C6", name: "Rotation stock (mois)", type: "NUM", weight: 0.1,
          inputKey: "stock_rotation_months", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 18, score: 10, label: "≤18m (OK)" },
            { minIncl: 18, maxExcl: 30, score: 6, label: "18-30m (vigilance)" },
            { minIncl: 30, maxExcl: null, score: 1, label: ">30m (critique)" },
          ],
        },
        {
          code: "D3C7", name: "Marge brute stressée (prix -10%)", type: "NUM", weight: 0.1,
          inputKey: "stressed_margin_pct", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 10, score: 1, label: "<10% (critique)" },
            { minIncl: 10, maxExcl: 15, score: 6, label: "10-15% (vigilance)" },
            { minIncl: 15, maxExcl: null, score: 10, label: "≥15% (OK)" },
          ],
        },
      ],
    },
    {
      code: "D4",
      name: "Structuration financière & LGD",
      weight: 0.24,
      criteria: [
        {
          code: "D4C1", name: "Marge brute (CA - coûts directs)/CA", type: "NUM", weight: 0.2,
          inputKey: "gross_margin_pct", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 15, score: 1, label: "<15% (critique)" },
            { minIncl: 15, maxExcl: 25, score: 6, label: "15-25% (vigilance)" },
            { minIncl: 25, maxExcl: null, score: 10, label: "≥25% (OK)" },
          ],
        },
        {
          code: "D4C2", name: "LTC (dette / coût total)", type: "NUM", weight: 0.15,
          inputKey: "ltc", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 60, score: 10, label: "≤60% (OK)" },
            { minIncl: 60, maxExcl: 80, score: 6, label: "60-80% (vigilance)" },
            { minIncl: 80, maxExcl: null, score: 1, label: ">80% (critique)" },
          ],
        },
        {
          code: "D4C3", name: "LTV stressée (dette / valeur×0,90)", type: "NUM", weight: 0.2,
          inputKey: "ltv_stressed", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 70, score: 10, label: "≤70% (OK)" },
            { minIncl: 70, maxExcl: 85, score: 6, label: "70-85% (vigilance)" },
            { minIncl: 85, maxExcl: null, score: 1, label: ">85% (critique)" },
          ],
        },
        {
          code: "D4C4", name: "Couverture garanties réalisable", type: "NUM", weight: 0.2,
          inputKey: "guarantee_coverage", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 90, score: 1, label: "<90% (critique)" },
            { minIncl: 90, maxExcl: 120, score: 6, label: "90-120% (vigilance)" },
            { minIncl: 120, maxExcl: null, score: 10, label: "≥120% (OK)" },
          ],
        },
        {
          code: "D4C5", name: "Rang bancaire 1er rang", type: "QUAL", weight: 0.1,
          inputKey: "first_rank", isGate: false,
          options: [
            { value: "non", label: "Non 1er rang", score: 1 },
            { value: "oui", label: "1er rang", score: 10 },
          ],
        },
        {
          code: "D4C6", name: "Interest coverage (EBITDA / charges fin.)", type: "NUM", weight: 0.15,
          inputKey: "interest_coverage", isGate: false,
          ranges: [
            { minIncl: null, maxExcl: 1.5, score: 1, label: "<1,5x (critique)" },
            { minIncl: 1.5, maxExcl: 3, score: 6, label: "1,5-3x (vigilance)" },
            { minIncl: 3, maxExcl: null, score: 10, label: "≥3x (OK)" },
          ],
        },
      ],
    },
  ],
  redFlags: [], // injecté ci-dessous
};

// ---------------------------------------------------------------------
//  D5 — Vulnérabilité réglementaire BAM : malus & déclencheurs souffrance
//  severity BLOCKING = déclencheur automatique de souffrance (hors score).
// ---------------------------------------------------------------------

export const PROMOTION_RED_FLAGS: ScoringModelConfig["redFlags"] = [
  {
    code: "RF_RETARD_6M", name: "Retard chantier ≥ 6 mois",
    rule: { clause: { key: "construction_delay_months", op: "gte", value: 6 } },
    severity: "HIGH", impactDomains: ["D2", "D5"], malus: 15, mitigable: true,
  },
  {
    code: "RF_CASH_LT_ECH", name: "Cash coverage < 1,0x",
    rule: { clause: { key: "cash_coverage", op: "lt", value: 1 } },
    severity: "HIGH", impactDomains: ["D3", "D5"], malus: 25, mitigable: true,
  },
  {
    code: "RF_IMPASSE_PERSIST", name: "Impasse de trésorerie persistante",
    rule: { clause: { key: "funding_gap_persistent", op: "isTrue" } },
    severity: "HIGH", impactDomains: ["D3", "D5"], malus: 20, mitigable: true,
  },
  {
    code: "RF_RESTRUCT", name: "Première restructuration",
    rule: { clause: { key: "restructured", op: "eq", value: "yes" } },
    severity: "MEDIUM", impactDomains: ["D5"], malus: 25, mitigable: false,
  },
  {
    code: "RF_FP_NEG", name: "Fonds propres négatifs",
    rule: { clause: { key: "equity_negative", op: "isTrue" } },
    severity: "HIGH", impactDomains: ["D4", "D5"], malus: 25, mitigable: false,
  },
  {
    code: "RF_NON_1ER_RANG", name: "Garantie non 1er rang",
    rule: { clause: { key: "first_rank", op: "eq", value: "non" } },
    severity: "MEDIUM", impactDomains: ["D4", "D5"], malus: 25, mitigable: true,
  },
  {
    code: "RF_IMPAYE_90J", name: "Impayé ≥ 90 jours (souffrance automatique)",
    rule: { clause: { key: "dpd_days", op: "gte", value: 90 } },
    severity: "BLOCKING", impactDomains: ["D5"], malus: 0, mitigable: false,
  },
  {
    code: "RF_PROJET_ARRET_12M", name: "Projet à l'arrêt ≥ 12 mois (souffrance automatique)",
    rule: { clause: { key: "project_stopped_months", op: "gte", value: 12 } },
    severity: "BLOCKING", impactDomains: ["D5"], malus: 0, mitigable: false,
  },
  {
    code: "RF_LITIGE", name: "Action en justice / contentieux (CTX)",
    rule: { clause: { key: "legal_exposure", op: "eq", value: "litigation" } },
    severity: "BLOCKING", impactDomains: ["D5"], malus: 0, mitigable: false,
  },
];

PROMOTION_SCORING_MODEL.redFlags = PROMOTION_RED_FLAGS;

// =====================================================================
//  REGIME BKAM 19/G/2002 (abrogé par 1/W au 01/01/2027)
// =====================================================================

export const REGIME_19G_2002: RegulatoryRegimeConfig = {
  code: "BKAM_19G_2002",
  name: "Circulaire 19/G/2002 — Classification des créances",
  restructuringPolicy: "BKAM_19G",
  classes: [
    { code: "SAIN", label: "Créance saine", orderIndex: 0, isWatchList: false, isDefault: false, blocksGo: false },
    { code: "PRE_DOUTEUX", label: "Pré-douteuse", orderIndex: 2, isWatchList: false, isDefault: true, blocksGo: false },
    { code: "DOUTEUX", label: "Douteuse", orderIndex: 3, isWatchList: false, isDefault: true, blocksGo: false },
    { code: "COMPROMIS", label: "Compromise", orderIndex: 4, isWatchList: false, isDefault: true, blocksGo: false },
    { code: "CTX", label: "Contentieux", orderIndex: 5, isWatchList: false, isDefault: true, blocksGo: true },
  ],
  triggers: [
    { kind: "DPD", targetClass: "PRE_DOUTEUX", dpdMin: 90, dpdMax: 179, priority: 10, description: "Impayé 90j (art.5)" },
    { kind: "DPD", targetClass: "DOUTEUX", dpdMin: 180, dpdMax: 359, priority: 20, description: "Impayé 180j (art.6)" },
    { kind: "DPD", targetClass: "COMPROMIS", dpdMin: 360, dpdMax: null, priority: 30, description: "Impayé 360j (art.7)" },
    { kind: "QUALITATIVE", targetClass: "PRE_DOUTEUX", condition: { clause: { key: "financials_unavailable", op: "isTrue" } }, priority: 8, description: "Situation financière non évaluable (art.5.4)" },
    { kind: "LEGAL", targetClass: "DOUTEUX", condition: { clause: { key: "judicial_recovery", op: "isTrue" } }, priority: 25, description: "Redressement judiciaire (art.6.5)" },
    { kind: "LEGAL", targetClass: "CTX", condition: { clause: { key: "legal_exposure", op: "eq", value: "litigation" } }, priority: 40, description: "Action en justice / contestation (art.7.5)" },
  ],
};

export const REGIME_19G_PROVISION_RATES: Record<string, number> = {
  SAIN: 0, PRE_DOUTEUX: 0.2, DOUTEUX: 0.5, COMPROMIS: 1.0, CTX: 1.0,
};

// =====================================================================
//  REGIME BKAM 1/W/2025 (en vigueur à compter du 01/01/2027)
//  Ajoute la classe SENSIBLE, triggers promotion immobilière, et
//  régime de restructuration détaillé (art.17-31).
// =====================================================================

export const REGIME_1W_2025: RegulatoryRegimeConfig = {
  code: "BKAM_1W_2025",
  name: "Circulaire 1/W/2025 — Classification & provisionnement",
  restructuringPolicy: "BKAM_1W",
  classes: [
    { code: "SAIN", label: "Créance saine", orderIndex: 0, isWatchList: false, isDefault: false, blocksGo: false },
    { code: "SENSIBLE", label: "Créance sensible (surveillance)", orderIndex: 1, isWatchList: true, isDefault: false, blocksGo: false },
    { code: "PRE_DOUTEUX", label: "Pré-douteuse", orderIndex: 2, isWatchList: false, isDefault: true, blocksGo: false },
    { code: "DOUTEUX", label: "Douteuse", orderIndex: 3, isWatchList: false, isDefault: true, blocksGo: false },
    { code: "COMPROMIS", label: "Compromise", orderIndex: 4, isWatchList: false, isDefault: true, blocksGo: false },
    { code: "CTX", label: "Contentieux", orderIndex: 5, isWatchList: false, isDefault: true, blocksGo: true },
  ],
  triggers: [
    // --- Créances sensibles (art.5) dont triggers promotion immobilière ---
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "seizure_notice", op: "isTrue" } }, priority: 4, description: "Saisie-arrêt / ATD (art.5.1)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "financials_late_7m", op: "isTrue" } }, priority: 4, description: "États comptables non reçus 7 mois après clôture (art.5.2)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "negative_credit_bureau", op: "isTrue" } }, priority: 4, description: "Information négative Crédit Bureau / SCIP (art.5.2)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "commercialization_below_50_1y", op: "isTrue" } }, priority: 6, description: "Commercialisation < 50% un an après travaux (art.5.3)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "admin_problems_over_1y", op: "isTrue" } }, priority: 6, description: "Problèmes administratifs > 1 an (art.5.3)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "construction_delay_over_1y", op: "isTrue" } }, priority: 6, description: "Retard construction > 1 an vs planning (art.5.3)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "bp_significant_gap", op: "isTrue" } }, priority: 6, description: "Décalage significatif vs business plan (art.5.3)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { all: [{ key: "revenue_drop_pct", op: "gte", value: 50 }] }, priority: 5, description: "Baisse du CA ≥ 50% en un an (art.5.5)" },
    { kind: "QUALITATIVE", targetClass: "SENSIBLE", condition: { clause: { key: "debt_equity_ratio", op: "gt", value: 3 } }, priority: 5, description: "Dettes fin./FP > 3 (art.5.5)" },
    // --- Souffrance par retard (art.8/10-12) ---
    { kind: "DPD", targetClass: "PRE_DOUTEUX", dpdMin: 90, dpdMax: 179, priority: 10, description: "Impayé > 90j (art.10)" },
    { kind: "DPD", targetClass: "DOUTEUX", dpdMin: 180, dpdMax: 359, priority: 20, description: "Impayé > 180j (art.11)" },
    { kind: "DPD", targetClass: "COMPROMIS", dpdMin: 360, dpdMax: null, priority: 30, description: "Impayé > 360j (art.12)" },
    { kind: "QUALITATIVE", targetClass: "PRE_DOUTEUX", condition: { clause: { key: "financials_unavailable", op: "isTrue" } }, priority: 8, description: "Situation financière non évaluable (art.10.6)" },
    { kind: "LEGAL", targetClass: "DOUTEUX", condition: { clause: { key: "judicial_recovery", op: "isTrue" } }, priority: 22, description: "Redressement judiciaire (art.11.6)" },
    // --- Compromises spécifiques promotion immobilière (art.12.6/12.7) ---
    { kind: "QUALITATIVE", targetClass: "COMPROMIS", condition: { clause: { key: "finished_2y_no_sales", op: "isTrue" } }, priority: 28, description: "Projet finalisé ≥ 2 ans, commercialisation figée (art.12.6)" },
    { kind: "QUALITATIVE", targetClass: "COMPROMIS", condition: { clause: { key: "project_stopped_over_1y", op: "isTrue" } }, priority: 28, description: "Projet à l'arrêt > 1 an (art.12.7)" },
    { kind: "LEGAL", targetClass: "CTX", condition: { clause: { key: "legal_exposure", op: "eq", value: "litigation" } }, priority: 40, description: "Action en justice / contestation (art.12.8)" },
  ],
};

export const REGIME_1W_PROVISION_RATES: Record<string, number> = {
  SAIN: 0, SENSIBLE: 0.1, PRE_DOUTEUX: 0.2, DOUTEUX: 0.5, COMPROMIS: 1.0, CTX: 1.0,
};

// ---------------------------------------------------------------------
//  TYPES DE GARANTIES (quotités réglementaires + profils d'abattement)
//  Quotités 100% (art.15.1/35.1) · 80% (art.15.2/35.2) · 50% (art.15.3/35.3)
// ---------------------------------------------------------------------

function buildGuaranteeTypes(stateGuaranteeLabel: string): GuaranteeTypeConfig[] {
  return [
    { code: "DEPOT_GARANTIE", label: "Dépôt de garantie (deposit)", eligible: true, quotity: 1.0, haircut: 0, abatementProfile: "NONE" },
    { code: "GARANTIE_ETAT", label: stateGuaranteeLabel, eligible: true, quotity: 1.0, haircut: 0, abatementProfile: "NONE" },
    { code: "NANTISSEMENT_DAT", label: "Nantissement DAT / bons de caisse de l'établissement", eligible: true, quotity: 1.0, haircut: 0, abatementProfile: "NONE" },
    { code: "GARANTIE_BANCAIRE", label: "Garantie banque 1er ordre / assurance-crédit", eligible: true, quotity: 0.8, haircut: 0, abatementProfile: "NONE" },
    { code: "NANTISSEMENT_TITRES", label: "Nantissement titres (autres établissements)", eligible: true, quotity: 0.8, haircut: 0, abatementProfile: "TITRES" },
    { code: "HYP_RANG1", label: "Hypothèque immobilière 1er rang", eligible: true, quotity: 0.5, haircut: 0, abatementProfile: "HYPOTHECAIRE", requiresRank1: true },
    { code: "HYP_RANG_INF", label: "Hypothèque de rang inférieur", eligible: true, quotity: 0.5, haircut: 0, abatementProfile: "HYPOTHECAIRE" },
    { code: "ATTESTATION_MARCHE", label: "Attestation de droits constatés (marchés publics)", eligible: true, quotity: 0.5, haircut: 0, abatementProfile: "TITRES" },
    { code: "NANTISSEMENT_VEHICULE", label: "Nantissement véhicules neufs", eligible: true, quotity: 0.5, haircut: 0, abatementProfile: "VEHICULES" },
    { code: "CAUTION_PERSO", label: "Caution personnelle (non admise en déduction)", eligible: false, quotity: 0, haircut: 1, abatementProfile: "NONE" },
  ];
}

// 19/G : garantie État / Caisse Centrale de Garantie (CCG)
export const GUARANTEE_TYPES_19G = buildGuaranteeTypes(
  "Garantie État / CCG homologuée",
);
// 1/W : la CCG devient la SNGFE (Société Nationale de Garantie et du Financement de l'Entreprise)
export const GUARANTEE_TYPES_1W = buildGuaranteeTypes(
  "Garantie État / SNGFE homologuée",
);
