// Génère un portefeuille de DÉMONSTRATION enrichi (additif, idempotent) :
// ~10 dossiers avec une PROFONDEUR HISTORIQUE (3 classifications datées chacun)
// pour alimenter la matrice de migration, la vue risque, la file d'attente et
// le circuit de comité. Tous les résultats sont calculés avec les MÊMES moteurs
// purs que l'application (aucune valeur codée en dur).
//
// Idempotence : préfixe d'IDs `demo_` / `dpromo_` purgé en tête. N'affecte PAS
// les dossiers proj_1 / proj_2 du seed de base.
//
// Usage: tsx prisma/generateDemoPortfolioSql.ts > prisma/seed.demo.generated.sql

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
import type { ProjectInputs, RegulatoryClassCode } from "../lib/domain/types";

const out: string[] = [];
// SLIM=1 : omet les détails non requis par les écrans de démo (CriterionResult,
// DomainResult, ProjectInput) pour produire un script applicable via MCP.
const SLIM = process.env.SLIM === "1";
const q = (s: unknown) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const j = (o: unknown) => (o === undefined || o === null ? "NULL" : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`);
// En mode SLIM, les gros snapshots JSON (non lus par les écrans de démo) sont vidés.
const J = (o: unknown) => (SLIM ? "'{}'::jsonb" : j(o));
const b = (v: boolean) => (v ? "true" : "false");
const ts = (d: string) => `'${d}'::timestamp`;

const versionId = "ver_1";
const regimeId = "reg_BKAM_1W_2025";
const analyst = "user_RISK_ANALYST";
const manager = "user_MANAGER";
const rm = "user_RELATIONSHIP_MANAGER";

// Profil de base SAIN complet (toutes les clés requises par les moteurs).
const BASE: ProjectInputs = {
  promoter_completed_projects: 6, promoter_gearing: 95, governance_quality: "claire", mono_project_concentration: 40, promoter_type: "structure", equity_injected_ratio: 95,
  land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard", progress_vs_plan: 95, sav_litigation: "faible", macro_sensitivity: "moyenne", land_cost_ratio: 24,
  pre_sale_rate: 55, sales_vs_plan: 95, dso_days: 100, cash_coverage: 1.25, funding_gap_pct: 0, stock_rotation_months: 18, stressed_margin_pct: 16,
  gross_margin_pct: 25, ltc: 65, ltv_stressed: 70, guarantee_coverage: 115, first_rank: "oui", interest_coverage: 2.8,
  dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
};

// Leviers déterministes amenant la classification 1/W vers une classe cible.
function levers(cls: RegulatoryClassCode): Partial<ProjectInputs> {
  const clear: Partial<ProjectInputs> = {
    dpd_days: 0,
    commercialization_below_50_1y: false,
    construction_delay_over_1y: false,
    legal_exposure: "clear",
    restructured: "no",
  };
  switch (cls) {
    case "SAIN": return clear;
    case "SENSIBLE": return { ...clear, commercialization_below_50_1y: true };
    case "PRE_DOUTEUX": return { ...clear, dpd_days: 120 };
    case "DOUTEUX": return { ...clear, dpd_days: 200 };
    case "COMPROMIS": return { ...clear, dpd_days: 400 };
    case "CTX": return { ...clear, dpd_days: 200, legal_exposure: "litigation" };
    default: return clear;
  }
}

type FinalState = "ANALYST_REVIEW" | "MANAGER_VALIDATION" | "COMMITTEE" | "APPROVED" | "REJECTED";

interface Demo {
  id: string;
  ref: string;
  name: string;
  promoterId: string;
  city: string;
  region: string;
  segment: string;
  zone: string;
  loanAmount: number;
  trajectory: [RegulatoryClassCode, RegulatoryClassCode, RegulatoryClassCode]; // T0 → T1 → T2
  finalState: FinalState;
  saleMode?: "CLASSIC" | "VEFA";
  gfa?: { amount: number; provider: string };
}

// 4 promoteurs de démo.
const promoters: [string, string, string, string][] = [
  ["dpromo_1", "Compagnie Foncière du Détroit", "SA", "Groupe Détroit"],
  ["dpromo_2", "Résidences Andalous SARL", "SARL", ""],
  ["dpromo_3", "Immobilière Souss Invest", "SA", "Groupe Souss"],
  ["dpromo_4", "Habitat Atlantique SARL", "SARL", ""],
];

// Trois dates de snapshot (ascendant : la dernière est la plus récente).
const DATES = ["2025-06-30", "2025-12-31", "2026-06-15"];

const demos: Demo[] = [
  { id: "demo_p3", ref: "PI-2026-101", name: "Tranche Verdure", promoterId: "dpromo_1", city: "Casablanca", region: "Casablanca-Settat", segment: "moyen_haut", zone: "casa_centre", loanAmount: 95_000_000, trajectory: ["SAIN", "SAIN", "SAIN"], finalState: "APPROVED", saleMode: "VEFA", gfa: { amount: 60_000_000, provider: "Wafa Assurance" } },
  { id: "demo_p4", ref: "PI-2026-102", name: "Les Oliviers", promoterId: "dpromo_2", city: "Rabat", region: "Rabat-Salé-Kénitra", segment: "intermediaire", zone: "rabat_centre", loanAmount: 52_000_000, trajectory: ["SAIN", "SENSIBLE", "PRE_DOUTEUX"], finalState: "MANAGER_VALIDATION", saleMode: "CLASSIC", gfa: { amount: 30_000_000, provider: "BMCE Garanties" } },
  { id: "demo_p5", ref: "PI-2026-103", name: "Marina Bleue", promoterId: "dpromo_3", city: "Agadir", region: "Souss-Massa", segment: "touristique", zone: "agadir", loanAmount: 130_000_000, trajectory: ["SAIN", "DOUTEUX", "COMPROMIS"], finalState: "REJECTED" },
  { id: "demo_p6", ref: "PI-2026-104", name: "Riad El Fath", promoterId: "dpromo_4", city: "Marrakech", region: "Marrakech-Safi", segment: "intermediaire", zone: "marrakech", loanAmount: 41_000_000, trajectory: ["DOUTEUX", "PRE_DOUTEUX", "SENSIBLE"], finalState: "COMMITTEE" },
  { id: "demo_p7", ref: "PI-2026-105", name: "Cèdres Business", promoterId: "dpromo_1", city: "Fès", region: "Fès-Meknès", segment: "bureaux", zone: "fes_oriental", loanAmount: 68_000_000, trajectory: ["SENSIBLE", "SENSIBLE", "SAIN"], finalState: "APPROVED" },
  { id: "demo_p8", ref: "PI-2026-106", name: "Ocean View", promoterId: "dpromo_3", city: "Tanger", region: "Tanger-Tétouan-Al Hoceïma", segment: "moyen_haut", zone: "tanger", loanAmount: 87_000_000, trajectory: ["SAIN", "SAIN", "SENSIBLE"], finalState: "COMMITTEE", saleMode: "VEFA", gfa: { amount: 50_000_000, provider: "CDG Capital" } },
  { id: "demo_p9", ref: "PI-2026-107", name: "Atlas Park", promoterId: "dpromo_2", city: "Casablanca", region: "Casablanca-Settat", segment: "commerces", zone: "casa_peripherie", loanAmount: 60_000_000, trajectory: ["SENSIBLE", "PRE_DOUTEUX", "DOUTEUX"], finalState: "COMMITTEE" },
  { id: "demo_p10", ref: "PI-2026-108", name: "Médina Lofts", promoterId: "dpromo_4", city: "Marrakech", region: "Marrakech-Safi", segment: "villas", zone: "marrakech", loanAmount: 33_000_000, trajectory: ["DOUTEUX", "COMPROMIS", "CTX"], finalState: "REJECTED" },
  { id: "demo_p11", ref: "PI-2026-109", name: "Green Valley", promoterId: "dpromo_3", city: "Rabat", region: "Rabat-Salé-Kénitra", segment: "intermediaire", zone: "rabat_peripherie", loanAmount: 47_000_000, trajectory: ["PRE_DOUTEUX", "SENSIBLE", "SAIN"], finalState: "MANAGER_VALIDATION" },
  { id: "demo_p12", ref: "PI-2026-110", name: "Zénith Towers", promoterId: "dpromo_1", city: "Casablanca", region: "Casablanca-Settat", segment: "moyen_haut", zone: "casa_centre", loanAmount: 105_000_000, trajectory: ["SENSIBLE", "SENSIBLE", "SENSIBLE"], finalState: "ANALYST_REVIEW" },
];

// --- Purge idempotente du périmètre démo ---
out.push(`SET search_path TO "pi_scoring";`);
out.push(`DELETE FROM "AuditLog" WHERE id LIKE 'demo_%';`);
out.push(`DELETE FROM "RealEstateProject" WHERE id LIKE 'demo_%';`);
out.push(`DELETE FROM "Promoter" WHERE id LIKE 'dpromo_%';`);

// --- Promoteurs ---
for (const [id, name, form, group] of promoters) {
  const grp = group ? q(group) : "NULL";
  out.push(`INSERT INTO "Promoter"("id","name","legalForm","groupName","yearsExperience","completedProjects","internalRating","updatedAt") VALUES (${q(id)},${q(name)},${q(form)},${grp},10,5,'BBB',now());`);
}

function inputsFor(d: Demo, cls: RegulatoryClassCode): ProjectInputs {
  return { ...BASE, ...levers(cls) } as ProjectInputs;
}

function emitRun(d: Demo, snap: number, cls: RegulatoryClassCode, date: string) {
  const inputs = inputsFor(d, cls);
  const restructuring = { restructured: inputs.restructured === "yes" };
  const classification = classify({ regime: REGIME_1W_2025, inputs, restructuring });
  const scoring = runScoring({
    model: PROMOTION_SCORING_MODEL,
    inputs,
    segment: d.segment,
    zone: d.zone,
    regulatoryClass: classification.resultClass,
    classBlocksGo: classification.blocksGo,
  });
  const guarantees = [{ typeCode: "HYP_RANG1", marketValue: Math.round(d.loanAmount * 1.1), rank: 1 as const, yearsInSouffrance: 0, recentlyEvaluated: true }];
  const elig = computeEligibleGuarantees({ guarantees, types: GUARANTEE_TYPES_1W, hypEvaluationThreshold: 5_000_000 });
  const rate = REGIME_1W_PROVISION_RATES[classification.resultClass] ?? 0;
  const isDefault = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"].includes(classification.resultClass);
  const provision = computeProvision({
    ead: d.loanAmount, reservedAgios: 0, eligibleGuarantees: elig.totalEligible,
    classCode: classification.resultClass, rate, isIrregular: isDefault && elig.fullyCoveredByTopTier,
  });

  const runId = `${d.id}_r${snap}`;
  const classId = `${d.id}_c${snap}`;
  const provId = `${d.id}_v${snap}`;

  out.push(`INSERT INTO "ScoringRun"("id","projectId","versionId","runById","status","inputSnapshot","scoreTechnique","scoreAfterPenalties","coeffBAM","scoreFinal","decision","triggeredRedFlags","gateBlocked","createdAt","updatedAt") VALUES (${q(runId)},${q(d.id)},${q(versionId)},${q(analyst)},'COMPLETED'::"ScoringRunStatus",${J(inputs)},${scoring.scoreTechnique},${scoring.scoreAfterPenalties},${scoring.coeffBAM},${scoring.scoreFinal},${q(scoring.decision)}::"Decision",${J(scoring.redFlags)},${b(scoring.gateBlocked)},${ts(date)},${ts(date)});`);
  if (!SLIM) {
    scoring.criteria.forEach((c, i) => {
      out.push(`INSERT INTO "CriterionResult"("id","runId","criterionId","rawValue","score","weighted","matchedRef","gateBlocked") VALUES (${q(runId + "_cr_" + i)},${q(runId)},${q("crit_" + c.criterionCode)},${c.rawValue == null ? "NULL" : q(String(c.rawValue))},${c.score},${c.weighted},${q(c.matchedRef)},${b(c.gateBlocked)});`);
    });
    scoring.domains.forEach((dm) => {
      out.push(`INSERT INTO "DomainResult"("id","runId","domainId","score","weighted") VALUES (${q(runId + "_dr_" + dm.domainCode)},${q(runId)},${q("dom_" + dm.domainCode)},${dm.score},${dm.weighted});`);
    });
  }
  out.push(`INSERT INTO "ClassificationRun"("id","projectId","regimeId","scoringRunId","resultClass","isWatchList","groupContagionClass","restructuringNote","triggeredBy","inputSnapshot","createdAt") VALUES (${q(classId)},${q(d.id)},${q(regimeId)},${q(runId)},${q(classification.resultClass)}::"RegulatoryClassCode",${b(classification.isWatchList)},${classification.groupContagionClass ? q(classification.groupContagionClass) + '::"RegulatoryClassCode"' : "NULL"},${q(classification.restructuringNote)},${J(classification.triggeredBy)},${J(inputs)},${ts(date)});`);
  out.push(`INSERT INTO "ProvisionRun"("id","projectId","classificationRunId","ead","reservedAgios","eligibleGuarantees","guaranteeBreakdown","provisionBase","rate","provisionAmount","classCode","isIrregular","createdAt") VALUES (${q(provId)},${q(d.id)},${q(classId)},${provision.ead},${provision.reservedAgios},${provision.eligibleGuarantees},${J(elig.lines)},${provision.provisionBase},${provision.rate},${provision.provisionAmount},${q(provision.classCode)}::"RegulatoryClassCode",${b(provision.isIrregular)},${ts(date)});`);

  return { classification, scoring, provision };
}

// Chaîne d'étapes workflow jusqu'à l'état final.
const WF_CHAIN: { from: string | null; to: string; actor: string; comment: string }[] = [
  { from: null, to: "SUBMITTED", actor: rm, comment: "Dossier soumis pour analyse" },
  { from: "SUBMITTED", to: "ANALYST_REVIEW", actor: analyst, comment: "Prise en charge analyse risque" },
  { from: "ANALYST_REVIEW", to: "MANAGER_VALIDATION", actor: analyst, comment: "Transmission au responsable" },
  { from: "MANAGER_VALIDATION", to: "COMMITTEE", actor: manager, comment: "Passage en comité de crédit" },
];

function emitWorkflow(d: Demo) {
  // Détermine la profondeur de la chaîne selon l'état final.
  const order = ["SUBMITTED", "ANALYST_REVIEW", "MANAGER_VALIDATION", "COMMITTEE", "APPROVED", "REJECTED"];
  const targetIdx = order.indexOf(d.finalState);
  const base = new Date("2026-06-16T09:00:00Z").getTime();
  let step = 0;
  const dateAt = () => new Date(base + step * 3600_000).toISOString();

  for (const s of WF_CHAIN) {
    if (order.indexOf(s.to) > Math.min(targetIdx, order.indexOf("COMMITTEE"))) break;
    out.push(`INSERT INTO "WorkflowStep"("id","projectId","fromState","toState","actorId","comment","createdAt") VALUES (${q(d.id + "_ws_" + step)},${q(d.id)},${s.from ? q(s.from) + '::"WorkflowState"' : "NULL"},${q(s.to)}::"WorkflowState",${q(s.actor)},${q(s.comment)},${ts(dateAt())});`);
    step++;
  }

  // Décision finale de comité (APPROVED / REJECTED).
  if (d.finalState === "APPROVED" || d.finalState === "REJECTED") {
    const favorable = d.finalState === "APPROVED";
    out.push(`INSERT INTO "WorkflowStep"("id","projectId","fromState","toState","actorId","comment","createdAt") VALUES (${q(d.id + "_ws_" + step)},${q(d.id)},'COMMITTEE'::"WorkflowState",${q(d.finalState)}::"WorkflowState",${q(manager)},${q(favorable ? "Décision comité : FAVORABLE" : "Décision comité : DEFAVORABLE")},${ts(dateAt())});`);
    step++;
    const outcome = favorable ? "FAVORABLE_CONDITIONS" : "DEFAVORABLE";
    const votesFor = favorable ? 3 : 1;
    const votesAgainst = favorable ? 1 : 3;
    out.push(`INSERT INTO "CommitteeDecision"("id","projectId","outcome","chairId","quorum","presentCount","votesFor","votesAgainst","votesAbstain","approvedAmount","conditions","minutesRef","createdAt") VALUES (${q(d.id + "_cd")},${q(d.id)},${q(outcome)}::"CommitteeOutcome",${q(manager)},4,4,${votesFor},${votesAgainst},0,${favorable ? d.loanAmount : "NULL"},${favorable ? q("Sûretés réévaluées + pré-commercialisation ≥ 50% avant déblocage") : "NULL"},${q("PV-COMITE-2026-" + d.ref.slice(-3))},${ts(dateAt())});`);
  }
}

for (const d of demos) {
  // 1. Projet (entrées = dernier snapshot pour refléter l'état courant).
  const latest = inputsFor(d, d.trajectory[2]);
  const ownEquity = Math.round(d.loanAmount * 0.35);
  const totalCost = d.loanAmount + ownEquity;
  const saleMode = d.saleMode ?? "CLASSIC";
  const hasGfa = d.gfa ? true : false;
  const gfaAmount = d.gfa ? d.gfa.amount : "NULL";
  const gfaProvider = d.gfa ? q(d.gfa.provider) : "NULL";
  out.push(`INSERT INTO "RealEstateProject"("id","reference","name","promoterId","rmId","city","region","projectType","segment","zone","totalUnits","landAreaSqm","builtAreaSqm","totalCost","loanAmount","ownEquity","saleMode","hasGFA","gfaAmount","gfaProvider","status","updatedAt") VALUES (${q(d.id)},${q(d.ref)},${q(d.name)},${q(d.promoterId)},${q(rm)},${q(d.city)},${q(d.region)},${q("Promotion résidentielle")},${q(d.segment)},${q(d.zone)},80,5000,8000,${totalCost},${d.loanAmount},${ownEquity},${q(saleMode)}::"SaleMode",${b(hasGfa)},${gfaAmount},${gfaProvider},'EN_ANALYSE',now());`);
  if (!SLIM) {
    Object.entries(latest).forEach(([k, v], i) => {
      const num = typeof v === "number" ? v : "NULL";
      const str = typeof v === "string" ? q(v) : "NULL";
      const bool = typeof v === "boolean" ? b(v) : "NULL";
      out.push(`INSERT INTO "ProjectInput"("id","projectId","key","valueNum","valueStr","valueBool","updatedAt") VALUES (${q(d.id + "_in_" + i)},${q(d.id)},${q(k)},${num},${str},${bool},now());`);
    });
  }
  out.push(`INSERT INTO "Guarantee"("id","projectId","typeId","description","marketValue","rank","recentlyEvaluated") VALUES (${q(d.id + "_gar")},${q(d.id)},${q(regimeId + "_HYP_RANG1")},${q("Hypothèque 1er rang sur le foncier")},${Math.round(d.loanAmount * 1.1)},1,true);`);

  // 2. Trois runs datés (profondeur historique pour la matrice de migration).
  d.trajectory.forEach((cls, snap) => emitRun(d, snap, cls, DATES[snap]!));

  // 3. Workflow + décision de comité.
  emitWorkflow(d);
}

process.stdout.write(out.join("\n") + "\n");
