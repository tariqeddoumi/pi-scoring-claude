-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULTED');

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "authorizedAmount" DOUBLE PRECISION NOT NULL,
    "drawnAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ccf" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reservedAgios" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "FacilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Facility_projectId_idx" ON "Facility"("projectId");

-- CreateIndex
CREATE INDEX "Installment_facilityId_idx" ON "Installment"("facilityId");

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

