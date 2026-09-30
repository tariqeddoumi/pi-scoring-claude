// Exporte, depuis le code et le modèle publié, les données factuelles du guide
// du chargé d'affaires (libellés, étapes du wizard, barèmes, alertes, événements).
import fs from "node:fs";
import { PROMOTION_SCORING_MODEL_V4 } from "@/lib/domain/models/piPromotionV4";
import { WIZARD_STEPS } from "@/lib/wizardFields";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { EVENT_TYPES_LIST } from "@/lib/domain/referentiels";
import { REVIEW_PERIOD_DAYS } from "@/lib/domain/reviewPolicy";
import { AUTHORIZATION_CHAIN, BUYER_FINANCING_STATUSES } from "@/lib/domain/morocco";
import { WORKFLOW_LABELS, WORKFLOW_TRANSITIONS } from "@/lib/workflow";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/rbac";
import { criticalInputKeys } from "@/lib/domain/decisionInvariants";

const M = PROMOTION_SCORING_MODEL_V4;
const stepOf: Record<string, string> = {};
for (const s of WIZARD_STEPS) for (const f of s.fields) stepOf[f.key] = s.title;
const out = {
  version: M.version,
  criticalKeys: criticalInputKeys(M, ["dpd_days"]),
  thresholds: M.decisionThresholds,
  domains: M.domains.map((d) => ({
    code: d.code, name: d.name, weight: d.weight,
    criteria: d.criteria.map((c) => ({
      code: c.code, name: c.name, key: c.inputKey, label: INPUT_LABELS[c.inputKey] ?? c.inputKey, step: stepOf[c.inputKey] ?? "",
      type: c.type, weight: c.weight, gate: c.isGate, gateStage: c.gateStage ?? null, critical: !!c.critical, family: c.family ?? null,
      scale: c.type === "QUAL" ? (c.options ?? []).map((o) => `${o.label} → ${o.score}`) : (c.ranges ?? []).map((r) => `${(r.label ?? "").replace(/ \((critique|vigilance|favorable)\)/, "")} → ${r.score}`),
    })),
  })),
  alerts: M.redFlags.map((r) => ({ code: r.code, name: r.name, severity: r.severity, malus: r.malus, committee: !!r.requiresCommittee,
    key: (r.rule.clause ?? {}).key, label: INPUT_LABELS[(r.rule.clause ?? ({} as any)).key] ?? "", step: stepOf[(r.rule.clause ?? ({} as any)).key] ?? "" })),
  steps: WIZARD_STEPS.map((s) => ({ title: s.title, keys: s.fields.map((f) => ({ key: f.key, label: INPUT_LABELS[f.key] ?? f.key, type: f.type })) })),
  events: EVENT_TYPES_LIST.map((e: any) => ({ value: e.value, label: e.label, severity: e.severity, affectsScoring: e.affectsScoring, committee: !!e.requiresCommittee, regRef: e.regRef ?? "" })),
  review: REVIEW_PERIOD_DAYS,
  auth: AUTHORIZATION_CHAIN.map((a) => ({ code: a.code, label: a.label, stage: a.stage, appliesTo: a.appliesTo, blocksWorks: !!a.blocksWorks, blocksDelivery: !!a.blocksDelivery, regRef: a.regRef ?? "" })),
  financing: BUYER_FINANCING_STATUSES.map((f) => ({ code: f.value, label: f.label, factor: f.securityFactor })),
  workflow: Object.entries(WORKFLOW_LABELS).map(([k, v]) => ({ state: k, label: v, transitions: (WORKFLOW_TRANSITIONS as any)[k].map((t: any) => t.label) })),
  roles: Object.entries(ROLE_LABELS).map(([k, v]) => ({ role: k, label: v, perms: (ROLE_PERMISSIONS as any)[k] })),
};
fs.writeFileSync("docs/_sources/guide_data.json", JSON.stringify(out, null, 1));
console.log("ok", out.domains.reduce((s, d) => s + d.criteria.length, 0), "critères,", out.alerts.length, "alertes,", out.events.length, "événements");
