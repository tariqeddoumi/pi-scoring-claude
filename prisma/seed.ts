// =====================================================================
//  Seed initial — RBAC, modèle de scoring Promotion Immobilière,
//  régimes BKAM (19/G/2002 & 1/W/2025), garanties, et données de démo.
// =====================================================================

import { PrismaClient } from "@prisma/client";
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

const prisma = new PrismaClient();

async function seedRbac() {
  // Permissions
  const permLabels: Record<string, string> = {
    "project.read": "Consulter les projets",
    "project.write": "Modifier les projets",
    "scoring.run": "Lancer un scoring",
    "scoring.validate": "Valider un scoring",
    "workflow.endorse": "Émettre l'avis front (directeur de centre d'affaires)",
    "model.read": "Consulter le modèle",
    "model.write": "Administrer le modèle",
    "regime.read": "Consulter les régimes",
    "regime.write": "Administrer les régimes",
    "import.run": "Importer des données",
    "export.run": "Exporter des rapports",
    "audit.read": "Consulter l'audit",
    "admin.users": "Gérer les utilisateurs",
  };
  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, label: permLabels[code] ?? code },
      update: { label: permLabels[code] ?? code },
    });
  }

  // Rôles + mapping
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName as any },
      create: { name: roleName as any, label: ROLE_LABELS[roleName as keyof typeof ROLE_LABELS] },
      update: { label: ROLE_LABELS[roleName as keyof typeof ROLE_LABELS] },
    });
    // Reset mapping then recreate (idempotent)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const code of perms) {
      const perm = await prisma.permission.findUnique({ where: { code } });
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // Utilisateurs de démonstration (un par rôle)
  const demoUsers: Array<{ email: string; name: string; role: string }> = [
    { email: "admin@bank.ma", name: "Amine Admin", role: "ADMIN" },
    { email: "analyst@bank.ma", name: "Rita Contre-étude", role: "RISK_ANALYST" },
    { email: "rm@bank.ma", name: "Karim Chargé d'affaires", role: "RELATIONSHIP_MANAGER" },
    { email: "dca@bank.ma", name: "Nadia Directrice de centre d'affaires", role: "BRANCH_DIRECTOR" },
    { email: "dr@bank.ma", name: "Yassine Directeur de région", role: "REGIONAL_DIRECTOR" },
    { email: "manager@bank.ma", name: "Salma Comité", role: "MANAGER" },
    { email: "auditor@bank.ma", name: "Omar Auditeur", role: "AUDITOR" },
  ];
  const users: Record<string, string> = {};
  for (const u of demoUsers) {
    const role = await prisma.role.findUnique({ where: { name: u.role as any } });
    if (!role) continue;
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, roleId: role.id },
      update: { name: u.name, roleId: role.id },
    });
    users[u.role] = user.id;
  }
  return users;
}

async function seedScoringModel() {
  const cfg = PROMOTION_SCORING_MODEL;
  const model = await prisma.scoringModel.upsert({
    where: { code: cfg.modelCode },
    create: {
      code: cfg.modelCode,
      name: "Scoring Promotion Immobilière",
      description: "Modèle de scoring projets de promotion immobilière (D1..D5).",
    },
    update: {},
  });

  // Version (recréée proprement pour rejouabilité)
  const existing = await prisma.scoringModelVersion.findUnique({
    where: { modelId_version: { modelId: model.id, version: cfg.version } },
  });
  if (existing) {
    await prisma.scoringModelVersion.delete({ where: { id: existing.id } });
  }

  const version = await prisma.scoringModelVersion.create({
    data: {
      modelId: model.id,
      version: cfg.version,
      status: "PUBLISHED",
      publishedAt: new Date(),
      scoreScale: cfg.scoreScale,
      bamCoefficients: cfg.bamCoefficients,
      decisionThresholds: cfg.decisionThresholds as any,
      segmentAdjustments: cfg.segmentAdjustments as any,
      zoneAdjustments: cfg.zoneAdjustments as any,
    },
  });

  for (const [di, d] of cfg.domains.entries()) {
    const domain = await prisma.scoringDomain.create({
      data: {
        versionId: version.id,
        code: d.code,
        name: d.name,
        weight: d.weight,
        orderIndex: di,
      },
    });
    for (const [ci, c] of d.criteria.entries()) {
      const crit = await prisma.scoringCriterion.create({
        data: {
          domainId: domain.id,
          code: c.code,
          name: c.name,
          type: c.type,
          weight: c.weight,
          inputKey: c.inputKey,
          isGate: c.isGate,
          gateThreshold: c.gateThreshold ?? null,
          orderIndex: ci,
        },
      });
      if (c.options) {
        for (const [oi, o] of c.options.entries()) {
          await prisma.scoringOption.create({
            data: { criterionId: crit.id, value: o.value, label: o.label, score: o.score, orderIndex: oi },
          });
        }
      }
      if (c.ranges) {
        for (const [ri, r] of c.ranges.entries()) {
          await prisma.scoringRange.create({
            data: { criterionId: crit.id, minIncl: r.minIncl, maxExcl: r.maxExcl, score: r.score, label: r.label, orderIndex: ri },
          });
        }
      }
    }
  }

  for (const rf of cfg.redFlags) {
    await prisma.redFlagRule.create({
      data: {
        versionId: version.id,
        code: rf.code,
        name: rf.name,
        rule: rf.rule as any,
        severity: rf.severity,
        impactDomains: rf.impactDomains,
        malus: rf.malus,
        mitigable: rf.mitigable,
      },
    });
  }

  return version.id;
}

