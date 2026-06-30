-- Qualité des données de classification (1/W §6.2) + dérogations comité (#10).
-- Appliqué en base via Supabase MCP (schéma pi_scoring) ; fichier de référence.

-- Statut de complétude des données (Phase 4).
ALTER TABLE "ClassificationRun" ADD COLUMN "dataQualityStatus" TEXT;
ALTER TABLE "ClassificationRun" ADD COLUMN "missingCriticalData" JSONB;

-- Dérogations de classification (override comité).
CREATE TYPE "OverrideStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "ClassificationRun" ADD COLUMN "engineClass" "RegulatoryClassCode";
ALTER TABLE "ClassificationRun" ADD COLUMN "overrideNote" TEXT;

CREATE TABLE "RegulatoryOverride" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "forcedClass" "RegulatoryClassCode" NOT NULL,
    "engineClass" "RegulatoryClassCode",
    "justification" TEXT NOT NULL,
    "status" "OverrideStatus" NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RegulatoryOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegulatoryOverride_projectId_idx" ON "RegulatoryOverride"("projectId");

ALTER TABLE "RegulatoryOverride" ADD CONSTRAINT "RegulatoryOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegulatoryOverride" ADD CONSTRAINT "RegulatoryOverride_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegulatoryOverride" ADD CONSTRAINT "RegulatoryOverride_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
