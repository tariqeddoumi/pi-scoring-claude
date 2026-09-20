// =====================================================================
//  scoringEngine.ts — Moteur de scoring interne (paramétrable par modèle)
//
//  Chaîne de calcul (déterministe, pure) :
//   1. ScoreCrit (1..échelle ; PI_PROMOTION = 1..10) par critère (QUAL/NUM).
//      Diagnostic F01 : une valeur absente/non reconnue prend la note PLANCHER
//      (pire cas), jamais 0 « neutre » — l'omission ne peut pas améliorer la note.
//   2. ScoreDomaine 0..100 = moyenne pondérée des KPI (normalisée par l'échelle)
//   3. S_eco = Σ poids_domaine × ScoreDomaine  (D1..D4)
//   4. S_adj = S_eco × (1 + α_Seg + β_Zone)
//   5. D5 : malus M et déclencheurs de souffrance (hors score)
//   6. S_afterPenalties = clamp(S_adj − M, 0, 100)
//   7. CoeffBAM(classe) → S_final = S_afterPenalties × CoeffBAM
//   8. Invariants de décision (diagnostic) :
//        - donnée critique absente → DOSSIER_INCOMPLET (F01/F02)
//        - classe en défaut (isDefault) → « Défaut avéré », NO_GO (F03)
//        - CTX/souffrance/gate → NO_GO
//   9. Notes séparées économique / sûretés (F09) ; PD proxy indicative (F16)
// =====================================================================

import { evaluateRule, numericRuleKeys } from "@/lib/domain/ruleEngine";
import { missingCriticalInputs, worstCaseScore } from "@/lib/domain/decisionInvariants";
import type {
  CriterionConfig,
  CriterionOutcome,
  DecisionCondition,
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
  // Diagnostic F03 : la classe réglementaire est-elle un défaut avéré ?
  isDefault?: boolean;
  // Diagnostic F02 : la qualité des données est-elle jugée bloquante en amont ?
  dataQualityBlocking?: boolean;
  // Clés décisionnelles additionnelles à contrôler (ex. dpd_days).
  extraCriticalKeys?: string[];
  // Diagnostic F11 : pondérations de domaines de substitution (grille par phase,
  // challenger). Absent → poids officiels du modèle (comportement inchangé).
  domainWeights?: Record<string, number>;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Note QUAL : modalité reconnue → sa note ; absente ou non reconnue → note
 * PLANCHER du barème (pire cas), afin qu'une omission ne puisse jamais améliorer
 * la note (F01).
 */
function scoreQual(crit: CriterionConfig, value: InputValue, scale: number) {
  const opt = crit.options?.find((o) => o.value === value);
  if (!opt) return { score: clamp(worstCaseScore(crit), 0, scale), ref: null as string | null };
  return { score: clamp(opt.score, 0, scale), ref: opt.value };
}

/**
 * Note NUM : valeur dans une plage → sa note ; absente/non numérique/hors plages
 * → note PLANCHER du barème (pire cas) plutôt que 0 (F01).
 */
function scoreNum(crit: CriterionConfig, value: InputValue, scale: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { score: clamp(worstCaseScore(crit), 0, scale), ref: null as string | null };
  }
  for (const r of crit.ranges ?? []) {
    const lowOk = r.minIncl === null || value >= r.minIncl;
    const highOk = r.maxExcl === null || value < r.maxExcl;
    if (lowOk && highOk) {
      return { score: clamp(r.score, 0, scale), ref: r.label ?? `[${r.minIncl ?? "-∞"},${r.maxExcl ?? "+∞"})` };
    }
  }
  return { score: clamp(worstCaseScore(crit), 0, scale), ref: null as string | null };
}

