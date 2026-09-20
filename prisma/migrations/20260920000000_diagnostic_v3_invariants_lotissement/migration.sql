-- Remédiation diagnostic PI_PROMOTION v3.0.0.
-- Appliqué en base via Supabase MCP (schéma pi_scoring) ; fichier de référence.

-- F02 : décision « Dossier incomplet » (donnée critique absente / qualité bloquante).
ALTER TYPE "Decision" ADD VALUE IF NOT EXISTS 'DOSSIER_INCOMPLET';

-- Volet 3 : événement imposant un retour en comité + re-scoring (reprofilage,
-- restructuration, modification de lot…).
ALTER TABLE "ProjectEvent" ADD COLUMN IF NOT EXISTS "requiresCommittee" BOOLEAN NOT NULL DEFAULT false;

-- Volet 2 (lotissement) : rattachement des événements et des déblocages au lot.
ALTER TABLE "ProjectEvent" ADD COLUMN IF NOT EXISTS "trancheId" TEXT;
ALTER TABLE "DisbursementMilestone" ADD COLUMN IF NOT EXISTS "trancheId" TEXT;

CREATE INDEX IF NOT EXISTS "DisbursementMilestone_trancheId_idx" ON "DisbursementMilestone"("trancheId");

ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_trancheId_fkey"
  FOREIGN KEY ("trancheId") REFERENCES "Tranche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisbursementMilestone" ADD CONSTRAINT "DisbursementMilestone_trancheId_fkey"
  FOREIGN KEY ("trancheId") REFERENCES "Tranche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Métadonnées v3 des critères (dictionnaire, familles, gates par jalon).
ALTER TABLE "ScoringCriterion" ADD COLUMN IF NOT EXISTS "critical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScoringCriterion" ADD COLUMN IF NOT EXISTS "family" TEXT;
ALTER TABLE "ScoringCriterion" ADD COLUMN IF NOT EXISTS "gateStage" TEXT;
ALTER TABLE "ScoringCriterion" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "ScoringCriterion" ADD COLUMN IF NOT EXISTS "definition" TEXT;

-- Refonte D5 : effet, retour comité, référence réglementaire des alertes.
ALTER TABLE "RedFlagRule" ADD COLUMN IF NOT EXISTS "effect" TEXT;
ALTER TABLE "RedFlagRule" ADD COLUMN IF NOT EXISTS "requiresCommittee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RedFlagRule" ADD COLUMN IF NOT EXISTS "regRef" TEXT;
