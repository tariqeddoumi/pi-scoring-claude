// =====================================================================
//  Schémas Zod — validation côté serveur de toutes les entrées.
// =====================================================================

import { z } from "zod";

export const promoterSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  legalForm: z.string().optional(),
  rcNumber: z.string().optional(),
  iceNumber: z.string().optional(),
  groupName: z.string().optional(),
  yearsExperience: z.coerce.number().int().min(0).optional(),
  completedProjects: z.coerce.number().int().min(0).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

export const projectSchema = z.object({
  reference: z.string().min(1, "Référence requise"),
  name: z.string().min(2, "Nom du projet requis"),
  promoterId: z.string().min(1, "Promoteur requis"),
  rmId: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  projectType: z.string().optional(),
  totalUnits: z.coerce.number().int().min(0).optional(),
  landAreaSqm: z.coerce.number().min(0).optional(),
  builtAreaSqm: z.coerce.number().min(0).optional(),
  totalCost: z.coerce.number().min(0).optional(),
  loanAmount: z.coerce.number().min(0).optional(),
  ownEquity: z.coerce.number().min(0).optional(),
});

// Entrées de scoring — clés alignées sur le modèle publié (inputKey).
//
// Règles d'alignement avec le modèle (invariant « une omission n'améliore
// jamais la décision ») :
//  - un champ vide / null signifie « donnée absente » et n'est JAMAIS converti
//    en 0 ni en « Non » : le moteur applique alors la note plancher, ou
//    « Dossier incomplet » pour une donnée décisionnelle ;
//  - aucune valeur par défaut n'est fabriquée ;
//  - toutes les clés sont facultatives à l'enregistrement (brouillon partiel) :
//    c'est le moteur qui juge la complétude, pas le formulaire.

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** Nombre facultatif : vide → null ; « 1,5 » accepté. */
export const optNumber = (schema: z.ZodNumber = z.number()) =>
  z.preprocess(
    (v) => (isBlank(v) ? null : typeof v === "string" ? Number(v.trim().replace(",", ".")) : v),
    schema.finite().nullable(),
  );

/** Booléen facultatif : vide → null ; oui/non, true/false, 1/0 acceptés. */
export const optBool = () =>
  z.preprocess((v) => {
    if (isBlank(v)) return null;
    if (typeof v === "boolean") return v;
    const t = String(v).trim().toLowerCase();
    if (["true", "oui", "o", "yes", "y", "1", "vrai", "x"].includes(t)) return true;
    if (["false", "non", "n", "no", "0", "faux"].includes(t)) return false;
    return v; // valeur non reconnue → rejetée par z.boolean()
  }, z.boolean().nullable());

/** Modalité facultative : vide → null. */
export const optEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (isBlank(v) ? null : v), z.enum(values).nullable());

