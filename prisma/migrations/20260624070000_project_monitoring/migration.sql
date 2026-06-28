-- CreateEnum
CREATE TYPE "TrancheStatus" AS ENUM ('PLANIFIEE', 'EN_TRAVAUX', 'LIVREE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('APPARTEMENT', 'VILLA', 'COMMERCE', 'BUREAU', 'TERRAIN', 'AUTRE');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DISPONIBLE', 'RESERVE', 'COMPROMIS', 'VENDU', 'LIVRE', 'DESISTE');

-- CreateEnum
CREATE TYPE "Standing" AS ENUM ('TRES_HAUT', 'HAUT', 'MOYEN_HAUT', 'MOYEN', 'ECONOMIQUE', 'SOCIAL');

-- CreateTable
CREATE TABLE "Tranche" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "TrancheStatus" NOT NULL DEFAULT 'PLANIFIEE',
    "plannedStart" TIMESTAMP(3),
    "plannedDelivery" TIMESTAMP(3),
    "actualDelivery" TIMESTAMP(3),
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tranche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "trancheId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "surfaceSqm" DOUBLE PRECISION,
    "rooms" INTEGER,
    "plannedStanding" "Standing" NOT NULL,
    "plannedPrice" DOUBLE PRECISION,
    "plannedSaleDate" TIMESTAMP(3),
    "standing" "Standing" NOT NULL,
    "listPrice" DOUBLE PRECISION,
    "status" "UnitStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "reservedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "soldPrice" DOUBLE PRECISION,
    "buyerName" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "mortgageReleased" BOOLEAN NOT NULL DEFAULT false,
    "mortgageReleasedAt" TIMESTAMP(3),
    "releasedAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tranche_projectId_idx" ON "Tranche"("projectId");

-- CreateIndex
CREATE INDEX "Unit_trancheId_idx" ON "Unit"("trancheId");

-- AddForeignKey
ALTER TABLE "Tranche" ADD CONSTRAINT "Tranche_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "Tranche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

