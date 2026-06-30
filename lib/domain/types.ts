// =====================================================================
//  Types de domaine — partagés entre moteurs métier, UI et serveur.
//  Volontairement découplés de Prisma pour permettre des moteurs
//  purs, déterministes et testables unitairement.
// =====================================================================

export type CriterionType = "QUAL" | "NUM";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";
export type Decision = "GO" | "GO_WITH_CONDITIONS" | "WATCH_LIST" | "NO_GO";

export type RegulatoryClassCode =
  | "SAIN"
  | "SENSIBLE"
  | "PRE_DOUTEUX"
  | "DOUTEUX"
  | "COMPROMIS"
  | "CTX";

export type TriggerKind =
  | "DPD"
  | "RESTRUCTURING"
  | "QUALITATIVE"
  | "LEGAL"
  | "CROSS_DEFAULT";

// --- Valeurs d'entrée d'un projet (clé -> valeur typée) ---------------
export type InputValue = number | string | boolean | null;
export type ProjectInputs = Record<string, InputValue>;

// --- DSL de règle évaluée sur les entrées -----------------------------
export type RuleOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "isTrue"
  | "isFalse";

export interface RuleClause {
  key: string;
  op: RuleOperator;
  value?: InputValue | InputValue[];
}

// Combinaison logique optionnelle (sinon clause simple).
export interface RuleExpression {
  all?: RuleClause[];
  any?: RuleClause[];
  clause?: RuleClause;
}

// =====================================================================
//  Configuration du modèle de scoring
// =====================================================================

export interface OptionConfig {
  value: string;
  label: string;
  score: number; // 0..scaleScore (échelle du modèle, V1.0 : 0..5)
}

export interface RangeConfig {
  minIncl: number | null; // null = -infini
  maxExcl: number | null; // null = +infini
  score: number; // 0..scaleScore (échelle du modèle, V1.0 : 0..5)
  label?: string;
}

export interface CriterionConfig {
  code: string;
  name: string;
  type: CriterionType;
  weight: number; // poids dans le domaine
  inputKey: string;
  isGate: boolean;
  gateThreshold?: number | null;
  options?: OptionConfig[];
  ranges?: RangeConfig[];
}

export interface DomainConfig {
  code: string; // D1..D5
  name: string;
  weight: number; // poids dans le score technique
  criteria: CriterionConfig[];
}

export interface RedFlagConfig {
  code: string;
  name: string;
  rule: RuleExpression;
  severity: Severity;
  impactDomains: string[];
  malus: number;
  mitigable: boolean;
}

export interface DecisionThresholds {
  // Bornes inférieures (inclusives) sur le score final 0..100.
  go: number; // >= go => GO (Sain)
  goWithConditions: number; // >= => GO_WITH_CONDITIONS (Surveillance)
  watchList: number; // >= => WATCH_LIST (Sensible probable) ; sinon NO_GO
}

// Ajustements macro-locaux du modèle V1.0 : S_adj = S_eco × (1 + α_Seg + β_Zone).
export type SegmentAdjustments = Record<string, number>; // segment -> α
export type ZoneAdjustments = Record<string, number>; // zone -> β

export interface ScoringModelConfig {
  modelCode: string;
  version: string;
  // Échelle de notation des critères (5 = note KPI 0..5 du modèle V1.0).
  scoreScale: number;
  domains: DomainConfig[];
  // Pilier D5 (vulnérabilité BAM) : malus + déclencheurs de souffrance.
  redFlags: RedFlagConfig[];
  // CoeffBAM par classe réglementaire (modulateur réglementaire additionnel).
  bamCoefficients: Partial<Record<RegulatoryClassCode, number>>;
  decisionThresholds: DecisionThresholds;
  segmentAdjustments: SegmentAdjustments;
  zoneAdjustments: ZoneAdjustments;
}

// =====================================================================
//  Résultats du moteur de scoring
// =====================================================================

export interface CriterionOutcome {
  criterionCode: string;
  domainCode: string;
  rawValue: InputValue;
  score: number; // 0..10
  weight: number;
  weighted: number;
  matchedRef: string | null;
  gateBlocked: boolean;
}

export interface DomainOutcome {
  domainCode: string;
  name: string;
  weight: number;
  score: number; // 0..10
  weighted: number; // contribution au score technique
}

export interface RedFlagOutcome {
  code: string;
  name: string;
  severity: Severity;
  malus: number;
  impactDomains: string[];
  mitigable: boolean;
}

export interface ScoringResult {
  criteria: CriterionOutcome[];
  domains: DomainOutcome[];
  redFlags: RedFlagOutcome[];
  scoreEco: number; // S_eco 0..100 (avant ajustement segment/zone)
  alphaSeg: number; // ajustement segment
  betaZone: number; // ajustement zone
  scoreAdjusted: number; // S_adj = S_eco × (1 + α + β)
  scoreTechnique: number; // alias S_adj exposé (0..100)
  totalMalus: number; // somme des malus D5
  scoreAfterPenalties: number; // S_adj − M (0..100)
  coeffBAM: number;
  scoreFinal: number; // 0..100
  decision: Decision;
  internalClass: string; // Sain | Surveillance | Sensible probable | Sensible | Souffrance
  gateBlocked: boolean;
  souffranceTriggered: boolean; // déclencheur automatique de souffrance
  pdProxy: number; // PD indicative issue de la transformation logistique
  // Classe réglementaire injectée (issue du moteur de classification)
  regulatoryClass?: RegulatoryClassCode;
}