export const scoringInputsSchema = z.object({
  // --- D1 Sponsor & Gouvernance ---
  promoter_completed_projects: optNumber(z.number().min(0)),
  promoter_gearing: optNumber(z.number().min(0)),
  governance_quality: optEnum(["opaque", "partielle", "claire"]),
  mono_project_concentration: optNumber(z.number().min(0).max(100)),
  promoter_type: optEnum(["opportuniste", "regional", "structure"]),
  equity_injected_ratio: optNumber(z.number().min(0)),
  // --- D2 Qualité intrinsèque ---
  land_permits_status: optEnum(["absentes", "partielles", "definitives"]),
  market_positioning: optEnum(["sur_positionne", "moyen", "aligne"]),
  technical_complexity: optEnum(["elevee", "moyenne", "standard"]),
  progress_vs_plan: optNumber(z.number().min(0)),
  sav_litigation: optEnum(["eleve", "moyen", "faible"]),
  macro_sensitivity: optEnum(["elevee", "moyenne", "faible"]),
  land_cost_ratio: optNumber(z.number().min(0).max(100)),
  authorization_completeness_pct: optNumber(z.number().min(0).max(100)),
  // --- D3 Commercial & Cash-flow ---
  pre_sale_rate: optNumber(z.number().min(0).max(100)),
  sales_vs_plan: optNumber(z.number().min(0)),
  dso_days: optNumber(z.number().min(0)),
  cash_coverage: optNumber(z.number().min(0)),
  funding_gap_pct: optNumber(),
  stock_rotation_months: optNumber(z.number().min(0)),
  stressed_margin_pct: optNumber(),
  secured_sales_rate: optNumber(z.number().min(0).max(100)),
  // --- D4 Structuration & LGD ---
  gross_margin_pct: optNumber(),
  ltc: optNumber(z.number().min(0).max(200)),
  ltv_stressed: optNumber(z.number().min(0).max(300)),
  guarantee_coverage: optNumber(z.number().min(0)),
  first_rank: optEnum(["oui", "non"]),
  interest_coverage: optNumber(z.number().min(0)),
  release_quotity_gap_pts: optNumber(z.number().min(-100).max(100)),
  // --- D5 / déclencheurs réglementaires ---
  dpd_days: optNumber(z.number().int().min(0)),
  construction_delay_months: optNumber(z.number().min(0)),
  project_stopped_months: optNumber(z.number().min(0)),
  restructured: optEnum(["yes", "no"]),
  legal_exposure: optEnum(["litigation", "watch", "clear"]),
  funding_gap_persistent: optBool(),
  equity_negative: optBool(),
  // --- Alertes v4 (pratique marocaine) — calculées par la synchronisation du
  //     suivi, saisissables à défaut ---
  works_authorization_blocked: optBool(),
  buyers_financing_at_risk: optBool(),
  release_underpriced: optBool(),
  division_limit_breach: optBool(),
  // --- Déclencheurs de classification (optionnels) ---
  seizure_notice: optBool(),
  financials_late_7m: optBool(),
  financials_unavailable: optBool(),
  negative_credit_bureau: optBool(),
  commercialization_below_50_1y: optBool(),
  admin_problems_over_1y: optBool(),
  construction_delay_over_1y: optBool(),
  bp_significant_gap: optBool(),
  revenue_drop_pct: optNumber(),
  debt_equity_ratio: optNumber(),
  judicial_recovery: optBool(),
  finished_2y_no_sales: optBool(),
  project_stopped_over_1y: optBool(),
  // --- Restructuration (art.17-31) ---
  restructuring_count: optNumber(z.number().int().min(0)),
  restructuring_viable: optBool(),
  restructuring_deferral_months: optNumber(z.number().min(0)),
  second_restructuring_in_observation: optBool(),
  dpd_on_restructured: optNumber(z.number().min(0)),
  // --- Crédit in fine / dépassements / compte débiteur (1/W art.10-12) ---
  credit_type: optEnum(["amortissable", "in_fine", "decouvert"]),
  days_after_maturity: optNumber(z.number().min(0)),
  bullet_unpaid: optBool(),
  authorized_amount: optNumber(z.number().min(0)),
  overdraft_excess_pct: optNumber(z.number().min(0)),
  overdraft_excess_days: optNumber(z.number().min(0)),
  debit_no_credit_movements_days: optNumber(z.number().min(0)),
  // --- Fiabilité de l'information (art.5.3) ---
  unreliable_construction_progress_info: optBool(),
  unreliable_commercialization_info: optBool(),
});

export type ScoringInputsForm = z.infer<typeof scoringInputsSchema>;

export const guaranteeSchema = z.object({
  projectId: z.string().min(1),
  typeCode: z.string().min(1),
  description: z.string().optional(),
  marketValue: z.coerce.number().min(0),
  rank: z.coerce.number().int().min(1).default(1),
});

export const provisionInputSchema = z.object({
  ead: z.coerce.number().min(0),
  reservedAgios: z.coerce.number().min(0).default(0),
});

export const importMappingSchema = z.object({
  entity: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
});

export const committeeDecisionSchema = z.object({
  outcome: z.enum(["FAVORABLE", "FAVORABLE_CONDITIONS", "DEFAVORABLE", "AJOURNE"]),
  quorum: z.coerce.number().int().min(0).default(0),
  presentCount: z.coerce.number().int().min(0).default(0),
  votesFor: z.coerce.number().int().min(0).default(0),
  votesAgainst: z.coerce.number().int().min(0).default(0),
  votesAbstain: z.coerce.number().int().min(0).default(0),
  approvedAmount: z.coerce.number().min(0).optional(),
  conditions: z.string().optional(),
  validUntil: z.string().optional(),
  minutesRef: z.string().optional(),
});