async function seedRegime(
  cfg: typeof REGIME_19G_2002,
  rates: Record<string, number>,
  guarantees: typeof GUARANTEE_TYPES_19G,
  effectiveFrom: Date,
  active: boolean,
  hypEvaluationThreshold: number,
) {
  await prisma.regulatoryRegime.deleteMany({ where: { code: cfg.code } });
  const regime = await prisma.regulatoryRegime.create({
    data: {
      code: cfg.code,
      name: cfg.name,
      effectiveFrom,
      active,
      hypEvaluationThreshold,
      restructuringPolicy: cfg.restructuringPolicy ?? "NONE",
    },
  });

  const classByCode: Record<string, string> = {};
  for (const [i, c] of cfg.classes.entries()) {
    const cls = await prisma.regulatoryClass.create({
      data: {
        regimeId: regime.id,
        code: c.code,
        label: c.label,
        orderIndex: c.orderIndex ?? i,
        isWatchList: c.isWatchList,
        isDefault: c.isDefault,
        blocksGo: c.blocksGo,
      },
    });
    classByCode[c.code] = cls.id;
    const rate = rates[c.code] ?? 0;
    await prisma.provisionRate.create({
      data: { regimeId: regime.id, classId: cls.id, rate, effectiveFrom },
    });
  }

  for (const t of cfg.triggers) {
    await prisma.regulatoryTrigger.create({
      data: {
        regimeId: regime.id,
        classId: classByCode[t.targetClass]!,
        kind: t.kind,
        dpdMin: t.dpdMin ?? null,
        dpdMax: t.dpdMax ?? null,
        condition: (t.condition ?? undefined) as any,
        priority: t.priority,
        description: t.description,
      },
    });
  }

  for (const g of guarantees) {
    await prisma.guaranteeType.create({
      data: {
        regimeId: regime.id,
        code: g.code,
        label: g.label,
        eligible: g.eligible,
        quotity: g.quotity,
        haircut: g.haircut,
        abatementProfile: g.abatementProfile,
        requiresRank1: g.requiresRank1 ?? false,
      },
    });
  }
  return regime.id;
}