// =====================================================================
//  Classification réglementaire
// =====================================================================

export interface TriggerConfig {
  kind: TriggerKind;
  targetClass: RegulatoryClassCode;
  dpdMin?: number | null;
  dpdMax?: number | null;
  condition?: RuleExpression | null;
  priority: number;
  description?: string;
}

export interface ClassDefinition {
  code: RegulatoryClassCode;
  label: string;
  orderIndex: number; // sévérité croissante
  isWatchList: boolean;
  isDefault: boolean;
  blocksGo: boolean;
}

export interface RegulatoryRegimeConfig {
  code: string;
  name: string;
  classes: ClassDefinition[];
  triggers: TriggerConfig[];
  // Politique de restructuration appliquée (régit art.17-31 sous 1/W).
  restructuringPolicy?: "BKAM_1W" | "BKAM_19G" | "NONE";
}

// Contexte de restructuration (1/W/2025 art.17-31).
export interface RestructuringContext {
  restructured: boolean;
  count?: number; // nombre de restructurations
  viable?: boolean; // viabilité démontrée (art.18)
  deferralMonths?: number; // différé accordé (art.22)
  secondDuringObservation?: boolean; // 2nde restructuration en période d'obs (art.25)
  dpdOnRestructured?: number; // impayé sur créance restructurée (art.29)
}

// Qualité des données réglementaires (1/W §6.2 — données critiques manquantes).
export type DataQualityStatus = "COMPLETE" | "INCOMPLETE" | "INCOMPLETE_BLOCKING";

export interface DataQuality {
  status: DataQualityStatus;
  // Clés d'entrée critiques/importantes manquantes (non renseignées).
  missingCriticalData: string[];
}

export interface ClassificationResult {
  resultClass: RegulatoryClassCode;
  isWatchList: boolean;
  blocksGo: boolean;
  restructuringNote?: string;
  groupContagionClass?: RegulatoryClassCode;
  // Statut de complétude des données ayant servi à la classification.
  dataQuality: DataQuality;
  triggeredBy: Array<{
    kind: TriggerKind;
    targetClass: RegulatoryClassCode;
    reason: string;
  }>;
}

// =====================================================================
//  Garanties & provisionnement
// =====================================================================

export type AbatementProfile = "HYPOTHECAIRE" | "TITRES" | "VEHICULES" | "NONE";

export interface GuaranteeTypeConfig {
  code: string;
  label: string;
  eligible: boolean;
  quotity: number; // quotité réglementaire 1.0 | 0.8 | 0.5
  haircut: number; // décote interne additionnelle (0..1)
  abatementProfile: AbatementProfile; // abattement progressif art.41/21
  requiresRank1?: boolean;
}

export interface GuaranteeInput {
  typeCode: string;
  marketValue: number; // MAD
  rank?: number;
  yearsInSouffrance?: number; // ancienneté pour l'abattement
  recentlyEvaluated?: boolean; // évaluation récente (art.19/39)
}

export interface GuaranteeEligibilityLine {
  typeCode: string;
  marketValue: number;
  eligible: boolean;
  baseQuotity: number; // quotité réglementaire de base
  effectiveQuotity: number; // après abattement progressif
  haircut: number;
  abatementApplied: boolean;
  eligibleValue: number; // valeur retenue après quotité, abattement et haircut
  note?: string;
}

export interface GuaranteeEligibilityResult {
  lines: GuaranteeEligibilityLine[];
  totalEligible: number;
  // Vrai si l'exposition est intégralement couverte par des garanties 100%
  // → éligibilité au statut "créance irrégulière" (19/G art.4bis).
  fullyCoveredByTopTier: boolean;
}

export interface ProvisionInputExt extends ProvisionInput {
  isIrregular?: boolean;
}

// --- GFA / VEFA --------------------------------------------------------

export type SaleModeCode = "CLASSIC" | "VEFA";

export interface GfaVefaParams {
  saleMode: SaleModeCode;
  hasGFA: boolean;
  gfaAmount?: number | null;
  exposure: number; // EAD / assiette à couvrir (MAD)
  gfaEligible?: boolean; // établissement garant admis (défaut: true)
  // Abattement prudentiel d'une GFA hors cadre VEFA (défaut 25%).
  nonVefaHaircut?: number;
}

export interface GfaVefaResult {
  applicable: boolean; // une GFA opposable réduit l'assiette
  admittedValue: number; // valeur admise en déduction (MAD)
  quotity: number; // quotité retenue (0..1)
  cappedByExposure: boolean;
  note: string;
}

export interface ProvisionInput {
  ead: number; // exposure at default (MAD)
  reservedAgios?: number; // agios réservés (MAD)
  eligibleGuarantees: number; // garanties éligibles (MAD)
  classCode: RegulatoryClassCode;
  rate: number; // taux de provision (0..1)
}

export interface ProvisionResult {
  ead: number;
  reservedAgios: number;
  eligibleGuarantees: number;
  provisionBase: number; // max(0, EAD - agios - garanties)
  rate: number;
  provisionAmount: number;
  classCode: RegulatoryClassCode;
}
