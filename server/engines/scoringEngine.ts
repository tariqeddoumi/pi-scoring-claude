// =====================================================================
//  scoringEngine.ts — Moteur de scoring interne (paramétrable par modèle)
//
//  Chaîne de calcul (déterministe, pure) :
//   1. ScoreCrit (1..échelle ; PI_PROMOTION v2.0 = 1..10) par critère (QUAL/NUM)
//   2. ScoreDomaine 0..100 = moyenne pondérée des KPI (normalisée par l'échelle)
//   3. S_eco = Σ poids_domaine × ScoreDomaine  (D1..D4)
//   4. S_adj = S_eco × (1 + α_Seg + β_Zone)
//   5. D5 : malus M et déclencheurs de souffrance (hors score)
//   6. S_afterPenalties = clamp(S_adj − M, 0, 100)
//   7. CoeffBAM(classe) → S_final = S_afterPenalties × CoeffBAM
//   8. Règle bloquante CTX/souffrance → NO_GO (CTX ⇒ score 0)
//   9. PD proxy logistique indicative
// =====================================================================

import { evaluateRule } from "@/lib/domain/ruleEngine";
import type {
  CriterionConfig,
  CriterionOutcome,
  DomainConfig,
  DomainOutcome,
  Decision,
  InputValue,
  ProjectInputs,
  RedFlagOutcome,
  RegulatoryClassCode,
  ScoringModelConfig,
  ScoringResult,
} from "@/lib/domain/types";

