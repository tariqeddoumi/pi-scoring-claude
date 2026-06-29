-- =====================================================================
--  seed.demo.history.sql — Données de démonstration pour rendre visibles
--  l'historique de scores (timeline) et la révision de business plan.
--  Idempotent. Application : via Supabase MCP avec SET search_path.
--   - proj_1 : trajectoire de score (3 runs historiques croissants).
--   - demo_p10 : révision de BP actée sur la villa V-01 (déclassement du plan
--     TRES_HAUT → MOYEN + baisse du prix cible), BP d'origine figé pour audit.
-- =====================================================================

SET search_path TO "pi_scoring";

-- --- Trajectoire de score proj_1 (runs historiques) ---------------------
DELETE FROM "ScoringRun" WHERE id LIKE 'vr_hist_p1_%';
INSERT INTO "ScoringRun"("id","projectId","versionId","runById","status","inputSnapshot","scoreTechnique","scoreAfterPenalties","coeffBAM","scoreFinal","decision","triggeredRedFlags","gateBlocked","createdAt","updatedAt") VALUES
 ('vr_hist_p1_1','proj_1','ver_1','user_RISK_ANALYST','COMPLETED'::"ScoringRunStatus",'{}'::jsonb,58,58,1,58,'WATCH_LIST'::"Decision",'[]'::jsonb,false,'2025-10-01'::timestamp,'2025-10-01'::timestamp),
 ('vr_hist_p1_2','proj_1','ver_1','user_RISK_ANALYST','COMPLETED'::"ScoringRunStatus",'{}'::jsonb,67,67,1,67,'GO_WITH_CONDITIONS'::"Decision",'[]'::jsonb,false,'2026-01-15'::timestamp,'2026-01-15'::timestamp),
 ('vr_hist_p1_3','proj_1','ver_1','user_RISK_ANALYST','COMPLETED'::"ScoringRunStatus",'{}'::jsonb,73,73,1,73,'GO_WITH_CONDITIONS'::"Decision",'[]'::jsonb,false,'2026-04-20'::timestamp,'2026-04-20'::timestamp);

-- --- Révision de BP demo_p10 (villa V-01) -------------------------------
-- Fige le BP d'origine (une seule fois) puis applique la baseline révisée.
UPDATE "Unit" SET
  "originalStanding" = COALESCE("originalStanding", 'TRES_HAUT'::"Standing"),
  "originalPrice"    = COALESCE("originalPrice", 6500000),
  "originalSaleDate" = COALESCE("originalSaleDate", '2025-06-01'::timestamp),
  "plannedStanding"  = 'MOYEN'::"Standing",
  "plannedPrice"     = 5200000
WHERE id = 'p10v1u1';

INSERT INTO "BusinessPlanRevision"("id","projectId","version","reason","status","requestedByEmail","requestedByName","changes","createdAt")
SELECT 'bpr_p10_1','demo_p10',1,'Repositionnement marché — déclassement de la villa V-01','APPROVED'::"BpRevisionStatus",'rita.analyste@demo.ma','Rita Analyste',
 '[{"reference":"V-01","field":"standing","before":"TRES_HAUT","after":"MOYEN"},{"reference":"V-01","field":"price","before":"6500000","after":"5200000"}]'::jsonb,
 '2026-02-20'::timestamp
WHERE NOT EXISTS (SELECT 1 FROM "BusinessPlanRevision" WHERE "projectId"='demo_p10' AND version=1);

SELECT
 (SELECT count(*) FROM "ScoringRun" WHERE "projectId"='proj_1') AS proj1_runs,
 (SELECT count(*) FROM "BusinessPlanRevision" WHERE "projectId"='demo_p10') AS p10_revisions,
 (SELECT "originalStanding"::text || '→' || "plannedStanding"::text FROM "Unit" WHERE id='p10v1u1') AS v01_plan;
