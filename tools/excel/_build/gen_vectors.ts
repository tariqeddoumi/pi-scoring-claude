import fs from "node:fs";
import { runScoring } from "@/server/engines/scoringEngine";
import { CURRENT_PROMOTION_MODEL } from "@/lib/domain/models/current";
import type { ProjectInputs, RegulatoryClassCode } from "@/lib/domain/types";

// Cas de référence de l'outil Excel, calculés par le moteur de production sur le
// modèle publié (instantané prisma/models/PI_PROMOTION_v4.0.0.json).
const D = "tools/excel/_build/";
const model = CURRENT_PROMOTION_MODEL;

const base: ProjectInputs = {
  promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire", mono_project_concentration: 35,
  promoter_type: "structure", equity_injected_ratio: 100, land_permits_status: "definitives", market_positioning: "aligne",
  technical_complexity: "standard", progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible",
  land_cost_ratio: 22, authorization_completeness_pct: 100,
  pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0, stock_rotation_months: 16,
  stressed_margin_pct: 18, secured_sales_rate: 55,
  gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2, release_quotity_gap_pts: 5,
  dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
  equity_negative: false, funding_gap_persistent: false, works_authorization_blocked: false,
  buyers_financing_at_risk: false, release_underpriced: false, division_limit_breach: false,
  // v5 : régionalité, tranche, programme mixte, équipements, déblocages
  regional_market_tension: "porteur", tranche_dependency: "programme_entier", contractor_quality: "qualifiee_garantie",
  slow_liquidity_share_pct: 5, cancellation_rate_pct: 3, equipment_unbudgeted_pct: 0, drawdown_vs_progress_pct: 98, cost_overrun_pct: 2,
  component_exit_unsecured: false, equipment_delivery_at_risk: false, drawdown_ahead_of_works: false, drawdown_schedule_late: false,
};
const mid: ProjectInputs = { ...base, promoter_completed_projects: 2, promoter_gearing: 120, governance_quality: "partielle", mono_project_concentration: 50,
  promoter_type: "regional", equity_injected_ratio: 90, land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne",
  progress_vs_plan: 90, sav_litigation: "moyen", macro_sensitivity: "moyenne", land_cost_ratio: 30, authorization_completeness_pct: 70,
  pre_sale_rate: 35, sales_vs_plan: 90, dso_days: 180, cash_coverage: 1.1, funding_gap_pct: 5, stock_rotation_months: 24, stressed_margin_pct: 12,
  secured_sales_rate: 30, gross_margin_pct: 20, ltc: 70, ltv_stressed: 78, guarantee_coverage: 100, interest_coverage: 2, release_quotity_gap_pts: -5,
  regional_market_tension: "equilibre", tranche_dependency: "dependante_financee", contractor_quality: "qualifiee",
  slow_liquidity_share_pct: 25, cancellation_rate_pct: 12, equipment_unbudgeted_pct: 1.5, drawdown_vs_progress_pct: 108, cost_overrun_pct: 7 };

