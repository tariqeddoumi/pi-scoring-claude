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

// Entrées de scoring — clés alignées sur referenceData.ts (inputKey).
const bool = z.coerce.boolean().optional().default(false);

export const scoringInputsSchema = z.object({
  // --- D1 Sponsor & Gouvernance ---
  promoter_completed_projects: z.coerce.number().min(0),
  promoter_gearing: z.coerce.number().min(0),
  governance_quality: z.enum(["opaque", "partielle", "claire"]),
  mono_project_concentration: z.coerce.number().min(0).max(100),
  promoter_type: z.enum(["opportuniste", "regional", "structure"]),
  equity_injected_ratio: z.coerce.number().min(0),
  // --- D2 Qualité intrinsèque ---
  land_permits_status: z.enum(["absentes", "partielles", "definitives"]),
  market_positioning: z.enum(["sur_positionne", "moyen", "aligne"]),
  technical_complexity: z.enum(["elevee", "moyenne", "standard"]),
  progress_vs_plan: z.coerce.number().min(0),
  sav_litigation: z.enum(["eleve", "moyen", "faible"]),
  macro_sensitivity: z.enum(["elevee", "faible"]),
  land_cost_ratio: z.coerce.number().min(0).max(100),
  // --- D3 Commercial & Cash-flow ---
  pre_sale_rate: z.coerce.number().min(0).max(100),
  sales_vs_plan: z.coerce.number().min(0),
  dso_days: z.coerce.number().min(0),
  cash_coverage: z.coerce.number().min(0),
  funding_gap_pct: z.coerce.number(),
  stock_rotation_months: z.coerce.number().min(0),
  stressed_margin_pct: z.coerce.number(),
  // --- D4 Structuration & LGD ---
  gross_margin_pct: z.coerce.number(),
  ltc: z.coerce.number().min(0).max(200),
  ltv_stressed: z.coerce.number().min(0).max(300),
  guarantee_coverage: z.coerce.number().min(0),
  first_rank: z.enum(["oui", "non"]),
  interest_coverage: z.coerce.number().min(0),
  // --- D5 / déclencheurs réglementaires ---
  dpd_days: z.coerce.number().int().min(0),
  construction_delay_months: z.coerce.number().min(0).optional().default(0),
  project_stopped_months: z.coerce.number().min(0).optional().default(0),
  restructured: z.enum(["yes", "no"]),
  legal_exposure: z.enum(["litigation", "watch", "clear"]),
  funding_gap_persistent: bool,
  equity_negative: bool,
  // --- Déclencheurs de classification (optionnels) ---
  seizure_notice: bool,
  financials_late_7m: bool,
  financials_unavailable: bool,
  negative_credit_bureau: bool,
  commercialization_below_50_1y: bool,
  admin_problems_over_1y: bool,
  construction_delay_over_1y: bool,
  bp_significant_gap: bool,
  revenue_drop_pct: z.coerce.number().optional().default(0),
  debt_equity_ratio: z.coerce.number().optional().default(0),
  judicial_recovery: bool,
  finished_2y_no_sales: bool,
  project_stopped_over_1y: bool,
  // --- Restructuration (art.17-31) ---
  restructuring_count: z.coerce.number().int().min(0).optional().default(0),
  restructuring_viable: z.coerce.boolean().optional(),
  restructuring_deferral_months: z.coerce.number().min(0).optional().default(0),
  second_restructuring_in_observation: bool,
  dpd_on_restructured: z.coerce.number().min(0).optional().default(0),
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
