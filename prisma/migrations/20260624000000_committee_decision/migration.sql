-- CreateEnum
CREATE TYPE "CommitteeOutcome" AS ENUM ('FAVORABLE', 'FAVORABLE_CONDITIONS', 'DEFAVORABLE', 'AJOURNE');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'COMMITTEE_DECISION';

-- CreateTable
CREATE TABLE "CommitteeDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outcome" "CommitteeOutcome" NOT NULL,
    "chairId" TEXT NOT NULL,
    "quorum" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "votesAbstain" INTEGER NOT NULL DEFAULT 0,
    "approvedAmount" DOUBLE PRECISION,
    "conditions" TEXT,
    "validUntil" TIMESTAMP(3),
    "minutesRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommitteeDecision_projectId_idx" ON "CommitteeDecision"("projectId");

-- AddForeignKey
ALTER TABLE "CommitteeDecision" ADD CONSTRAINT "CommitteeDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeDecision" ADD CONSTRAINT "CommitteeDecision_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