type Case = { id: string; desc: string; inputs: ProjectInputs; segment?: string; zone?: string; cls?: string };
const M = (o: Partial<Record<string, any>>, from: ProjectInputs = base): ProjectInputs => { const r: any = { ...from }; for (const k of Object.keys(o)) { if (o[k] === undefined) delete r[k]; else r[k] = o[k]; } return r; };
const cases: Case[] = [
  { id: "T01", desc: "Dossier solide, classe saine", inputs: base, cls: "SAIN" },
  { id: "T02", desc: "Solide, segment touristique + zone Marrakech (ajustements)", inputs: base, segment: "touristique", zone: "marrakech", cls: "SAIN" },
  { id: "T03", desc: "Dossier intermédiaire (score moyen)", inputs: mid, segment: "intermediaire", zone: "casa_periphérie".replace("é", "e"), cls: "SAIN" },
  { id: "T04", desc: "Dossier intermédiaire dégradé (cash 0,9 + impasse persistante)", inputs: M({ ...mid, cash_coverage: 0.9, funding_gap_persistent: true }, mid), cls: "SAIN" },
  { id: "T05", desc: "Impayé 120 j : alerte bloquante, souffrance", inputs: M({ dpd_days: 120 }), cls: "SAIN" },
  { id: "T06", desc: "Cash coverage 0,99 : alerte -25", inputs: M({ cash_coverage: 0.99 }), cls: "SAIN" },
  { id: "T07", desc: "Cash coverage absent : dossier incomplet", inputs: M({ cash_coverage: undefined }), cls: "SAIN" },
  { id: "T08", desc: "Classe pré-douteuse : défaut avéré", inputs: base, cls: "PRE_DOUTEUX" },
  { id: "T09", desc: "Classe contentieux CTX : score 0", inputs: base, cls: "CTX" },
  { id: "T10", desc: "Classe sensible : coefficient 0,9", inputs: base, cls: "SENSIBLE" },
  { id: "T11", desc: "Apport 50 % : gate franchi", inputs: M({ equity_injected_ratio: 50 }), cls: "SAIN" },
  { id: "T12", desc: "Non 1er rang + restructuration : malus cumulés", inputs: M({ first_rank: "non", restructured: "yes" }), cls: "SAIN" },
  { id: "T13", desc: "Segment et zone hors référentiel", inputs: base, segment: "segment_inconnu", zone: "zone_inconnue", cls: "SAIN" },
  { id: "T14", desc: "Classe non renseignée : dossier incomplet", inputs: base },
  { id: "T15", desc: "Autorisation indispensable manquante (verrou de tirage)", inputs: M({ authorization_completeness_pct: 40, works_authorization_blocked: true }), cls: "SAIN" },
  { id: "T16", desc: "Gouvernance non renseignée (qualitatif : note plancher)", inputs: M({ governance_quality: undefined }), cls: "SAIN" },
  { id: "T17", desc: "Retard chantier 8 mois + prix de mainlevée sous-tarifé", inputs: M({ construction_delay_months: 8, release_underpriced: true, release_quotity_gap_pts: -15 }), cls: "SAIN" },
  { id: "T18", desc: "Retard de paiement (dpd_days) absent : dossier incomplet", inputs: M({ dpd_days: undefined }), cls: "SAIN" },
  { id: "T19", desc: "Litige : alerte bloquante CTX", inputs: M({ legal_exposure: "litigation" }), cls: "SAIN" },
  { id: "T20", desc: "Projet en difficulté (dégradé + non 1er rang)", inputs: M({ ...mid, first_rank: "non", cash_coverage: 0.95, gross_margin_pct: 12, ltc: 85 }, mid), segment: "villas", zone: "regions_interieures", cls: "SENSIBLE" },
  { id: "T21", desc: "Tranche financée dépendante d'ouvrages communs non financés", inputs: M({ tranche_dependency: "dependante_non_financee" }), cls: "SAIN" },
  { id: "T22", desc: "Déblocages en avance sur l'avancement (150 %)", inputs: M({ drawdown_vs_progress_pct: 150, drawdown_ahead_of_works: true }), cls: "SAIN" },
  { id: "T23", desc: "Mosquée exigée non budgétée (4 % du coût) et en retard", inputs: M({ equipment_unbudgeted_pct: 4, equipment_delivery_at_risk: true }), cls: "SAIN" },
  { id: "T24", desc: "Programme mixte : 45 % commerces et hôtel, sans preneur engagé", inputs: M({ slow_liquidity_share_pct: 45, component_exit_unsecured: true }), cls: "SAIN" },
  { id: "T25", desc: "Région en surstock, désistements 25 %, plan de tirage en retard", inputs: M({ regional_market_tension: "surstock", cancellation_rate_pct: 25, drawdown_schedule_late: true }), cls: "SAIN" },
  { id: "T26", desc: "Données v5 non renseignées (notes plancher)", inputs: M({ regional_market_tension: undefined, tranche_dependency: undefined, contractor_quality: undefined, slow_liquidity_share_pct: undefined, cancellation_rate_pct: undefined, equipment_unbudgeted_pct: undefined, drawdown_vs_progress_pct: undefined, cost_overrun_pct: undefined }), cls: "SAIN" },
];

const DEFAULT_CLASSES = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];
const out = cases.map((c) => {
  const cls = c.cls as RegulatoryClassCode | undefined;
  const r = runScoring({ model, inputs: c.inputs, segment: c.segment ?? null, zone: c.zone ?? null,
    regulatoryClass: cls, classBlocksGo: cls === "CTX", isDefault: cls ? DEFAULT_CLASSES.includes(cls) : false,
    dataQualityBlocking: !cls, extraCriticalKeys: ["dpd_days"] });
  return { id: c.id, desc: c.desc, inputs: c.inputs, segment: c.segment ?? "", zone: c.zone ?? "", cls: c.cls ?? "",
    expected: { scoreEco: r.scoreEco, economicScore: r.economicScore, guaranteeScore: r.guaranteeScore, alphaSeg: r.alphaSeg, betaZone: r.betaZone,
      unknownSegment: r.unknownSegment, unknownZone: r.unknownZone, scoreAdjusted: r.scoreAdjusted, totalMalus: r.totalMalus,
      scoreAfterPenalties: r.scoreAfterPenalties, coeffBAM: r.coeffBAM, scoreFinal: r.scoreFinal, decision: r.decision, internalClass: r.internalClass,
      gateBlocked: r.gateBlocked, dataIncomplete: r.dataIncomplete, missing: r.missingCriticalInputs, pdProxy: r.pdProxy,
      domains: Object.fromEntries(r.domains.map((d) => [d.domainCode, d.score])), flags: r.redFlags.map((f) => f.code) } };
});
fs.writeFileSync(D + "vectors.json", JSON.stringify(out, null, 1));
console.log(out.map((o) => `${o.id} ${String(o.expected.scoreFinal).padStart(6)} ${o.expected.decision.padEnd(18)} ${o.expected.internalClass.padEnd(18)} malus=${o.expected.totalMalus} inc=${o.expected.dataIncomplete}`).join("\n"));
