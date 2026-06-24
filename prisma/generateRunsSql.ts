// Génère le SQL de seed TRANSACTIONNEL (runs de scoring/classification/
// provisionnement + workflow + commentaires + audit) pour les projets de
// démonstration, en calculant les résultats avec les MÊMES moteurs purs que
// l'application (aucune valeur codée en dur). Idempotent (IDs stables).
// Usage: tsx prisma/generateRunsSql.ts > prisma/seed.runs.generated.sql
//
// Le régime actif (active=true, effectiveFrom le plus récent) est 1/W/2025 :
// c'est lui que loadActiveRegime sélectionne, donc celui utilisé ici.

import {
  PROMOTION_SCORING_MODEL,
  REGIME_1W_2025,
  REGIME_1W_PROVISION_RATES,
  GUARANTEE_TYPES_1W,
} from "../lib/domain/referenceData";
import { runScoring } from "../server/engines/scoringEngine";
import { classify } from "../server/engines/regulatoryClassificationEngine";
import { computeEligibleGuarantees } from "../server/engines/guaranteeEligibilityEngine";
import { computeProvision } from "../server/engines/provisioningEngine";
import type { GuaranteeInput, ProjectInputs } from "../lib/domain/types";

const out: string[] = [];
const q = (s: unknown) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const j = (o: unknown) => (o === undefined || o === null ? "NULL" : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`);
const n = (v: unknown) => (v === null || v === undefined ? "NULL" : Number(v));
const b = (v: boolean) => (v ? "true" : "false");

// ---------------------------------------------------------------------
//  Entrées des projets démo (identiques à prisma/seed.ts / generateSeedSql)
// ---------------------------------------------------------------------
const p1Inputs: ProjectInputs = {
  promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire", mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
  land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard", progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible", land_cost_ratio: 22,
  pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0, stock_rotation_months: 16, stressed_margin_pct: 18,
  gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
  dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
};
const p2Inputs: ProjectInputs = {
  promoter_completed_projects: 1, promoter_gearing: 160, governance_quality: "partielle", mono_project_concentration: 70, promoter_type: "opportuniste", equity_injected_ratio: 70,
  land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne", progress_vs_plan: 75, sav_litigation: "moyen", macro_sensitivity: "elevee", land_cost_ratio: 32,
  pre_sale_rate: 18, sales_vs_plan: 70, dso_days: 260, cash_coverage: 0.85, funding_gap_pct: 15, stock_rotation_months: 32, stressed_margin_pct: 9,
  gross_margin_pct: 13, ltc: 84, ltv_stressed: 88, guarantee_coverage: 60, first_rank: "non", interest_coverage: 1.2,
  dpd_days: 110, construction_delay_months: 8, project_stopped_months: 0, restructured: "yes", restructuring_count: 1, restructuring_deferral_months: 12, legal_exposure: "watch",
  funding_gap_persistent: true, commercialization_below_50_1y: true, construction_delay_over_1y: false,
};

interface DemoProject {
  projId: string;
  inputs: ProjectInputs;
  segment: string;
  zone: string;
  loanAmount: number;
  guarantees: GuaranteeInput[];
}

// Garanties seedées (cf. generateSeedSql.ts). Les codes sont communs aux deux
// régimes ; computeEligibleGuarantees résout via le type du régime ACTIF (1/W).
const demos: DemoProject[] = [
  {
    projId: "proj_1", inputs: p1Inputs, segment: "moyen_haut", zone: "casa_centre", loanAmount: 110_000_000,
    guarantees: [
      { typeCode: "HYP_RANG1", marketValue: 120_000_000, rank: 1, yearsInSouffrance: 0, recentlyEvaluated: true },
      { typeCode: "GARANTIE_BANCAIRE", marketValue: 20_000_000, rank: 1, yearsInSouffrance: 0, recentlyEvaluated: true },
    ],
  },
  {
    projId: "proj_2", inputs: p2Inputs, segment: "intermediaire", zone: "marrakech", loanAmount: 38_000_000,
    guarantees: [
      { typeCode: "HYP_RANG1", marketValue: 28_000_000, rank: 2, yearsInSouffrance: 0, recentlyEvaluated: true },
    ],
  },
];

const regimeId = "reg_BKAM_1W_2025";
const versionId = "ver_1";
const analyst = "user_RISK_ANALYST";
const manager = "user_MANAGER";

out.push(`SET search_path TO "pi_scoring";`);
out.push(`-- Idempotence : purge des tables transactionnelles avant re-seed des runs`);
out.push(`TRUNCATE "CriterionResult","DomainResult","ProvisionRun","ClassificationRun","ScoringRun","WorkflowStep","Comment","AuditLog" RESTART IDENTITY CASCADE;`);

for (const d of demos) {
  // 1. Classification (régime actif 1/W) — restructuration depuis les entrées
  const restructuring = {
    restructured: d.inputs.restructured === "yes",
    count: typeof d.inputs.restructuring_count === "number" ? d.inputs.restructuring_count : undefined,
    deferralMonths: typeof d.inputs.restructuring_deferral_months === "number" ? d.inputs.restructuring_deferral_months : undefined,
  };
  const classification = classify({ regime: REGIME_1W_2025, inputs: d.inputs, restructuring });

  // 2. Scoring (segment/zone + classe réglementaire + règle CTX)
  const scoring = runScoring({
    model: PROMOTION_SCORING_MODEL,
    inputs: d.inputs,
    segment: d.segment,
    zone: d.zone,
    regulatoryClass: classification.resultClass,
    classBlocksGo: classification.blocksGo,
  });

  // 3. Garanties éligibles + provisionnement
  const elig = computeEligibleGuarantees({
    guarantees: d.guarantees,
    types: GUARANTEE_TYPES_1W,
    hypEvaluationThreshold: 5_000_000,
  });
  const rate = REGIME_1W_PROVISION_RATES[classification.resultClass] ?? 0;
  const isDefault = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"].includes(classification.resultClass);
  const provision = computeProvision({
    ead: d.loanAmount,
    reservedAgios: 0,
    eligibleGuarantees: elig.totalEligible,
    classCode: classification.resultClass,
    rate,
    isIrregular: isDefault && elig.fullyCoveredByTopTier,
  });

  const runId = `run_${d.projId}`;
  const classId = `class_${d.projId}`;
  const provId = `prov_${d.projId}`;

  // --- ScoringRun ---
  out.push(`INSERT INTO "ScoringRun"("id","projectId","versionId","runById","status","inputSnapshot","scoreTechnique","scoreAfterPenalties","coeffBAM","scoreFinal","decision","triggeredRedFlags","gateBlocked","updatedAt") VALUES (${q(runId)},${q(d.projId)},${q(versionId)},${q(analyst)},'COMPLETED'::"ScoringRunStatus",${j(d.inputs)},${scoring.scoreTechnique},${scoring.scoreAfterPenalties},${scoring.coeffBAM},${scoring.scoreFinal},${q(scoring.decision)}::"Decision",${j(scoring.redFlags)},${b(scoring.gateBlocked)},now());`);

  // --- CriterionResult ---
  scoring.criteria.forEach((c, i) => {
    out.push(`INSERT INTO "CriterionResult"("id","runId","criterionId","rawValue","score","weighted","matchedRef","gateBlocked") VALUES (${q(runId + "_cr_" + i)},${q(runId)},${q("crit_" + c.criterionCode)},${c.rawValue == null ? "NULL" : q(String(c.rawValue))},${c.score},${c.weighted},${q(c.matchedRef)},${b(c.gateBlocked)});`);
  });

  // --- DomainResult ---
  scoring.domains.forEach((dm) => {
    out.push(`INSERT INTO "DomainResult"("id","runId","domainId","score","weighted") VALUES (${q(runId + "_dr_" + dm.domainCode)},${q(runId)},${q("dom_" + dm.domainCode)},${dm.score},${dm.weighted});`);
  });

  // --- ClassificationRun ---
  out.push(`INSERT INTO "ClassificationRun"("id","projectId","regimeId","scoringRunId","resultClass","isWatchList","groupContagionClass","restructuringNote","triggeredBy","inputSnapshot") VALUES (${q(classId)},${q(d.projId)},${q(regimeId)},${q(runId)},${q(classification.resultClass)}::"RegulatoryClassCode",${b(classification.isWatchList)},${classification.groupContagionClass ? q(classification.groupContagionClass) + '::"RegulatoryClassCode"' : "NULL"},${q(classification.restructuringNote)},${j(classification.triggeredBy)},${j(d.inputs)});`);

  // --- ProvisionRun ---
  out.push(`INSERT INTO "ProvisionRun"("id","projectId","classificationRunId","ead","reservedAgios","eligibleGuarantees","guaranteeBreakdown","provisionBase","rate","provisionAmount","classCode","isIrregular") VALUES (${q(provId)},${q(d.projId)},${q(classId)},${provision.ead},${provision.reservedAgios},${provision.eligibleGuarantees},${j(elig.lines)},${provision.provisionBase},${provision.rate},${provision.provisionAmount},${q(provision.classCode)}::"RegulatoryClassCode",${b(provision.isIrregular)});`);

  // --- Audit (CALCULATE / CLASSIFY / PROVISION), comme scoringService ---
  out.push(`INSERT INTO "AuditLog"("id","actorId","action","entity","entityId","after","metadata") VALUES (${q(runId + "_al_calc")},${q(analyst)},'CALCULATE'::"AuditAction",'ScoringRun',${q(runId)},${j({ scoreFinal: scoring.scoreFinal, decision: scoring.decision, gateBlocked: scoring.gateBlocked })},${j({ projectId: d.projId, version: PROMOTION_SCORING_MODEL.version })});`);
  out.push(`INSERT INTO "AuditLog"("id","actorId","action","entity","entityId","after","metadata") VALUES (${q(runId + "_al_class")},${q(analyst)},'CLASSIFY'::"AuditAction",'ClassificationRun',${q(classId)},${j({ resultClass: classification.resultClass, regime: REGIME_1W_2025.code })},${j({ projectId: d.projId })});`);
  out.push(`INSERT INTO "AuditLog"("id","actorId","action","entity","entityId","after","metadata") VALUES (${q(runId + "_al_prov")},${q(analyst)},'PROVISION'::"AuditAction",'ProvisionRun',${q(provId)},${j({ provisionAmount: provision.provisionAmount, rate, ead: provision.ead })},${j({ projectId: d.projId, classCode: classification.resultClass })});`);

  // --- Workflow (DRAFT -> SUBMITTED -> ANALYST_REVIEW) ---
  out.push(`INSERT INTO "WorkflowStep"("id","projectId","fromState","toState","actorId","comment") VALUES (${q(d.projId + "_ws_1")},${q(d.projId)},NULL,'SUBMITTED'::"WorkflowState",${q(manager)},${q("Dossier soumis pour analyse")});`);
  out.push(`INSERT INTO "WorkflowStep"("id","projectId","fromState","toState","actorId","comment") VALUES (${q(d.projId + "_ws_2")},${q(d.projId)},'SUBMITTED'::"WorkflowState",'ANALYST_REVIEW'::"WorkflowState",${q(analyst)},${q("Prise en charge analyse risque")});`);

  // --- Commentaire analyste contextualisé sur la décision ---
  const note = `Scoring ${scoring.scoreFinal}/100 → ${scoring.decision} ; classe BKAM ${classification.resultClass}` + (provision.provisionAmount > 0 ? ` ; provision ${Math.round(provision.provisionAmount).toLocaleString("fr-FR")} MAD.` : ` ; pas de provision requise.`);
  out.push(`INSERT INTO "Comment"("id","projectId","authorId","body","section") VALUES (${q(d.projId + "_cm_1")},${q(d.projId)},${q(analyst)},${q(note)},'synthese');`);
}

process.stdout.write(out.join("\n") + "\n");