export type CommitteeDecisionForm = z.infer<typeof committeeDecisionSchema>;

export const gfaVefaSchema = z.object({
  assetType: z.enum(["PROMOTION", "EXPLOITATION"]).default("PROMOTION"),
  saleMode: z.enum(["CLASSIC", "VEFA"]),
  hasGFA: z.coerce.boolean(),
  gfaAmount: z.coerce.number().min(0).optional(),
  gfaProvider: z.string().max(200).optional(),
});

export type GfaVefaFormValues = z.infer<typeof gfaVefaSchema>;

// Entrées du modèle ACTIFS D'EXPLOITATION & DE RAPPORT (hôtels, bureaux,
// commerces loués).
export const exploitationInputsSchema = z.object({
  occupancy_rate: optNumber(z.number().min(0).max(100)),
  lease_indexation: optEnum(["none", "partial", "full"]),
  revenue_stability: optEnum(["volatile", "moderate", "stable"]),
  seasonality: optEnum(["high", "moderate", "low"]),
  dscr: optNumber(z.number().min(0)),
  debt_yield: optNumber(z.number().min(0)),
  interest_coverage: optNumber(z.number().min(0)),
  walt_years: optNumber(z.number().min(0)),
  tenant_quality: optEnum(["weak", "standard", "strong"]),
  operator_quality: optEnum(["independent", "regional", "international"]),
  ltv_stabilized: optNumber(z.number().min(0).max(300)),
  asset_quality: optEnum(["poor", "standard", "prime"]),
  location_demand: optEnum(["weak", "moderate", "strong"]),
  refinancing_risk: optEnum(["high", "moderate", "low"]),
  dpd_days: optNumber(z.number().int().min(0)),
  restructured: optEnum(["yes", "no"]),
  legal_exposure: optEnum(["litigation", "watch", "clear"]),
});

export const riskCalibrationSchema = z.object({
  label: z.string().min(1).max(120),
  pdStrong: z.coerce.number().min(0).max(1),
  pdGood: z.coerce.number().min(0).max(1),
  pdSatisfactory: z.coerce.number().min(0).max(1),
  pdWeak: z.coerce.number().min(0).max(1),
  lgdUnsecured: z.coerce.number().min(0).max(1),
  lgdFloor: z.coerce.number().min(0).max(1),
  maturityYears: z.coerce.number().min(1).max(15),
});

export type RiskCalibrationFormValues = z.infer<typeof riskCalibrationSchema>;

// Rapport de visite de chantier (suivi de promotion).
export const visitReportSchema = z.object({
  projectId: z.string().min(1, "Projet requis"),
  visitDate: z.string().min(1, "Date de visite requise"),
  inspectorName: z.string().optional(),
  trancheCode: z.string().optional(),
  status: z.enum(["DRAFT", "FINALIZED"]).default("DRAFT"),
  observedProgressPct: z.coerce.number().min(0).max(100).optional().nullable(),
  workforceCount: z.coerce.number().int().min(0).optional().nullable(),
  weatherImpact: z.coerce.boolean().optional().default(false),
  qualityIssue: z.coerce.boolean().optional().default(false),
  safetyIssue: z.coerce.boolean().optional().default(false),
  delayRisk: z.coerce.boolean().optional().default(false),
  summary: z.string().optional(),
  observations: z.string().optional(),
  recommendations: z.string().optional(),
  rawText: z.string().optional(),
});

export type VisitReportFormValues = z.infer<typeof visitReportSchema>;

// Événement du journal projet (suivi événementiel, tous types d'actifs).
export const projectEventSchema = z.object({
  projectId: z.string().min(1, "Projet requis"),
  type: z.string().min(1, "Type d'événement requis"),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  title: z.string().max(200).optional(),
  eventDate: z.string().min(1, "Date requise"),
  endDate: z.string().optional(),
  amount: z.coerce.number().min(0).optional().nullable(),
  note: z.string().max(4000).optional(),
  affectsScoring: z.coerce.boolean().optional(),
});

export type ProjectEventFormValues = z.infer<typeof projectEventSchema>;

