-- Alignement sur les pratiques bancaires marocaines (crédit promoteur).
-- Appliqué en base via Supabase MCP (schéma pi_scoring) ; fichier de référence.

-- Nature du programme + quotité de désengagement des mainlevées partielles.
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "programKind" TEXT DEFAULT 'CONSTRUCTION';
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "releaseQuotity" DOUBLE PRECISION;

-- Nature du concours (avance foncier / accompagnement / in fine…).
ALTER TABLE "Facility" ADD COLUMN IF NOT EXISTS "nature" TEXT;

-- Situation de travaux visée (architecte / BET) justifiant un tirage.
ALTER TABLE "DisbursementMilestone" ADD COLUMN IF NOT EXISTS "worksCertificateRef" TEXT;
ALTER TABLE "DisbursementMilestone" ADD COLUMN IF NOT EXISTS "worksCertifiedPct" DOUBLE PRECISION;

-- Financement de l'acquéreur et dispositif d'aide, par lot.
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "buyerFinancingStatus" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "buyerAidScheme" TEXT;

-- Chaîne d'autorisations du programme.
CREATE TABLE IF NOT EXISTS "ProjectAuthorization" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "obtained" BOOLEAN NOT NULL DEFAULT false,
    "obtainedAt" TIMESTAMP(3),
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAuthorization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAuthorization_projectId_code_key" ON "ProjectAuthorization"("projectId", "code");
CREATE INDEX IF NOT EXISTS "ProjectAuthorization_projectId_idx" ON "ProjectAuthorization"("projectId");

-- Référentiel métier ADMINISTRABLE (sans redéploiement).
CREATE TABLE IF NOT EXISTS "ReferentialItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferentialItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferentialItem_kind_code_key" ON "ReferentialItem"("kind","code");
CREATE INDEX IF NOT EXISTS "ReferentialItem_kind_active_idx" ON "ReferentialItem"("kind","active");