async function seedDemoProjects(users: Record<string, string>) {
  const rmId = users.RELATIONSHIP_MANAGER;

  const promoter1 = await prisma.promoter.create({
    data: {
      name: "Atlas Développement SA",
      legalForm: "SA",
      groupName: "Groupe Atlas",
      yearsExperience: 15,
      completedProjects: 8,
      internalRating: "BBB",
    },
  });
  const promoter2 = await prisma.promoter.create({
    data: {
      name: "Nouvelle Résidence SARL",
      legalForm: "SARL",
      yearsExperience: 3,
      completedProjects: 1,
      internalRating: "B",
    },
  });

  // Projet 1 — solide
  const p1 = await prisma.realEstateProject.create({
    data: {
      reference: "PI-2026-001",
      name: "Résidence Les Jardins de l'Atlas",
      promoterId: promoter1.id,
      rmId,
      city: "Casablanca",
      region: "Casablanca-Settat",
      projectType: "Résidentiel haut standing",
      segment: "moyen_haut",
      zone: "casa_centre",
      groupId: "GRP_ATLAS",
      totalUnits: 120,
      landAreaSqm: 8000,
      builtAreaSqm: 14000,
      totalCost: 180_000_000,
      loanAmount: 110_000_000,
      ownEquity: 70_000_000,
      status: "EN_ANALYSE",
    },
  });
  const p1Inputs: Record<string, any> = {
    promoter_completed_projects: 8, promoter_gearing: 85, governance_quality: "claire",
    mono_project_concentration: 35, promoter_type: "structure", equity_injected_ratio: 100,
    land_permits_status: "definitives", market_positioning: "aligne", technical_complexity: "standard",
    progress_vs_plan: 100, sav_litigation: "faible", macro_sensitivity: "faible", land_cost_ratio: 22,
    pre_sale_rate: 62, sales_vs_plan: 100, dso_days: 90, cash_coverage: 1.35, funding_gap_pct: 0,
    stock_rotation_months: 16, stressed_margin_pct: 18,
    gross_margin_pct: 27, ltc: 61, ltv_stressed: 65, guarantee_coverage: 125, first_rank: "oui", interest_coverage: 3.2,
    dpd_days: 0, construction_delay_months: 0, project_stopped_months: 0, restructured: "no", legal_exposure: "clear",
  };
  await persistInputs(p1.id, p1Inputs);

  // Projet 2 — fragile
  const p2 = await prisma.realEstateProject.create({
    data: {
      reference: "PI-2026-002",
      name: "Résidence Annour",
      promoterId: promoter2.id,
      rmId,
      city: "Marrakech",
      region: "Marrakech-Safi",
      projectType: "Résidentiel social",
      segment: "intermediaire",
      zone: "marrakech",
      totalUnits: 60,
      landAreaSqm: 3000,
      builtAreaSqm: 4500,
      totalCost: 45_000_000,
      loanAmount: 38_000_000,
      ownEquity: 7_000_000,
      status: "EN_ANALYSE",
    },
  });
  const p2Inputs: Record<string, any> = {
    promoter_completed_projects: 1, promoter_gearing: 160, governance_quality: "partielle",
    mono_project_concentration: 70, promoter_type: "opportuniste", equity_injected_ratio: 70,
    land_permits_status: "partielles", market_positioning: "moyen", technical_complexity: "moyenne",
    progress_vs_plan: 75, sav_litigation: "moyen", macro_sensitivity: "elevee", land_cost_ratio: 32,
    pre_sale_rate: 18, sales_vs_plan: 70, dso_days: 260, cash_coverage: 0.85, funding_gap_pct: 15,
    stock_rotation_months: 32, stressed_margin_pct: 9,
    gross_margin_pct: 13, ltc: 84, ltv_stressed: 88, guarantee_coverage: 60, first_rank: "non", interest_coverage: 1.2,
    dpd_days: 110, construction_delay_months: 8, project_stopped_months: 0, restructured: "yes",
    restructuring_count: 1, restructuring_deferral_months: 12, legal_exposure: "watch",
    funding_gap_persistent: true, commercialization_below_50_1y: true, construction_delay_over_1y: false,
  };
  await persistInputs(p2.id, p2Inputs);

  // Garanties projet 1
  const reg19g = await prisma.regulatoryRegime.findUnique({ where: { code: "BKAM_19G_2002" } });
  if (reg19g) {
    const hyp1 = await prisma.guaranteeType.findUnique({
      where: { regimeId_code: { regimeId: reg19g.id, code: "HYP_RANG1" } },
    });
    const garBancaire = await prisma.guaranteeType.findUnique({
      where: { regimeId_code: { regimeId: reg19g.id, code: "GARANTIE_BANCAIRE" } },
    });
    if (hyp1) {
      await prisma.guarantee.create({
        data: { projectId: p1.id, typeId: hyp1.id, description: "Hypothèque 1er rang sur le foncier", marketValue: 120_000_000, rank: 1, recentlyEvaluated: true },
      });
    }
    if (garBancaire) {
      await prisma.guarantee.create({
        data: { projectId: p1.id, typeId: garBancaire.id, description: "Garantie bancaire de premier ordre", marketValue: 20_000_000 },
      });
    }
    if (hyp1) {
      await prisma.guarantee.create({
        data: { projectId: p2.id, typeId: hyp1.id, description: "Hypothèque foncier", marketValue: 28_000_000, rank: 2, recentlyEvaluated: true },
      });
    }
  }
}

async function persistInputs(projectId: string, inputs: Record<string, any>) {
  for (const [key, value] of Object.entries(inputs)) {
    await prisma.projectInput.create({
      data: {
        projectId,
        key,
        valueNum: typeof value === "number" ? value : null,
        valueStr: typeof value === "string" ? value : null,
        valueBool: typeof value === "boolean" ? value : null,
      },
    });
  }
}

async function main() {
  console.log("→ RBAC...");
  const users = await seedRbac();
  console.log("→ Modèle de scoring...");
  await seedScoringModel();
  console.log("→ Régime BKAM 19/G/2002...");
  await seedRegime(REGIME_19G_2002, REGIME_19G_PROVISION_RATES, GUARANTEE_TYPES_19G, new Date("2002-12-23"), false, 1_000_000);
  console.log("→ Régime BKAM 1/W/2025...");
  await seedRegime(REGIME_1W_2025, REGIME_1W_PROVISION_RATES, GUARANTEE_TYPES_1W, new Date("2027-01-01"), true, 5_000_000);
  console.log("→ Projets de démonstration...");
  await seedDemoProjects(users);
  console.log("✓ Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
