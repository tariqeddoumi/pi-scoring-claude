-- CreateEnum
CREATE TYPE "BpRevisionStatus" AS ENUM ('DRAFT', 'APPROVED');

-- AlterTable : business plan d'origine (v0 figé) sur le lot
ALTER TABLE "Unit" ADD COLUMN "originalStanding" "Standing";
ALTER TABLE "Unit" ADD COLUMN "originalPrice" DOUBLE PRECISION;
ALTER TABLE "Unit" ADD COLUMN "originalSaleDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BusinessPlanRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BpRevisionStatus" NOT NULL DEFAULT 'APPROVED',
    "requestedByEmail" TEXT,
    "requestedByName" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPlanRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessPlanRevision_projectId_idx" ON "BusinessPlanRevision"("projectId");

-- AddForeignKey
ALTER TABLE "BusinessPlanRevision" ADD CONSTRAINT "BusinessPlanRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
