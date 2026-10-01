-- Modèle PI_PROMOTION v5 (diagnostic du 1er octobre 2026) : régionalité,
-- financement par tranche, programme mixte, équipements exigés, suivi des
-- déblocages. Changements additifs uniquement.

-- Composante hôtelière d'un programme mixte.
ALTER TYPE "UnitType" ADD VALUE IF NOT EXISTS 'HOTEL';

-- Périmètre financé : tranche financée, facilité rattachée à une tranche.
ALTER TABLE "Tranche" ADD COLUMN IF NOT EXISTS "financed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Facility" ADD COLUMN IF NOT EXISTS "trancheId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Facility" ADD CONSTRAINT "Facility_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "Tranche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Déclaration des équipements exigés.
ALTER TABLE "RealEstateProject" ADD COLUMN IF NOT EXISTS "equipmentDeclared" BOOLEAN;

CREATE TABLE IF NOT EXISTS "ProjectEquipment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trancheId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "origin" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "budgeted" BOOLEAN NOT NULL DEFAULT false,
    "fundedBy" TEXT,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "conditionsDelivery" BOOLEAN NOT NULL DEFAULT false,
    "handedOver" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectEquipment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectEquipment_projectId_idx" ON "ProjectEquipment"("projectId");
DO $$ BEGIN
  ALTER TABLE "ProjectEquipment" ADD CONSTRAINT "ProjectEquipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectEquipment" ADD CONSTRAINT "ProjectEquipment_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "Tranche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
