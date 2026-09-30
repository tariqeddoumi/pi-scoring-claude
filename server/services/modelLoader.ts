// =====================================================================
//  modelLoader.ts
//  Charge la configuration métier (modèle de scoring, régime) depuis la
//  base et la transforme en objets de configuration purs consommés par
//  les moteurs. Aucune logique de calcul ici : uniquement du mapping.
// =====================================================================

import type { Prisma, PrismaClient } from "@prisma/client";
import { snapshotToConfig } from "@/lib/domain/modelSnapshot";
import type {
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

  // Conversion unique base/instantané → configuration moteur (modelSnapshot).
  const config: ScoringModelConfig = snapshotToConfig({
    modelCode,
    version: version.version,
    scoreScale: version.scoreScale,
    bamCoefficients: version.bamCoefficients,
    decisionThresholds: version.decisionThresholds,
    segmentAdjustments: version.segmentAdjustments,
    zoneAdjustments: version.zoneAdjustments,
    domains: version.domains,
    redFlags: version.redFlags,
  });

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
