// =====================================================================
//  modelSnapshot.ts — Forme « ligne de base » d'une version de modèle et
//  sa conversion unique en configuration moteur.
//
//  Une même fonction sert au chargement depuis la base (modelLoader) et aux
//  instantanés versionnés dans le dépôt (prisma/models/*.json) : le moteur
//  reçoit donc exactement la même configuration, que le modèle vienne de la
//  base de production ou du dépôt.
// =====================================================================

import type {
  ConditionStage,
  CriterionConfig,
  CriterionFamily,
  CriterionType,
  RedFlagConfig,
  RedFlagEffect,
  RuleExpression,
  ScoringModelConfig,
  Severity,
} from "./types";

export interface SnapshotOption {
  value: string;
  label: string;
  score: number;
  orderIndex: number;
}

export interface SnapshotRange {
  minIncl: number | null;
  maxExcl: number | null;
  score: number;
  label: string | null;
  orderIndex: number;
}

export interface SnapshotCriterion {
  code: string;
  name: string;
  description?: string | null;
  type: CriterionType | string;
  weight: number;
  inputKey: string;
  isGate: boolean;
  gateThreshold: number | null;
  orderIndex: number;
  critical: boolean | null;
  family: string | null;
  gateStage: string | null;
  unit: string | null;
  definition: string | null;
  options: SnapshotOption[];
  ranges: SnapshotRange[];
}

export interface SnapshotDomain {
  code: string;
  name: string;
  weight: number;
  orderIndex: number;
  criteria: SnapshotCriterion[];
}

export interface SnapshotRedFlag {
  code: string;
  name: string;
  description?: string | null;
  rule: unknown;
  severity: Severity | string;
  impactDomains: string[];
  malus: number;
  mitigable: boolean;
  mitigantHint?: string | null;
  effect: string | null;
  requiresCommittee: boolean | null;
  regRef: string | null;
}

export interface ModelSnapshot {
  modelCode: string;
  modelName?: string;
  version: string;
  scoreScale: number | null;
  bamCoefficients: unknown;
  decisionThresholds: unknown;
  segmentAdjustments: unknown;
  zoneAdjustments: unknown;
  domains: SnapshotDomain[];
  redFlags: SnapshotRedFlag[];
}

const byOrder = <T extends { orderIndex: number }>(a: T, b: T) => a.orderIndex - b.orderIndex;

/** Convertit une version de modèle (base ou instantané) en configuration moteur. */
export function snapshotToConfig(s: ModelSnapshot): ScoringModelConfig {
  return {
    modelCode: s.modelCode,
    version: s.version,
    scoreScale: s.scoreScale ?? 5,
    segmentAdjustments: (s.segmentAdjustments as ScoringModelConfig["segmentAdjustments"]) ?? {},
    zoneAdjustments: (s.zoneAdjustments as ScoringModelConfig["zoneAdjustments"]) ?? {},
    bamCoefficients: (s.bamCoefficients as ScoringModelConfig["bamCoefficients"]) ?? {},
    decisionThresholds: (s.decisionThresholds as ScoringModelConfig["decisionThresholds"]) ?? {
      go: 75,
      goWithConditions: 65,
      watchList: 50,
    },
    domains: [...s.domains].sort(byOrder).map((d) => ({
      code: d.code,
      name: d.name,
      weight: d.weight,
      criteria: [...d.criteria].sort(byOrder).map<CriterionConfig>((c) => ({
        code: c.code,
        name: c.name,
        type: c.type as CriterionType,
        weight: c.weight,
        inputKey: c.inputKey,
        isGate: c.isGate,
        gateThreshold: c.gateThreshold,
        critical: c.critical ?? false,
        family: (c.family as CriterionFamily | null) ?? undefined,
        gateStage: (c.gateStage as ConditionStage | null) ?? undefined,
        unit: c.unit ?? undefined,
        definition: c.definition ?? undefined,
        options: [...c.options].sort(byOrder).map((o) => ({ value: o.value, label: o.label, score: o.score })),
        ranges: [...c.ranges]
          .sort(byOrder)
          .map((r) => ({ minIncl: r.minIncl, maxExcl: r.maxExcl, score: r.score, label: r.label ?? undefined })),
      })),
    })),
    redFlags: s.redFlags.map<RedFlagConfig>((rf) => ({
      code: rf.code,
      name: rf.name,
      rule: rf.rule as RuleExpression,
      severity: rf.severity as Severity,
      impactDomains: rf.impactDomains,
      malus: rf.malus,
      mitigable: rf.mitigable,
      effect: (rf.effect as RedFlagEffect | null) ?? undefined,
      requiresCommittee: rf.requiresCommittee ?? false,
      regRef: rf.regRef ?? undefined,
    })),
  };
}