// Création / édition d'un projet de promotion (formulaire à listes déroulantes).
export const projectUpsertSchema = z.object({
  id: z.string().optional(),
  reference: z.string().min(1, "Référence requise"),
  name: z.string().min(2, "Nom du projet requis"),
  promoterId: z.string().min(1, "Promoteur requis"),
  rmId: z.string().optional().nullable(),
  assetType: z.enum(["PROMOTION", "EXPLOITATION"]).default("PROMOTION"),
  city: z.string().optional(),
  region: z.string().optional(),
  projectType: z.string().optional(),
  segment: z.string().optional(),
  zone: z.string().optional(),
  status: z.string().optional(),
  saleMode: z.enum(["CLASSIC", "VEFA"]).default("CLASSIC"),
  totalUnits: z.coerce.number().int().min(0).optional().nullable(),
  totalCost: z.coerce.number().min(0).optional().nullable(),
  loanAmount: z.coerce.number().min(0).optional().nullable(),
  ownEquity: z.coerce.number().min(0).optional().nullable(),
  // --- Saisie complète (V2.1) ---
  groupId: z.string().optional().nullable(),
  address: z.string().optional(),
  landAreaSqm: z.coerce.number().min(0).optional().nullable(),
  builtAreaSqm: z.coerce.number().min(0).optional().nullable(),
  landTitleRef: z.string().optional(),
  landStatus: z.string().optional(),
  buildPermitRef: z.string().optional(),
  buildPermitDate: z.string().optional(), // ISO (yyyy-mm-dd)
  startDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  description: z.string().max(4000).optional(),
  coreBankingRef: z.string().max(60).optional(),
});

export type ProjectUpsertValues = z.infer<typeof projectUpsertSchema>;

// Signalétique promoteur (création / édition).
export const promoterUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Raison sociale requise"),
  legalForm: z.string().optional(),
  rcNumber: z.string().optional(),
  iceNumber: z.string().optional(),
  ifNumber: z.string().optional(),
  cnssNumber: z.string().optional(),
  patenteNumber: z.string().optional(),
  capital: z.coerce.number().min(0).optional().nullable(),
  foundedYear: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  managerName: z.string().optional(),
  shareholders: z.string().max(4000).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  website: z.string().optional(),
  contactEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  yearsExperience: z.coerce.number().int().min(0).optional().nullable(),
  completedProjects: z.coerce.number().int().min(0).optional().nullable(),
  internalRating: z.string().optional(),
  bankRelations: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  groupId: z.string().optional().nullable(),
});

export type PromoterUpsertValues = z.infer<typeof promoterUpsertSchema>;

// Lien entre promoteurs (parties liées).
export const promoterLinkSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  type: z.string().min(1, "Type de lien requis"),
  note: z.string().max(500).optional(),
}).refine((v) => v.fromId !== v.toId, { message: "Un promoteur ne peut être lié à lui-même.", path: ["toId"] });

export type PromoterLinkValues = z.infer<typeof promoterLinkSchema>;

// Révision du business plan (changement de standing / prix cible / calendrier).
export const bpRevisionSchema = z.object({
  projectId: z.string().min(1),
  reason: z.string().min(3, "Motif requis"),
  changes: z.array(z.object({
    unitId: z.string().min(1),
    newStanding: z.enum(["TRES_HAUT", "HAUT", "MOYEN_HAUT", "MOYEN", "ECONOMIQUE", "SOCIAL"]).optional(),
    newPrice: z.coerce.number().min(0).optional().nullable(),
    newSaleDate: z.string().optional(),
  })).min(1, "Au moins un changement requis"),
});

export type BpRevisionValues = z.infer<typeof bpRevisionSchema>;

// Paramétrage (tuning) du modèle de scoring actif : seuils de décision,
// ajustements segment/zone et malus des red flags.
export const modelTuningSchema = z.object({
  versionId: z.string().min(1),
  go: z.coerce.number().min(0).max(100),
  goWithConditions: z.coerce.number().min(0).max(100),
  watchList: z.coerce.number().min(0).max(100),
  segmentAdjustments: z.record(z.coerce.number().min(-1).max(1)),
  zoneAdjustments: z.record(z.coerce.number().min(-1).max(1)),
  redFlagMalus: z.record(z.coerce.number().min(0).max(100)),
});

export type ModelTuningValues = z.infer<typeof modelTuningSchema>;
