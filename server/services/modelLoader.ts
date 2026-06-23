// =====================================================================
//  modelLoader.ts
//  Charge la configuration métier (modèle de scoring, régime) depuis la
//  base et la transforme en objets de configuration purs consommés par
//  les moteurs. Aucune logique de calcul ici : uniquement du mapping.
// =====================================================================

import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CriterionConfig,
  GuaranteeTypeConfig,
  ProjectInputs,
  RegulatoryRegimeConfig,
  ScoringModelConfig,
} from "@/lib/domain/types";

type Db = PrismaClient | Prisma.TransactionClient;

export async function loadActiveModelConfig(
  db: Db,
  modelCode = "PI_PROMOTION",
): Promise<{ versionId: string; config: ScoringModelConfig }> {
  const version = await db.scoringModelVersion.findFirst({
    where: { model: { code: modelCode }, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      model: true,
      domains: {
        orderBy: { orderIndex: "asc" },
        include: {
          criteria: {
            orderBy: { orderIndex: "asc" },
            include: { options: true, ranges: true },
          },
        },
      },
      redFlags: true,
    },
  });
  if (!version) throw new Error(`Aucune version publiée pour le modèle ${modelCode}`);

  const config: ScoringModelConfig = {
    modelCode,
    version: version.version,
    scoreScale: version.scoreScale ?? 5,
    segmentAdjustments: (version.segmentAdjustments as unknown as ScoringModelConfig["segmentAdjustments"]) ?? {},
    zoneAdjustments: (version.zoneAdjustments as unknown as ScoringModelConfig["zoneAdjustments"]) ?? {},
    bamCoefficients: (version.bamCoefficients as unknown as ScoringModelConfig["bamCoefficients"]) ?? {},
    decisionThresholds: (version.decisionThresholds as unknown as ScoringModelConfig["decisionThresholds"]) ?? {
      go: 75,
      goWithConditions: 65,
      watchList: 50,
    },
    domains: version.domains.map((d) => ({
      code: d.code,
      name: d.name,
      weight: d.weight,
      criteria: d.criteria.map<CriterionConfig>((c) => ({
        code: c.code,
        name: c.name,
        type: c.type,
        weight: c.weight,
        inputKey: c.inputKey,
        isGate: c.isGate,
        gateThreshold: c.gateThreshold,
        options: c.options
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((o) => ({ value: o.value, label: o.label, score: o.score })),
        ranges: c.ranges
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((r) => ({ minIncl: r.minIncl, maxExcl: r.maxExcl, score: r.score, label: r.label ?? undefined })),
      })),
    })),
    redFlags: version.redFlags.map((rf) => ({
      code: rf.code,
      name: rf.name,
      rule: rf.rule as RegulatoryRegimeConfig["triggers"][number]["condition"] as any,
      severity: rf.severity,
      impactDomains: rf.impactDomains,
      malus: rf.malus,
      mitigable: rf.mitigable,
    })),
  };

  return { versionId: version.id, config };
}

export async function loadActiveRegime(db: Db): Promise<{
  regimeId: string;
  config: RegulatoryRegimeConfig;
  guaranteeTypes: GuaranteeTypeConfig[];
  hypEvaluationThreshold: number;
}> {
  const regime = await db.regulatoryRegime.findFirst({
    where: { active: true },
    orderBy: { effectiveFrom: "desc" },
    include: { classes: true, triggers: true, guaranteeTypes: true },
  });
  if (!regime) throw new Error("Aucun régime réglementaire actif");

  const config: RegulatoryRegimeConfig = {
    code: regime.code,
    name: regime.name,
    restructuringPolicy: (regime.restructuringPolicy as RegulatoryRegimeConfig["restructuringPolicy"]) ?? "NONE",
    classes: regime.classes
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c) => ({
        code: c.code,
        label: c.label,
        orderIndex: c.orderIndex,
        isWatchList: c.isWatchList,
        isDefault: c.isDefault,
        blocksGo: c.blocksGo,
      })),
    triggers: regime.triggers.map((t) => ({
      kind: t.kind,
      targetClass: regime.classes.find((c) => c.id === t.classId)!.code,
      dpdMin: t.dpdMin,
      dpdMax: t.dpdMax,
      condition: (t.condition as RegulatoryRegimeConfig["triggers"][number]["condition"]) ?? null,
      priority: t.priority,
      description: t.description ?? undefined,
    })),
  };

  const guaranteeTypes: GuaranteeTypeConfig[] = regime.guaranteeTypes.map((g) => ({
    code: g.code,
    label: g.label,
    eligible: g.eligible,
    quotity: g.quotity,
    haircut: g.haircut,
    abatementProfile: g.abatementProfile as GuaranteeTypeConfig["abatementProfile"],
    requiresRank1: g.requiresRank1,
  }));

  return {
    regimeId: regime.id,
    config,
    guaranteeTypes,
    hypEvaluationThreshold: regime.hypEvaluationThreshold,
  };
}

/** Reconstitue le dictionnaire d'entrées d'un projet depuis ProjectInput. */
export async function loadProjectInputs(db: Db, projectId: string): Promise<ProjectInputs> {
  const rows = await db.projectInput.findMany({ where: { projectId } });
  const inputs: ProjectInputs = {};
  for (const r of rows) {
    if (r.valueNum !== null) inputs[r.key] = r.valueNum;
    else if (r.valueStr !== null) inputs[r.key] = r.valueStr;
    else if (r.valueBool !== null) inputs[r.key] = r.valueBool;
    else inputs[r.key] = null;
  }
  return inputs;
}
