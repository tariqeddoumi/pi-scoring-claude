-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'RISK_ANALYST', 'RELATIONSHIP_MANAGER', 'MANAGER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "CriterionType" AS ENUM ('QUAL', 'NUM');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKING');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('GO', 'GO_WITH_CONDITIONS', 'WATCH_LIST', 'NO_GO');

-- CreateEnum
CREATE TYPE "ScoringRunStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VALIDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RegulatoryClassCode" AS ENUM ('SAIN', 'SENSIBLE', 'PRE_DOUTEUX', 'DOUTEUX', 'COMPROMIS', 'CTX');

-- CreateEnum
CREATE TYPE "TriggerKind" AS ENUM ('DPD', 'RESTRUCTURING', 'QUALITATIVE', 'LEGAL', 'CROSS_DEFAULT');

-- CreateEnum
CREATE TYPE "WorkflowState" AS ENUM ('DRAFT', 'SUBMITTED', 'ANALYST_REVIEW', 'MANAGER_VALIDATION', 'COMMITTEE', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'CALCULATE', 'CLASSIFY', 'PROVISION', 'LOGIN', 'EXPORT', 'IMPORT', 'WORKFLOW_TRANSITION');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promoter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" TEXT,
    "rcNumber" TEXT,
    "iceNumber" TEXT,
    "groupName" TEXT,
    "yearsExperience" INTEGER,
    "completedProjects" INTEGER,
    "internalRating" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealEstateProject" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "rmId" TEXT,
    "city" TEXT,
    "region" TEXT,
    "projectType" TEXT,
    "segment" TEXT,
    "zone" TEXT,
    "totalUnits" INTEGER,
    "landAreaSqm" DOUBLE PRECISION,
    "builtAreaSqm" DOUBLE PRECISION,
    "groupId" TEXT,
    "totalCost" DOUBLE PRECISION,
    "loanAmount" DOUBLE PRECISION,
    "ownEquity" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealEstateProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectInput" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "valueStr" TEXT,
    "valueBool" BOOLEAN,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "bamCoefficients" JSONB,
    "decisionThresholds" JSONB,
    "segmentAdjustments" JSONB,
    "zoneAdjustments" JSONB,
    "scoreScale" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringDomain" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoringDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringCriterion" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CriterionType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "inputKey" TEXT NOT NULL,
    "isGate" BOOLEAN NOT NULL DEFAULT false,
    "gateThreshold" DOUBLE PRECISION,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoringCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringOption" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoringOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRange" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "minIncl" DOUBLE PRECISION,
    "maxExcl" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScoringRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedFlagRule" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule" JSONB NOT NULL,
    "severity" "Severity" NOT NULL,
    "impactDomains" TEXT[],
    "malus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mitigable" BOOLEAN NOT NULL DEFAULT false,
    "mitigantHint" TEXT,

    CONSTRAINT "RedFlagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "runById" TEXT NOT NULL,
    "status" "ScoringRunStatus" NOT NULL DEFAULT 'DRAFT',
    "inputSnapshot" JSONB NOT NULL,
    "scoreTechnique" DOUBLE PRECISION,
    "scoreAfterPenalties" DOUBLE PRECISION,
    "coeffBAM" DOUBLE PRECISION,
    "scoreFinal" DOUBLE PRECISION,
    "decision" "Decision",
    "triggeredRedFlags" JSONB,
    "gateBlocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "rawValue" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "weighted" DOUBLE PRECISION NOT NULL,
    "matchedRef" TEXT,
    "gateBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CriterionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "weighted" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DomainResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryRegime" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hypEvaluationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
    "restructuringPolicy" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryClass" (
    "id" TEXT NOT NULL,
    "regimeId" TEXT NOT NULL,
    "code" "RegulatoryClassCode" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isWatchList" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "blocksGo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegulatoryClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryTrigger" (
    "id" TEXT NOT NULL,
    "regimeId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "kind" "TriggerKind" NOT NULL,
    "dpdMin" INTEGER,
    "dpdMax" INTEGER,
    "condition" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "RegulatoryTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisionRate" (
    "id" TEXT NOT NULL,
    "regimeId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "ProvisionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuaranteeType" (
    "id" TEXT NOT NULL,
    "regimeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "quotity" DOUBLE PRECISION NOT NULL,
    "haircut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abatementProfile" TEXT NOT NULL DEFAULT 'NONE',
    "requiresRank1" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "GuaranteeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guarantee" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "description" TEXT,
    "marketValue" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "yearsInSouffrance" INTEGER NOT NULL DEFAULT 0,
    "recentlyEvaluated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guarantee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "regimeId" TEXT NOT NULL,
    "scoringRunId" TEXT,
    "resultClass" "RegulatoryClassCode" NOT NULL,
    "isWatchList" BOOLEAN NOT NULL DEFAULT false,
    "groupContagionClass" "RegulatoryClassCode",
    "restructuringNote" TEXT,
    "triggeredBy" JSONB NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassificationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisionRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "classificationRunId" TEXT NOT NULL,
    "ead" DOUBLE PRECISION NOT NULL,
    "reservedAgios" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eligibleGuarantees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "guaranteeBreakdown" JSONB,
    "provisionBase" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "provisionAmount" DOUBLE PRECISION NOT NULL,
    "classCode" "RegulatoryClassCode" NOT NULL,
    "isIrregular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromState" "WorkflowState",
    "toState" "WorkflowState" NOT NULL,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "mapping" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RealEstateProject_reference_key" ON "RealEstateProject"("reference");

-- CreateIndex
CREATE INDEX "ProjectInput_projectId_idx" ON "ProjectInput"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInput_projectId_key_key" ON "ProjectInput"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringModel_code_key" ON "ScoringModel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringModelVersion_modelId_version_key" ON "ScoringModelVersion"("modelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringDomain_versionId_code_key" ON "ScoringDomain"("versionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringCriterion_domainId_code_key" ON "ScoringCriterion"("domainId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringOption_criterionId_value_key" ON "ScoringOption"("criterionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "RedFlagRule_versionId_code_key" ON "RedFlagRule"("versionId", "code");

-- CreateIndex
CREATE INDEX "ScoringRun_projectId_idx" ON "ScoringRun"("projectId");

-- CreateIndex
CREATE INDEX "CriterionResult_runId_idx" ON "CriterionResult"("runId");

-- CreateIndex
CREATE INDEX "DomainResult_runId_idx" ON "DomainResult"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryRegime_code_key" ON "RegulatoryRegime"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryClass_regimeId_code_key" ON "RegulatoryClass"("regimeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisionRate_classId_effectiveFrom_key" ON "ProvisionRate"("classId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "GuaranteeType_regimeId_code_key" ON "GuaranteeType"("regimeId", "code");

-- CreateIndex
CREATE INDEX "Guarantee_projectId_idx" ON "Guarantee"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationRun_scoringRunId_key" ON "ClassificationRun"("scoringRunId");

-- CreateIndex
CREATE INDEX "ClassificationRun_projectId_idx" ON "ClassificationRun"("projectId");

-- CreateIndex
CREATE INDEX "ProvisionRun_projectId_idx" ON "ProvisionRun"("projectId");

-- CreateIndex
CREATE INDEX "WorkflowStep_projectId_idx" ON "WorkflowStep"("projectId");

-- CreateIndex
CREATE INDEX "Comment_projectId_idx" ON "Comment"("projectId");

-- CreateIndex
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealEstateProject" ADD CONSTRAINT "RealEstateProject_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealEstateProject" ADD CONSTRAINT "RealEstateProject_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInput" ADD CONSTRAINT "ProjectInput_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringModelVersion" ADD CONSTRAINT "ScoringModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ScoringModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringDomain" ADD CONSTRAINT "ScoringDomain_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScoringModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringCriterion" ADD CONSTRAINT "ScoringCriterion_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ScoringDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringOption" ADD CONSTRAINT "ScoringOption_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScoringCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRange" ADD CONSTRAINT "ScoringRange_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScoringCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlagRule" ADD CONSTRAINT "RedFlagRule_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScoringModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ScoringModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_runById_fkey" FOREIGN KEY ("runById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionResult" ADD CONSTRAINT "CriterionResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScoringRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionResult" ADD CONSTRAINT "CriterionResult_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScoringCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainResult" ADD CONSTRAINT "DomainResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScoringRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainResult" ADD CONSTRAINT "DomainResult_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ScoringDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryClass" ADD CONSTRAINT "RegulatoryClass_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "RegulatoryRegime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryTrigger" ADD CONSTRAINT "RegulatoryTrigger_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "RegulatoryRegime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryTrigger" ADD CONSTRAINT "RegulatoryTrigger_classId_fkey" FOREIGN KEY ("classId") REFERENCES "RegulatoryClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionRate" ADD CONSTRAINT "ProvisionRate_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "RegulatoryRegime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionRate" ADD CONSTRAINT "ProvisionRate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "RegulatoryClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuaranteeType" ADD CONSTRAINT "GuaranteeType_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "RegulatoryRegime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantee" ADD CONSTRAINT "Guarantee_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantee" ADD CONSTRAINT "Guarantee_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "GuaranteeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationRun" ADD CONSTRAINT "ClassificationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationRun" ADD CONSTRAINT "ClassificationRun_regimeId_fkey" FOREIGN KEY ("regimeId") REFERENCES "RegulatoryRegime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationRun" ADD CONSTRAINT "ClassificationRun_scoringRunId_fkey" FOREIGN KEY ("scoringRunId") REFERENCES "ScoringRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionRun" ADD CONSTRAINT "ProvisionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisionRun" ADD CONSTRAINT "ProvisionRun_classificationRunId_fkey" FOREIGN KEY ("classificationRunId") REFERENCES "ClassificationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RealEstateProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

