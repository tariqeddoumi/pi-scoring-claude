-- CreateEnum
CREATE TYPE "VisitReportStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "VisitReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "inspectorName" TEXT,
    "trancheCode" TEXT,
    "status" "VisitReportStatus" NOT NULL DEFAULT 'DRAFT',
    "observedProgressPct" DOUBLE PRECISION,
    "workforceCount" INTEGER,
    "weatherImpact" BOOLEAN NOT NULL DEFAULT false,
    "qualityIssue" BOOLEAN NOT NULL DEFAULT false,
    "safetyIssue" BOOLEAN NOT NULL DEFAULT false,
    "delayRisk" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "observations" TEXT,
    "recommendations" TEXT,
    "rawText" TEXT,
    "extracted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitReport_projectId_idx" ON "VisitReport"("projectId");

-- AddForeignKey
ALTER TABLE "VisitReport" ADD CONSTRAINT "VisitReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReport" ADD CONSTRAINT "VisitReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
