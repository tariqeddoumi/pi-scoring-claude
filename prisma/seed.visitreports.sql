-- =====================================================================
--  seed.visitreports.sql — Rapports de visite démo (suivi de chantier).
--  Idempotent : purge des rapports des projets démo puis réinsertion.
--  proj_1 : progression saine, conforme au plan.
--  demo_p10 (villas) : chantier en glissement (retard + malfaçon + sécurité),
--  cohérent avec le déclassement de standing déjà semé.
--  Application : via Supabase MCP avec SET search_path TO "pi_scoring".
-- =====================================================================

SET search_path TO "pi_scoring";

DELETE FROM "VisitReport" WHERE "projectId" IN ('proj_1','demo_p10');

INSERT INTO "VisitReport"("id","projectId","authorId","visitDate","inspectorName","trancheCode","status","observedProgressPct","workforceCount","weatherImpact","qualityIssue","safetyIssue","delayRisk","summary","observations","recommendations","rawText","updatedAt") VALUES
 ('vr_p1_1','proj_1','user_RISK_ANALYST','2025-09-15','Rita Analyste',NULL,'FINALIZED',60,18,false,false,false,false,'Gros œuvre terminé sur T1, T2 bien avancée.','Coulage des derniers planchers T2 en cours.','Maintenir la cadence.',NULL,now()),
 ('vr_p1_2','proj_1','user_RISK_ANALYST','2026-01-20','Rita Analyste',NULL,'FINALIZED',68,22,true,false,false,false,'Avancement conforme malgré quelques intempéries.','Pluies en début de mois, rattrapées depuis.','RAS.',NULL,now()),
 ('vr_p1_3','proj_1','user_RISK_ANALYST','2026-05-10','Rita Analyste','T2','FINALIZED',74,20,false,false,false,false,'Second œuvre en cours, planning tenu.','Pose des menuiseries et réseaux.','RAS.',NULL,now()),
 ('vr_p10_1','demo_p10','user_RISK_ANALYST','2025-09-01','Karim Chargé d''affaires','V1','FINALIZED',20,14,false,false,false,true,'Retard constaté sur les fondations.','Fondations villas V-01 à V-03 en retard de 6 semaines.','Renforcer les équipes.','Visite du 01/09/2025, tranche V1. Avancement 20%. 14 ouvriers. Retard sur les fondations.',now()),
 ('vr_p10_2','demo_p10','user_RISK_ANALYST','2026-02-15','Karim Chargé d''affaires','V1','FINALIZED',30,10,false,true,false,true,'Malfaçons sur V-01, reprise nécessaire. Retard confirmé.','Fissures sur voile béton V-01. Standing revu à la baisse envisagé.','Reprise des malfaçons avant poursuite.','Visite du 15/02/2026, tranche V1. Avancement 30%. Malfaçon et fissures constatées. Retard confirmé.',now()),
 ('vr_p10_3','demo_p10','user_RISK_ANALYST','2026-06-01','Karim Chargé d''affaires','V1','FINALIZED',32,8,false,false,true,true,'Sous-effectif, incident sécurité mineur. Chantier en glissement.','Effectif réduit, EPI manquants signalés.','Plan de rattrapage et mise en conformité HSE.','Visite du 01/06/2026, tranche V1. Avancement 32%. Sous-effectif, 8 ouvriers. Problème de sécurité (EPI). Glissement du planning.',now());

SELECT count(*) AS reports FROM "VisitReport" WHERE "projectId" IN ('proj_1','demo_p10');
