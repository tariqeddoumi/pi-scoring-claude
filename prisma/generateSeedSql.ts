// Génère le SQL de seed (idempotent, IDs stables) à partir des MÊMES données de
// référence que prisma/seed.ts, pour application via Supabase MCP.
// Usage: tsx prisma/generateSeedSql.ts > seed.sql

import {
  PROMOTION_SCORING_MODEL,
  REGIME_19G_2002,
  REGIME_19G_PROVISION_RATES,
  REGIME_1W_2025,
  REGIME_1W_PROVISION_RATES,
  GUARANTEE_TYPES_19G,
  GUARANTEE_TYPES_1W,
} from "../lib/domain/referenceData";
import { ROLE_PERMISSIONS, ROLE_LABELS, PERMISSIONS } from "../lib/rbac";

const out: string[] = [];
const q = (s: unknown) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const j = (o: unknown) => (o === undefined ? "NULL" : `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`);
const n = (v: unknown) => (v === null || v === undefined ? "NULL" : Number(v));
const b = (v: boolean) => (v ? "true" : "false");
const arr = (a: string[]) => `ARRAY[${a.map(q).join(",")}]::text[]`;

out.push(`SET search_path TO "pi_scoring";`);
out.push(`-- Idempotence : on vide le schéma métier avant re-seed`);
out.push(`TRUNCATE "RolePermission","Permission","ScoringOption","ScoringRange","ScoringCriterion","RedFlagRule","ScoringDomain","ScoringModelVersion","ScoringModel","ProvisionRate","RegulatoryTrigger","GuaranteeType","RegulatoryClass","RegulatoryRegime","Guarantee","ProjectInput","RealEstateProject","Promoter","ClassificationRun","ProvisionRun","ScoringRun","CriterionResult","DomainResult","WorkflowStep","Comment","Attachment","AuditLog","ImportBatch","User","Role" RESTART IDENTITY CASCADE;`);

// --- RBAC ---
const permLabels: Record<string, string> = {
  "project.read": "Consulter les projets", "project.write": "Modifier les projets",
  "scoring.run": "Lancer un scoring", "scoring.validate": "Valider un scoring",
  "model.read": "Consulter le modèle", "model.write": "Administrer le modèle",
  "regime.read": "Consulter les régimes", "regime.write": "Administrer les régimes",
  "import.run": "Importer des données", "export.run": "Exporter des rapports",
  "audit.read": "Consulter l'audit", "admin.users": "Gérer les utilisateurs",
};
for (const code of Object.values(PERMISSIONS)) {
  out.push(`INSERT INTO "Permission"("id","code","label") VALUES (${q("perm_" + code)},${q(code)},${q(permLabels[code] ?? code)});`);
}
for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
  out.push(`INSERT INTO "Role"("id","name","label") VALUES (${q("role_" + roleName)},${q(roleName)}::"RoleName",${q(ROLE_LABELS[roleName as keyof typeof ROLE_LABELS])});`);
  for (const code of perms) {
    out.push(`INSERT INTO "RolePermission"("roleId","permissionId") VALUES (${q("role_" + roleName)},${q("perm_" + code)});`);
  }
}
const users: [string, string, string][] = [
  ["admin@bank.ma", "Amine Admin", "ADMIN"],
  ["analyst@bank.ma", "Rita Analyste", "RISK_ANALYST"],
  ["rm@bank.ma", "Karim Chargé d'affaires", "RELATIONSHIP_MANAGER"],
  ["manager@bank.ma", "Salma Manager", "MANAGER"],
  ["auditor@bank.ma", "Omar Auditeur", "AUDITOR"],
];
for (const [email, name, role] of users) {
  out.push(`INSERT INTO "User"("id","email","name","roleId","updatedAt") VALUES (${q("user_" + role)},${q(email)},${q(name)},${q("role_" + role)},now());`);
}

