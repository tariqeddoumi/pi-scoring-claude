// Jeu de données des tests d'intégration et de bout en bout : 30 dossiers
// déterministes (références PI-E2E-xxx) répartis sur les segments, villes,
// décisions, classes et étapes du circuit, avec des scores anciens et récents,
// des événements matériels, des décisions de comité proches de l'expiration et
// des équipements à échéance. À lancer après `npm run seed`, sur une base de
// test uniquement : npx tsx scripts/seed-e2e.ts
// Rejouable : les dossiers PI-E2E-xxx existants sont supprimés puis recréés.

import { PrismaClient, type Decision, type RegulatoryClassCode, type WorkflowState } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 24 * 3600 * 1000;
const PREFIX = "PI-E2E-";
const E2E_PROJECT_COUNT = 30;

const SEGMENTS = ["social", "intermediaire", "moyen_haut", "touristique", "bureaux", "commerces", "villas"];
const CITIES = ["casablanca", "rabat", "tanger", "marrakech", "fes", "agadir", "kenitra", "temara"];
const NAMES = [
  "Résidence Al Amal", "Les Terrasses d'Anfa", "Jardins de Témara", "Éden Park", "Riad Al Andalous",
  "Opale Bureaux", "Les Orangers", "Marina Côté Sud", "Clos des Oliviers", "Écrin du Souss",
  "Résidence Ennour", "Pôle Médina", "Villas de l'Ourika", "Les Hauts de Fès", "Atrium Kénitra",
];
const PROMOTERS = ["Immobilière Al Baraka", "Société Énergie Habitat", "Groupe Chraïbi Promotion", "Ouarzazi & Fils", "Nord Développement", "Sud Résidences"];
const DECISIONS: Decision[] = ["GO", "GO_WITH_CONDITIONS", "WATCH_LIST", "NO_GO"];
const CLASSES: RegulatoryClassCode[] = ["SAIN", "SAIN", "SENSIBLE", "PRE_DOUTEUX", "SAIN", "DOUTEUX"];
const STATES: WorkflowState[] = ["SUBMITTED", "BRANCH_REVIEW", "ANALYST_REVIEW", "MANAGER_VALIDATION", "COMMITTEE", "APPROVED", "REJECTED"];

async function main() {
  const now = Date.now();
  const [version, regime, analyst, rm, manager] = await Promise.all([
    prisma.scoringModelVersion.findFirst({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" } }),
    prisma.regulatoryRegime.findFirst({ orderBy: { code: "asc" } }),
    prisma.user.findUnique({ where: { email: "analyst@bank.ma" } }),
    prisma.user.findUnique({ where: { email: "rm@bank.ma" } }),
    prisma.user.findUnique({ where: { email: "manager@bank.ma" } }),
  ]);
  if (!version || !regime || !analyst || !rm || !manager) {
    throw new Error("Base non initialisée : lancer `npm run seed` avant ce script.");
  }

  await prisma.realEstateProject.deleteMany({ where: { reference: { startsWith: PREFIX } } });
  await prisma.promoter.deleteMany({ where: { name: { in: PROMOTERS }, projects: { none: {} } } });
  const promoters = await Promise.all(PROMOTERS.map((name, i) =>
    prisma.promoter.create({ data: { name, legalForm: i % 2 ? "SARL" : "SA", yearsExperience: 3 + i * 4, completedProjects: i * 2 } })));

  for (let i = 0; i < E2E_PROJECT_COUNT; i++) {
    const n = i + 1;
    const createdAt = new Date(now - (400 - i * 7) * DAY);
    const project = await prisma.realEstateProject.create({
      data: {
        reference: `${PREFIX}${String(n).padStart(3, "0")}`,
        name: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? " II" : ""}`,
        promoterId: promoters[i % promoters.length]!.id,
        rmId: i % 2 === 0 ? rm.id : null,
        city: CITIES[i % CITIES.length],
        segment: SEGMENTS[i % SEGMENTS.length],
        // Un dossier sur sept sans montant (tri : valeurs absentes en fin de liste).
        loanAmount: i % 7 === 6 ? null : 20_000_000 + ((i * 37) % 23) * 9_000_000,
        totalCost: 80_000_000 + i * 5_000_000,
        status: "EN_ANALYSE",
        createdAt,
      },
    });

    // Un dossier sur cinq n'a jamais été scoré ; les autres ont un score récent ou ancien.
    if (i % 5 !== 4) {
      const ageDays = [20, 120, 400, 45, 200, 10][i % 6]!;
      const scoredAt = new Date(now - ageDays * DAY);
      const score = 35 + ((i * 13) % 55) + (i % 3) * 0.25;
      const run = await prisma.scoringRun.create({
        data: {
          projectId: project.id, versionId: version.id, runById: analyst.id, status: "COMPLETED",
          inputSnapshot: {}, scoreFinal: score, decision: DECISIONS[i % DECISIONS.length],
          triggeredRedFlags: i % 6 === 2 ? [{ code: "E2E_PRESALES", name: "Préventes insuffisantes", severity: "HIGH", malus: 5 }] : [],
          createdAt: scoredAt,
        },
      });
      await prisma.classificationRun.create({
        data: {
          projectId: project.id, regimeId: regime.id, scoringRunId: run.id,
          resultClass: CLASSES[i % CLASSES.length]!, triggeredBy: [], inputSnapshot: {}, createdAt: scoredAt,
        },
      });
      // Événement matériel postérieur au score (re-scoring requis) sur un dossier sur huit.
      if (i % 8 === 1) {
        await prisma.projectEvent.create({
          data: {
            projectId: project.id,
            ...(i % 16 === 1
              ? { type: "incident_paiement", severity: "CRITICAL", title: "Échéance impayée" }
              : { type: "probleme_administratif", severity: "WARNING", title: "Blocage de l'autorisation de lotir" }),
            eventDate: new Date(scoredAt.getTime() + 5 * DAY),
            affectsScoring: true, createdById: analyst.id,
          },
        });
      }
    }

    // Circuit de validation : quelques dossiers restent en brouillon (aucune étape).
    if (i % 9 !== 0) {
      await prisma.workflowStep.create({
        data: { projectId: project.id, fromState: "DRAFT", toState: STATES[i % STATES.length]!, actorId: analyst.id, createdAt: new Date(createdAt.getTime() + DAY) },
      });
    }

    // Décisions de comité : bientôt expirée, ou expirée.
    if (i % 10 === 3 || i % 10 === 7) {
      await prisma.committeeDecision.create({
        data: {
          projectId: project.id, outcome: "FAVORABLE_CONDITIONS", chairId: manager.id,
          conditions: "Préventes ≥ 30 % avant premier déblocage", validUntil: new Date(now + (i % 10 === 3 ? 12 : -6) * DAY),
        },
      });
    }

    // Équipement exigé par la commune, échéance proche.
    if (i % 11 === 5) {
      await prisma.projectEquipment.create({
        data: { projectId: project.id, kind: "mosquee", label: "Mosquée de quartier", dueDate: new Date(now + 20 * DAY), conditionsDelivery: true, progressPct: 40 },
      });
    }
  }
  console.log(`✓ ${E2E_PROJECT_COUNT} dossiers de test (${PREFIX}xxx) créés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
