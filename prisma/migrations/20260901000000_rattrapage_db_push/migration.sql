-- Rattrapage : objets créés en production par « prisma db push » entre juin et
-- septembre 2026 sans migration (événements de projet, planning des
-- déblocages, liens entre promoteurs, fiches promoteur et projet enrichies,
-- nouveaux rôles et étape du circuit). Sans ce rattrapage, une base vierge ne
-- peut pas être reconstruite par « prisma migrate deploy » : la migration
-- 20260920 échoue sur "ProjectEvent".
--
-- Entièrement idempotent : sans effet sur une base qui possède déjà ces objets
-- (production). Contenu obtenu par « prisma migrate diff » entre l'état produit
-- par les migrations antérieures et schema.prisma au commit précédant la
-- migration 20260920 (b3da68e^).

-- Rôles du réseau et étape « avis du directeur de centre d'affaires ».
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'BRANCH_DIRECTOR';
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'REGIONAL_DIRECTOR';
ALTER TYPE "WorkflowState" ADD VALUE IF NOT EXISTS 'BRANCH_REVIEW';

-- Référence du concours dans le SI bancaire.
ALTER TABLE "Facility" ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

-- Fiche promoteur enrichie.
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "bankRelations" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "capital" DOUBLE PRECISION;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "cnssNumber" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "foundedYear" INTEGER;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "ifNumber" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "managerName" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "patenteNumber" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "shareholders" TEXT;
ALTER TABLE "Promoter" ADD COLUMN IF NOT EXISTS "website" TEXT;

-- Fiche projet enrichie (foncier, permis, calendrier, référence SI).
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "buildPermitDate" TIMESTAMP(3);
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "buildPermitRef" TEXT;
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "coreBankingRef" TEXT;
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" TIMESTAMP(3);
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "landStatus" TEXT;
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "landTitleRef" TEXT;
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);

-- Liens entre promoteurs (actionnariat commun, caution croisée…).
CREATE TABLE IF NOT EXISTS "PromoterLink" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoterLink_pkey" PRIMARY KEY ("id")
);

-- Journal des événements du projet.
CREATE TABLE IF NOT EXISTS "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION,
    "note" TEXT,
    "affectsScoring" BOOLEAN NOT NULL DEFAULT false,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "milestoneId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- Planning des déblocages du business plan.
CREATE TABLE IF NOT EXISTS "DisbursementMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "plannedAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DisbursementMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PromoterLink_fromId_idx" ON "PromoterLink"("fromId");
CREATE INDEX IF NOT EXISTS "PromoterLink_toId_idx" ON "PromoterLink"("toId");
CREATE UNIQUE INDEX IF NOT EXISTS "PromoterLink_fromId_toId_type_key" ON "PromoterLink"("fromId", "toId", "type");
CREATE INDEX IF NOT EXISTS "ProjectEvent_projectId_eventDate_idx" ON "ProjectEvent"("projectId", "eventDate");
CREATE INDEX IF NOT EXISTS "DisbursementMilestone_projectId_idx" ON "DisbursementMilestone"("projectId");

DO $$ BEGIN
  ALTER TABLE "Promoter" ADD CONSTRAINT "Promoter_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PromoterLink" ADD CONSTRAINT "PromoterLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PromoterLink" ADD CONSTRAINT "PromoterLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Promoter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "DisbursementMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DisbursementMilestone" ADD CONSTRAINT "DisbursementMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