// --- Modèle de scoring ---
const cfg = PROMOTION_SCORING_MODEL;
out.push(`INSERT INTO "ScoringModel"("id","code","name","description") VALUES (${q("model_PI")},${q(cfg.modelCode)},${q("Scoring Promotion Immobilière")},${q("Modèle D1..D4 scorés + D5 alertes — échelle critère 1..10 (V2.0)")});`);
out.push(`INSERT INTO "ScoringModelVersion"("id","modelId","version","status","scoreScale","bamCoefficients","decisionThresholds","segmentAdjustments","zoneAdjustments","publishedAt") VALUES (${q("ver_1")},${q("model_PI")},${q(cfg.version)},'PUBLISHED',${cfg.scoreScale},${j(cfg.bamCoefficients)},${j(cfg.decisionThresholds)},${j(cfg.segmentAdjustments)},${j(cfg.zoneAdjustments)},now());`);
cfg.domains.forEach((d, di) => {
  out.push(`INSERT INTO "ScoringDomain"("id","versionId","code","name","weight","orderIndex") VALUES (${q("dom_" + d.code)},${q("ver_1")},${q(d.code)},${q(d.name)},${d.weight},${di});`);
  d.criteria.forEach((c, ci) => {
    out.push(`INSERT INTO "ScoringCriterion"("id","domainId","code","name","type","weight","inputKey","isGate","gateThreshold","orderIndex") VALUES (${q("crit_" + c.code)},${q("dom_" + d.code)},${q(c.code)},${q(c.name)},${q(c.type)}::"CriterionType",${c.weight},${q(c.inputKey)},${b(c.isGate)},${n(c.gateThreshold)},${ci});`);
    (c.options ?? []).forEach((o, oi) => {
      out.push(`INSERT INTO "ScoringOption"("id","criterionId","value","label","score","orderIndex") VALUES (${q("opt_" + c.code + "_" + o.value)},${q("crit_" + c.code)},${q(o.value)},${q(o.label)},${o.score},${oi});`);
    });
    (c.ranges ?? []).forEach((r, ri) => {
      out.push(`INSERT INTO "ScoringRange"("id","criterionId","minIncl","maxExcl","score","label","orderIndex") VALUES (${q("rng_" + c.code + "_" + ri)},${q("crit_" + c.code)},${n(r.minIncl)},${n(r.maxExcl)},${r.score},${q(r.label)},${ri});`);
    });
  });
});
cfg.redFlags.forEach((rf) => {
  out.push(`INSERT INTO "RedFlagRule"("id","versionId","code","name","rule","severity","impactDomains","malus","mitigable") VALUES (${q("rf_" + rf.code)},${q("ver_1")},${q(rf.code)},${q(rf.name)},${j(rf.rule)},${q(rf.severity)}::"Severity",${arr(rf.impactDomains)},${rf.malus},${b(rf.mitigable)});`);
});

// --- Régimes ---
function emitRegime(reg: typeof REGIME_19G_2002, rates: Record<string, number>, guarantees: typeof GUARANTEE_TYPES_19G, eff: string, active: boolean, hypThr: number) {
  const rid = "reg_" + reg.code;
  out.push(`INSERT INTO "RegulatoryRegime"("id","code","name","effectiveFrom","active","hypEvaluationThreshold","restructuringPolicy") VALUES (${q(rid)},${q(reg.code)},${q(reg.name)},${q(eff)}::timestamp,${b(active)},${hypThr},${q(reg.restructuringPolicy ?? "NONE")});`);
  reg.classes.forEach((c, i) => {
    const cid = rid + "_" + c.code;
    out.push(`INSERT INTO "RegulatoryClass"("id","regimeId","code","label","orderIndex","isWatchList","isDefault","blocksGo") VALUES (${q(cid)},${q(rid)},${q(c.code)}::"RegulatoryClassCode",${q(c.label)},${c.orderIndex ?? i},${b(c.isWatchList)},${b(c.isDefault)},${b(c.blocksGo)});`);
    out.push(`INSERT INTO "ProvisionRate"("id","regimeId","classId","rate","effectiveFrom") VALUES (${q("pr_" + cid)},${q(rid)},${q(cid)},${rates[c.code] ?? 0},${q(eff)}::timestamp);`);
  });
  reg.triggers.forEach((t, i) => {
    out.push(`INSERT INTO "RegulatoryTrigger"("id","regimeId","classId","kind","dpdMin","dpdMax","condition","priority","description") VALUES (${q(rid + "_trg_" + i)},${q(rid)},${q(rid + "_" + t.targetClass)},${q(t.kind)}::"TriggerKind",${n(t.dpdMin)},${n(t.dpdMax)},${j(t.condition ?? undefined)},${t.priority},${q(t.description)});`);
  });
  guarantees.forEach((g) => {
    out.push(`INSERT INTO "GuaranteeType"("id","regimeId","code","label","eligible","quotity","haircut","abatementProfile","requiresRank1") VALUES (${q(rid + "_" + g.code)},${q(rid)},${q(g.code)},${q(g.label)},${b(g.eligible)},${g.quotity},${g.haircut},${q(g.abatementProfile)},${b(g.requiresRank1 ?? false)});`);
  });
}
emitRegime(REGIME_19G_2002, REGIME_19G_PROVISION_RATES, GUARANTEE_TYPES_19G, "2002-12-23", false, 1_000_000);
emitRegime(REGIME_1W_2025, REGIME_1W_PROVISION_RATES, GUARANTEE_TYPES_1W, "2027-01-01", true, 5_000_000);

