// =====================================================================
//  regulatoryClassificationEngine.ts
//  Classe une exposition selon le régime BKAM actif.
//   - 19/G/2002 : saines / souffrance (pré-douteux 90j, douteux 180j,
//     compromis 360j) ; effet groupe (art.33).
//   - 1/W/2025 : ajoute la classe SENSIBLE, des déclencheurs spécifiques
//     promotion immobilière (art.5/12), un régime de restructuration
//     détaillé (art.17-31) et un effet groupe étendu aux sensibles (art.50).
//  La classe retenue est la plus sévère parmi tous les déclencheurs.
// =====================================================================

import { evaluateRule } from "@/lib/domain/ruleEngine";
import type {
  ClassificationResult,
  DataQuality,
  ProjectInputs,
  RegulatoryClassCode,
  RegulatoryRegimeConfig,
  RestructuringContext,
  TriggerConfig,
} from "@/lib/domain/types";

// Données CRITIQUES sans lesquelles la classe de souffrance ne peut être fiable
// (leur absence est bloquante : revue manuelle requise). Données IMPORTANTES :
// leur absence dégrade la confiance sans bloquer (1/W §6.2 — qualité des données).
const CRITICAL_DATA_KEYS = ["dpd_days"];
const IMPORTANT_DATA_KEYS = ["legal_exposure", "financials_unavailable"];

export interface ClassificationParams {
  regime: RegulatoryRegimeConfig;
  inputs: ProjectInputs;
  dpdDays?: number;
  restructuring?: RestructuringContext;
  // Classe la plus sévère observée sur le groupe d'intérêt (effet groupe).
  groupPeerClass?: RegulatoryClassCode;
  // Classe la plus sévère des autres expositions de la même contrepartie
  // (même promoteur : autres projets/facilités) — contagion contrepartie.
  counterpartyPeerClass?: RegulatoryClassCode;
  // Surcharge éventuelle des clés évaluées pour la qualité des données.
  criticalKeys?: string[];
  importantKeys?: string[];
}

/** Évalue la complétude des données critiques/importantes de classification. */
export function assessDataQuality(
  inputs: ProjectInputs,
  criticalKeys: string[] = CRITICAL_DATA_KEYS,
  importantKeys: string[] = IMPORTANT_DATA_KEYS,
): DataQuality {
  const isMissing = (k: string) => inputs[k] === undefined || inputs[k] === null;
  const missingCritical = criticalKeys.filter(isMissing);
  const missingImportant = importantKeys.filter(isMissing);
  const status: DataQuality["status"] = missingCritical.length
    ? "INCOMPLETE_BLOCKING"
    : missingImportant.length
      ? "INCOMPLETE"
      : "COMPLETE";
  return { status, missingCriticalData: [...missingCritical, ...missingImportant] };
}

function triggerFires(t: TriggerConfig, inputs: ProjectInputs, dpd: number) {
  if (t.kind === "DPD") {
    const minOk = t.dpdMin == null || dpd >= t.dpdMin;
    const maxOk = t.dpdMax == null || dpd <= t.dpdMax;
    if (minOk && maxOk && (t.dpdMin != null || t.dpdMax != null)) {
      return { fired: true, reason: `Retard de ${dpd}j ∈ [${t.dpdMin ?? 0}, ${t.dpdMax ?? "∞"}]` };
    }
    return { fired: false, reason: "" };
  }
  if (t.condition && evaluateRule(t.condition, inputs)) {
    return { fired: true, reason: t.description ?? `Critère ${t.kind} satisfait` };
  }
  return { fired: false, reason: "" };
}

/**
 * Classe minimale imposée par une restructuration (1/W/2025 art.17-31).
 * Retourne null si aucune règle de restructuration ne s'applique.
 */
