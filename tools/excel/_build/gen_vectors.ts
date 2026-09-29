import fs from "node:fs";
import { runScoring } from "@/server/engines/scoringEngine";
import type { ScoringModelConfig, ProjectInputs, RegulatoryClassCode } from "@/lib/domain/types";

const D = "tools/excel/_build/";
const meta = JSON.parse(fs.readFileSync(D + "meta.json", "utf8"));
const crit: any[] = JSON.parse(fs.readFileSync(D + "criteres.json", "utf8"));
const bar: any[] = JSON.parse(fs.readFileSync(D + "baremes.json", "utf8"));
const alr: any[] = JSON.parse(fs.readFileSync(D + "alertes.json", "utf8"));

const model: ScoringModelConfig = {
  modelCode: "PI_PROMOTION", version: meta.version, scoreScale: meta.scoreScale,
  bamCoefficients: meta.bam, decisionThresholds: meta.thresholds,
  segmentAdjustments: meta.segments, zoneAdjustments: meta.zones,
  domains: meta.domains.map((d: any[]) => ({
    code: d[0], name: d[1], weight: d[2],
    criteria: crit.filter((c) => c[0] === d[0]).map((c) => ({
      code: c[1], name: c[2], type: c[3], weight: c[4], inputKey: c[5], isGate: c[6], gateThreshold: c[7],
      gateStage: c[8] ?? undefined, family: c[9], critical: c[10],
      options: bar.filter((b) => b[0] === c[1] && b[1] === "MODALITE").sort((a, b) => a[2] - b[2]).map((b) => ({ value: b[5], label: b[6], score: b[7] })),
      ranges: bar.filter((b) => b[0] === c[1] && b[1] === "PLAGE").sort((a, b) => a[2] - b[2]).map((b) => ({ minIncl: b[3], maxExcl: b[4], score: b[7], label: b[6] })),
    })),
  })),
  redFlags: alr.map((a) => ({
    code: a[0], name: a[1], severity: a[2], malus: a[3], impactDomains: String(a[4]).split(","),
    rule: { clause: a[7] === null ? { key: a[5], op: a[6] } : { key: a[5], op: a[6], value: a[7] } },
    mitigable: a[11],
  })),
} as any;

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
};
const mid: ProjectInputs = { ...base, promoter_completed_projects: 2, promoter_gearing: 120, governance_quality: "partielle", mono_project_concentration: 50,
  promoter_type: "regional", equity_injected_ratio: 90, land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne",
  progress_vs_plan: 90, sav_litigation: "moyen", macro_sensitivity: "moyenne", land_cost_ratio: 30, authorization_completeness_pct: 70,
  pre_sale_rate: 35, sales_vs_plan: 90, dso_days: 180, cash_coverage: 1.1, funding_gap_pct: 5, stock_rotation_months: 24, stressed_margin_pct: 12,
  secured_sales_rate: 30, gross_margin_pct: 20, ltc: 70, ltv_stressed: 78, guarantee_coverage: 100, interest_coverage: 2, release_quotity_gap_pts: -5 };

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