export interface ScoringEngineParams {
  model: ScoringModelConfig;
  inputs: ProjectInputs;
  segment?: string | null;
  zone?: string | null;
  regulatoryClass?: RegulatoryClassCode;
  classBlocksGo?: boolean;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function scoreQual(crit: CriterionConfig, value: InputValue, scale: number) {
  const opt = crit.options?.find((o) => o.value === value);
  if (!opt) return { score: 0, ref: null as string | null };
  return { score: clamp(opt.score, 0, scale), ref: opt.value };
}

function scoreNum(crit: CriterionConfig, value: InputValue, scale: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return { score: 0, ref: null as string | null };
  for (const r of crit.ranges ?? []) {
    const lowOk = r.minIncl === null || value >= r.minIncl;
    const highOk = r.maxExcl === null || value < r.maxExcl;
    if (lowOk && highOk) {
      return { score: clamp(r.score, 0, scale), ref: r.label ?? `[${r.minIncl ?? "-∞"},${r.maxExcl ?? "+∞"})` };
    }
  }
  return { score: 0, ref: null as string | null };
}

function scoreCriterion(
  crit: CriterionConfig,
  domainCode: string,
  inputs: ProjectInputs,
  scale: number,
): CriterionOutcome {
  const rawValue = inputs[crit.inputKey] ?? null;
  const { score, ref } =
    crit.type === "QUAL" ? scoreQual(crit, rawValue, scale) : scoreNum(crit, rawValue, scale);
  const gateBlocked = crit.isGate && crit.gateThreshold != null && score <= crit.gateThreshold;
  return {
    criterionCode: crit.code,
    domainCode,
    rawValue,
    score: round2(score),
    weight: crit.weight,
    weighted: round2(score * crit.weight),
    matchedRef: ref,
    gateBlocked,
  };
}

function scoreDomain(domain: DomainConfig, crits: CriterionOutcome[], scale: number): DomainOutcome {
  const own = crits.filter((c) => c.domainCode === domain.code);
  const totalWeight = own.reduce((s, c) => s + c.weight, 0);
  const weightedSum = own.reduce((s, c) => s + c.weighted, 0);
  // Moyenne pondérée des KPI (0..scale) ramenée sur 0..100.
  const score100 = totalWeight > 0 ? (weightedSum / totalWeight / scale) * 100 : 0;
  return {
    domainCode: domain.code,
    name: domain.name,
    weight: domain.weight,
    score: round2(score100),
    weighted: round2(score100 * domain.weight),
  };
}

function decideFrom(score: number, t: ScoringModelConfig["decisionThresholds"]): {
  decision: Decision;
  internalClass: string;
} {
  if (score >= t.go) return { decision: "GO", internalClass: "Sain" };
  if (score >= t.goWithConditions) return { decision: "GO_WITH_CONDITIONS", internalClass: "Surveillance" };
  if (score >= t.watchList) return { decision: "WATCH_LIST", internalClass: "Sensible probable" };
  return { decision: "NO_GO", internalClass: "Sensible" };
}

/**
 * PD proxy logistique (cf. doc V1.0 §12).
 * Correction : la formule littérale du document (Z=(S-50)/10 ; PD=1/(1+e^{-(-2+0,5Z)}))
 * est croissante avec le score, ce qui contredit la table de référence du même
 * document (S=85→1%, 75→2%, 65→5%, 55→10%, 45→20%, 35→35%). On retient la
 * calibration logistique décroissante qui reproduit fidèlement cette table :
 *   logit(PD) = 2,223 − 0,0802 · S_final.
 * À recalibrer sur historique interne (PD proxy → Expected Loss).
 */
export function pdProxy(scoreFinal: number): number {
  const logit = 2.223 - 0.0802 * scoreFinal;
  const pd = 1 / (1 + Math.exp(-logit));
  return Math.round(pd * 10000) / 10000; // proportion 0..1
}

export function runScoring(params: ScoringEngineParams): ScoringResult {
  const { model, inputs, segment, zone, regulatoryClass, classBlocksGo } = params;
  const scale = model.scoreScale || 5;

  // 1-2. Critères & domaines
  const criteria: CriterionOutcome[] = [];
  for (const domain of model.domains) {
    for (const crit of domain.criteria) criteria.push(scoreCriterion(crit, domain.code, inputs, scale));
  }
  const domains: DomainOutcome[] = model.domains.map((d) => scoreDomain(d, criteria, scale));

  // 3. Score économique S_eco (0..100) — somme pondérée des domaines D1..D4
  const totalDomainWeight = domains.reduce((s, d) => s + d.weight, 0) || 1;
  const scoreEco = round2(domains.reduce((s, d) => s + d.weighted, 0) / totalDomainWeight);

  // 4. Ajustement segment / zone
  const alphaSeg = segment ? model.segmentAdjustments[segment] ?? 0 : 0;
  const betaZone = zone ? model.zoneAdjustments[zone] ?? 0 : 0;
  const scoreAdjusted = round2(clamp(scoreEco * (1 + alphaSeg + betaZone), 0, 100));

  // 5. D5 — malus & déclencheurs de souffrance
  const redFlags: RedFlagOutcome[] = [];
  let totalMalus = 0;
  let souffranceTriggered = false;
  for (const rf of model.redFlags) {
    if (evaluateRule(rf.rule, inputs)) {
      redFlags.push({
        code: rf.code,
        name: rf.name,
        severity: rf.severity,
        malus: rf.malus,
        impactDomains: rf.impactDomains,
        mitigable: rf.mitigable,
      });
      totalMalus += rf.malus;
      if (rf.severity === "BLOCKING") souffranceTriggered = true;
    }
  }

  // 6. Score après pénalités
  const scoreAfterPenalties = round2(clamp(scoreAdjusted - totalMalus, 0, 100));

  // 7. CoeffBAM réglementaire
  const coeffBAM = (regulatoryClass && model.bamCoefficients[regulatoryClass]) ?? 1;

  // 8. Règles bloquantes
  const gateHit = criteria.some((c) => c.gateBlocked);
  const ctxBlocked = classBlocksGo === true || regulatoryClass === "CTX";
  const gateBlocked = gateHit || souffranceTriggered || ctxBlocked;

  let scoreFinal: number;
  let decision: Decision;
  let internalClass: string;

  if (ctxBlocked) {
    scoreFinal = 0;
    decision = "NO_GO";
    internalClass = "Souffrance";
  } else {
    scoreFinal = round2(clamp(scoreAfterPenalties * coeffBAM, 0, 100));
    if (souffranceTriggered) {
      decision = "NO_GO";
      internalClass = "Souffrance";
    } else if (gateHit) {
      decision = "NO_GO";
      ({ internalClass } = decideFrom(scoreFinal, model.decisionThresholds));
    } else {
      ({ decision, internalClass } = decideFrom(scoreFinal, model.decisionThresholds));
    }
  }

  return {
    criteria,
    domains,
    redFlags,
    scoreEco,
    alphaSeg,
    betaZone,
    scoreAdjusted,
    scoreTechnique: scoreAdjusted,
    totalMalus: round2(totalMalus),
    scoreAfterPenalties,
    coeffBAM,
    scoreFinal,
    decision,
    internalClass,
    gateBlocked,
    souffranceTriggered,
    pdProxy: pdProxy(scoreFinal),
    regulatoryClass,
  };
}