function scoreCriterion(
  crit: CriterionConfig,
  domainCode: string,
  inputs: ProjectInputs,
  scale: number,
): CriterionOutcome & { family: string } {
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
    family: crit.family ?? "ECONOMIC",
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

/**
 * Sous-score 0..100 restreint aux critères satisfaisant `predicate`, pondéré par
 * poids_domaine × poids_critère et normalisé sur l'échelle. Retourne null si
 * aucun critère ne correspond (diagnostic F09 : note économique vs sûretés).
 */
function subScore(
  model: ScoringModelConfig,
  crits: (CriterionOutcome & { family: string })[],
  scale: number,
  predicate: (c: CriterionOutcome & { family: string }) => boolean,
): number | null {
  const domWeight = new Map(model.domains.map((d) => [d.code, d.weight]));
  let num = 0;
  let den = 0;
  for (const c of crits) {
    if (!predicate(c)) continue;
    const w = (domWeight.get(c.domainCode) ?? 0) * c.weight;
    num += w * (c.score / scale) * 100;
    den += w;
  }
  return den > 0 ? round2(num / den) : null;
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
 * PD proxy logistique (cf. doc V1.0 §12) — TOUJOURS indicative (diagnostic F16 :
 * correspondance à une table experte, non calibrée sur des défauts observés).
 * Calibration décroissante reproduisant la table de référence :
 *   logit(PD) = 2,223 − 0,0802 · S_final.
 */
export function pdProxy(scoreFinal: number): number {
  const logit = 2.223 - 0.0802 * scoreFinal;
  const pd = 1 / (1 + Math.exp(-logit));
  return Math.round(pd * 10000) / 10000; // proportion 0..1
}

export function runScoring(params: ScoringEngineParams): ScoringResult {
  const { model, inputs, segment, zone, regulatoryClass, classBlocksGo, isDefault, dataQualityBlocking } = params;
  const scale = model.scoreScale || 5;

  // 1-2. Critères & domaines
  const criteria: (CriterionOutcome & { family: string })[] = [];
  for (const domain of model.domains) {
    for (const crit of domain.criteria) criteria.push(scoreCriterion(crit, domain.code, inputs, scale));
  }
  let domains: DomainOutcome[] = model.domains.map((d) => scoreDomain(d, criteria, scale));

  // F11 : pondérations de domaines de substitution (grille par phase, challenger).
  // Le score de domaine (0..100) ne dépend pas du poids de domaine ; on ne remplace
  // que le poids et la contribution pondérée.
  if (params.domainWeights) {
    domains = domains.map((d) => {
      const w = params.domainWeights![d.domainCode];
      return w == null ? d : { ...d, weight: w, weighted: round2(d.score * w) };
    });
  }

  // 3. Score économique S_eco (0..100) — somme pondérée des domaines D1..D4
  const totalDomainWeight = domains.reduce((s, d) => s + d.weight, 0) || 1;
  const scoreEco = round2(domains.reduce((s, d) => s + d.weighted, 0) / totalDomainWeight);

  // 3bis. Notes séparées économique / sûretés (F09).
  const economicScore = subScore(model, criteria, scale, (c) => c.family !== "GUARANTEE") ?? scoreEco;
  const guaranteeScore = subScore(model, criteria, scale, (c) => c.family === "GUARANTEE");

  // 4. Ajustement segment / zone
  const alphaSeg = segment ? model.segmentAdjustments[segment] ?? 0 : 0;
  const betaZone = zone ? model.zoneAdjustments[zone] ?? 0 : 0;
  const scoreAdjusted = round2(clamp(scoreEco * (1 + alphaSeg + betaZone), 0, 100));

  // 5. D5 — malus & déclencheurs de souffrance
  const redFlags: RedFlagOutcome[] = [];
  let totalMalus = 0;
  let souffranceTriggered = false;
  for (const rf of model.redFlags) {
    const fired = evaluateRule(rf.rule, inputs);
    // F01 : une alerte NON bloquante dont une clé numérique est absente ne peut
    // être « exclue » à bon compte — on applique le malus par prudence (l'omission
    // d'une donnée défavorable ne doit jamais améliorer le score). Les alertes
    // BLOQUANTES ne sont PAS déclenchées par simple absence (éviter un faux défaut,
    // cf. F04) : elles sont couvertes par le blocage « Dossier incomplet ».
    const cannotExclude =
      !fired &&
      rf.severity !== "BLOCKING" &&
      numericRuleKeys(rf.rule).some((k) => inputs[k] === undefined || inputs[k] === null);
    if (fired || cannotExclude) {
      redFlags.push({
        code: rf.code,
        name: cannotExclude ? `${rf.name} (non exclu — donnée absente)` : rf.name,
        severity: rf.severity,
        malus: rf.malus,
        impactDomains: rf.impactDomains,
        mitigable: rf.mitigable,
      });
      totalMalus += rf.malus;
      if (fired && rf.severity === "BLOCKING") souffranceTriggered = true;
    }
  }

  // 6. Score après pénalités
  const scoreAfterPenalties = round2(clamp(scoreAdjusted - totalMalus, 0, 100));

  // 7. CoeffBAM réglementaire
  const coeffBAM = (regulatoryClass && model.bamCoefficients[regulatoryClass]) ?? 1;

  // 8. Invariants de décision (diagnostic)
  // 8a. Complétude des données décisionnelles (F01/F02).
  const missingKeys = missingCriticalInputs(model, inputs, params.extraCriticalKeys ?? []);
  const dataIncomplete = dataQualityBlocking === true || missingKeys.length > 0;

  // 8b. Défaut avéré propagé depuis la classe réglementaire (F03).
  const defaultAsserted = isDefault === true || regulatoryClass === "CTX";

  const gateHit = criteria.some((c) => c.gateBlocked);
  const ctxBlocked = classBlocksGo === true || regulatoryClass === "CTX";
  const gateBlocked = gateHit || souffranceTriggered || ctxBlocked;

  // Conditions/obligations nommées (F15) : chaque gate franchi devient une
  // condition explicite, avec son jalon de levée.
  const conditions: DecisionCondition[] = [];
  for (const d of model.domains) {
    for (const c of d.criteria) {
      const oc = criteria.find((x) => x.criterionCode === c.code);
      if (c.isGate && oc?.gateBlocked) {
        conditions.push({
          code: c.code,
          label: `Lever la condition « ${c.name} » avant tirage`,
          stage: c.gateStage ?? "TIRAGE",
          blocking: true,
        });
      }
    }
  }

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
    } else if (defaultAsserted) {
      // F03 : une exposition en défaut avéré ne peut produire une décision
      // « performante » ; la PD performante ne s'applique pas.
      decision = "NO_GO";
      internalClass = "Défaut avéré";
    } else if (dataIncomplete) {
      // F02 : donnée critique absente → dossier non exploitable pour une
      // décision officielle (distinct d'un NO_GO de risque).
      decision = "DOSSIER_INCOMPLET";
      internalClass = "Dossier incomplet";
    } else if (gateHit) {
      decision = "NO_GO";
      ({ internalClass } = decideFrom(scoreFinal, model.decisionThresholds));
    } else {
      ({ decision, internalClass } = decideFrom(scoreFinal, model.decisionThresholds));
    }
  }

  // Retire la clé technique `family` des sorties critères publiées.
  const criteriaOut: CriterionOutcome[] = criteria.map(({ family: _f, ...c }) => c);

  return {
    criteria: criteriaOut,
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
    pdIndicative: true,
    dataIncomplete,
    missingCriticalInputs: missingKeys,
    defaultAsserted,
    economicScore,
    guaranteeScore,
    conditions,
    regulatoryClass,
  };
}
