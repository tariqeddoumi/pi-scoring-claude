-- Alignement back/front avec le modèle v3/v4 : le résultat complet du moteur
-- (classe interne, notes économique et sûretés, données décisionnelles
-- manquantes, conditions, PD indicative, version) est conservé avec le run
-- pour être affiché et audité tel qu'il a été calculé.
ALTER TABLE "ScoringRun" ADD COLUMN IF NOT EXISTS "details" JSONB;