export function restructuringFloor(
  ctx: RestructuringContext | undefined,
  policy: RegulatoryRegimeConfig["restructuringPolicy"],
): { floor: RegulatoryClassCode; note: string } | null {
  if (!ctx?.restructured) return null;

  if (policy === "BKAM_1W") {
    const count = ctx.count ?? 1;
    // art.18 : restructuration non viable → douteuse
    if (ctx.viable === false) return { floor: "DOUTEUX", note: "Restructuration non viable (art.18) → douteux" };
    // art.29 : impayés sur créance restructurée
    if ((ctx.dpdOnRestructured ?? 0) > 90)
      return { floor: "DOUTEUX", note: "Impayé > 90j sur créance restructurée (art.29) → douteux" };
    // art.25 : 2nde restructuration pendant la période d'observation de la 1ère
    if (ctx.secondDuringObservation)
      return { floor: "DOUTEUX", note: "2nde restructuration en période d'observation (art.25) → douteux" };
    // art.28 : au-delà de la 2nde restructuration → douteux
    if (count >= 3) return { floor: "DOUTEUX", note: ">2 restructurations (art.28) → douteux" };
    // art.29 : impayé > 30j sur restructurée → sensible
    if ((ctx.dpdOnRestructured ?? 0) > 30)
      return { floor: "SENSIBLE", note: "Impayé > 30j sur créance restructurée (art.29) → sensible" };
    // art.22 : 1ère restructuration avec différé ≥ 12 mois → sensible
    if ((ctx.deferralMonths ?? 0) >= 12)
      return { floor: "SENSIBLE", note: "Restructuration avec différé ≥ 1 an (art.22) → sensible" };
    // art.24 : deux restructurations de créances saines → sensible
    if (count >= 2) return { floor: "SENSIBLE", note: "Deux restructurations (art.24) → sensible" };
    // art.21 : 1ère restructuration → surveillance sensible a minima
    return { floor: "SENSIBLE", note: "Première restructuration (art.21) → revue sensible" };
  }

  if (policy === "BKAM_19G") {
    // art.9 : restructurée avec échéance impayée 180j → compromise
    if ((ctx.dpdOnRestructured ?? 0) >= 180)
      return { floor: "COMPROMIS", note: "Restructurée impayée 180j (art.9 19/G) → compromise" };
    return { floor: "PRE_DOUTEUX", note: "Créance restructurée (19/G) → pré-douteux a minima" };
  }

  return null;
}

export function classify(params: ClassificationParams): ClassificationResult {
  const { regime, inputs } = params;
  const dpd = params.dpdDays ?? (typeof inputs.dpd_days === "number" ? inputs.dpd_days : 0);

  const classByCode = new Map(regime.classes.map((c) => [c.code, c]));
  const severityOf = (code: RegulatoryClassCode) => classByCode.get(code)?.orderIndex ?? -1;

  const triggeredBy: ClassificationResult["triggeredBy"] = [];
  let bestClass: RegulatoryClassCode = "SAIN";
  let bestSeverity = severityOf("SAIN");

  const consider = (cls: RegulatoryClassCode) => {
    const sev = severityOf(cls);
    if (sev > bestSeverity) {
      bestSeverity = sev;
      bestClass = cls;
    }
  };

  // 1. Déclencheurs paramétrés (DPD + conditions DSL : promotion immobilière…)
  const ordered = [...regime.triggers].sort((a, b) => b.priority - a.priority);
  for (const t of ordered) {
    const { fired, reason } = triggerFires(t, inputs, dpd);
    if (fired) {
      triggeredBy.push({ kind: t.kind, targetClass: t.targetClass, reason });
      consider(t.targetClass);
    }
  }

  // 2. Régime de restructuration (art.17-31)
  const restruct = restructuringFloor(params.restructuring, regime.restructuringPolicy);
  let restructuringNote: string | undefined;
  if (restruct) {
    restructuringNote = restruct.note;
    triggeredBy.push({ kind: "RESTRUCTURING", targetClass: restruct.floor, reason: restruct.note });
    consider(restruct.floor);
  }

  // 3. Effet groupe (art.33 19/G ; art.50 1/W étendu aux sensibles)
  let groupContagionClass: RegulatoryClassCode | undefined;
  if (params.groupPeerClass) {
    const peerSev = severityOf(params.groupPeerClass);
    if (peerSev > bestSeverity) {
      groupContagionClass = params.groupPeerClass;
      triggeredBy.push({
        kind: "CROSS_DEFAULT",
        targetClass: params.groupPeerClass,
        reason: `Contagion groupe : entité liée classée ${params.groupPeerClass}`,
      });
      consider(params.groupPeerClass);
    }
  }

  // 3bis. Contagion contrepartie (même promoteur, autres projets/facilités) :
  // la classe la plus sévère d'une autre exposition de la contrepartie contamine.
  let counterpartyContagionClass: RegulatoryClassCode | undefined;
  if (params.counterpartyPeerClass) {
    const peerSev = severityOf(params.counterpartyPeerClass);
    if (peerSev > bestSeverity) {
      counterpartyContagionClass = params.counterpartyPeerClass;
      triggeredBy.push({
        kind: "CROSS_DEFAULT",
        targetClass: params.counterpartyPeerClass,
        reason: `Contagion contrepartie : autre exposition classée ${params.counterpartyPeerClass}`,
      });
      consider(params.counterpartyPeerClass);
    }
  }

  const def = classByCode.get(bestClass);
  return {
    resultClass: bestClass,
    isWatchList: def?.isWatchList ?? false,
    blocksGo: def?.blocksGo ?? false,
    restructuringNote,
    groupContagionClass,
    counterpartyContagionClass,
    dataQuality: assessDataQuality(inputs, params.criticalKeys, params.importantKeys),
    triggeredBy,
  };
}