// --- Promoteurs & projets démo ---
out.push(`INSERT INTO "Promoter"("id","name","legalForm","groupName","yearsExperience","completedProjects","internalRating","updatedAt") VALUES (${q("promo_1")},${q("Atlas Développement SA")},'SA',${q("Groupe Atlas")},15,8,'BBB',now());`);
out.push(`INSERT INTO "Promoter"("id","name","legalForm","yearsExperience","completedProjects","internalRating","updatedAt") VALUES (${q("promo_2")},${q("Nouvelle Résidence SARL")},'SARL',3,1,'B',now());`);

out.push(`INSERT INTO "RealEstateProject"("id","reference","name","promoterId","rmId","city","region","projectType","segment","zone","groupId","totalUnits","landAreaSqm","builtAreaSqm","totalCost","loanAmount","ownEquity","status","updatedAt") VALUES (${q("proj_1")},'PI-2026-001',${q("Résidence Les Jardins de l'Atlas")},${q("promo_1")},${q("user_RELATIONSHIP_MANAGER")},'Casablanca','Casablanca-Settat',${q("Résidentiel haut standing")},'moyen_haut','casa_centre','GRP_ATLAS',120,8000,14000,180000000,110000000,70000000,'EN_ANALYSE',now());`);
out.push(`INSERT INTO "RealEstateProject"("id","reference","name","promoterId","rmId","city","region","projectType","segment","zone","totalUnits","landAreaSqm","builtAreaSqm","totalCost","loanAmount","ownEquity","status","updatedAt") VALUES (${q("proj_2")},'PI-2026-002',${q("Résidence Annour")},${q("promo_2")},${q("user_RELATIONSHIP_MANAGER")},'Marrakech','Marrakech-Safi',${q("Résidentiel social")},'intermediaire','marrakech',60,3000,4500,45000000,38000000,7000000,'EN_ANALYSE',now());`);

const p1: Record<string, any> = {
  promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire", mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
  land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard", progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible", land_cost_ratio: 22,
  pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0, stock_rotation_months: 16, stressed_margin_pct: 18,
  gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
  dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
};
const p2: Record<string, any> = {
  promoter_completed_projects: 1, promoter_gearing: 160, governance_quality: "partielle", mono_project_concentration: 70, promoter_type: "opportuniste", equity_injected_ratio: 70,
  land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne", progress_vs_plan: 75, sav_litigation: "moyen", macro_sensitivity: "elevee", land_cost_ratio: 32,
  pre_sale_rate: 18, sales_vs_plan: 70, dso_days: 260, cash_coverage: 0.85, funding_gap_pct: 15, stock_rotation_months: 32, stressed_margin_pct: 9,
  gross_margin_pct: 13, ltc: 84, ltv_stressed: 88, guarantee_coverage: 60, first_rank: "non", interest_coverage: 1.2,
  dpd_days: 110, construction_delay_months: 8, project_stopped_months: 0, restructured: "yes", restructuring_count: 1, restructuring_deferral_months: 12, legal_exposure: "watch",
  funding_gap_persistent: true, commercialization_below_50_1y: true, construction_delay_over_1y: false,
};
function emitInputs(proj: string, inputs: Record<string, any>) {
  Object.entries(inputs).forEach(([k, v], i) => {
    const num = typeof v === "number" ? v : "NULL";
    const str = typeof v === "string" ? q(v) : "NULL";
    const bool = typeof v === "boolean" ? b(v) : "NULL";
    out.push(`INSERT INTO "ProjectInput"("id","projectId","key","valueNum","valueStr","valueBool","updatedAt") VALUES (${q(proj + "_in_" + i)},${q(proj)},${q(k)},${num},${str},${bool},now());`);
  });
}
emitInputs("proj_1", p1);
emitInputs("proj_2", p2);

// Garanties (régime 19/G actif au moment de la démo de garanties)
const rid19 = "reg_BKAM_19G_2002";
out.push(`INSERT INTO "Guarantee"("id","projectId","typeId","description","marketValue","rank","recentlyEvaluated") VALUES (${q("gar_1")},${q("proj_1")},${q(rid19 + "_HYP_RANG1")},${q("Hypothèque 1er rang sur le foncier")},120000000,1,true);`);
out.push(`INSERT INTO "Guarantee"("id","projectId","typeId","description","marketValue","rank","recentlyEvaluated") VALUES (${q("gar_2")},${q("proj_1")},${q(rid19 + "_GARANTIE_BANCAIRE")},${q("Garantie bancaire de premier ordre")},20000000,1,true);`);
out.push(`INSERT INTO "Guarantee"("id","projectId","typeId","description","marketValue","rank","recentlyEvaluated") VALUES (${q("gar_3")},${q("proj_2")},${q(rid19 + "_HYP_RANG1")},${q("Hypothèque foncier")},28000000,2,true);`);

process.stdout.write(out.join("\n") + "\n");
