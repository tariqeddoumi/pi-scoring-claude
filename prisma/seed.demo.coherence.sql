-- =====================================================================
--  seed.demo.coherence.sql — Complète le jeu de démonstration pour une base
--  pleinement peuplée et cohérente :
--   - remplit les tables vides Attachment et ImportBatch ;
--   - étend le suivi (tranches/lots + rapport de visite) à proj_2 et demo_p3.
--  Idempotent. Application : via Supabase MCP avec SET search_path.
-- =====================================================================

SET search_path TO "pi_scoring";

-- --- Pièces jointes (table Attachment) ---------------------------------
DELETE FROM "Attachment" WHERE id LIKE 'att_demo_%';
INSERT INTO "Attachment"("id","projectId","fileName","url","mimeType","sizeBytes","section","createdAt") VALUES
 ('att_demo_1','proj_1','Permis_de_construire.pdf','https://exemple.ma/docs/proj_1/permis.pdf','application/pdf',512000,'foncier',now()),
 ('att_demo_2','proj_1','Plan_masse.pdf','https://exemple.ma/docs/proj_1/plan_masse.pdf','application/pdf',1840000,'autorisations',now()),
 ('att_demo_3','demo_p10','Etude_marche_villas.pdf','https://exemple.ma/docs/demo_p10/etude.pdf','application/pdf',980000,'commercialisation',now());

-- --- Lot d'import (table ImportBatch) ----------------------------------
INSERT INTO "ImportBatch"("id","fileName","entity","status","mapping","totalRows","successRows","errorRows","errors","importedById","createdAt")
SELECT 'imp_demo_1','portefeuille_promoteurs.xlsx','Promoter','COMPLETED'::"ImportStatus",
 '{"Nom":"name","ICE":"iceNumber"}'::jsonb,6,6,0,NULL,'user_ADMIN',now()
WHERE NOT EXISTS (SELECT 1 FROM "ImportBatch" WHERE id='imp_demo_1');

-- --- Suivi étendu : proj_2 (Résidence Annour) & demo_p3 (Tranche Verdure)
DELETE FROM "Tranche" WHERE "projectId" IN ('proj_2','demo_p3');
DELETE FROM "VisitReport" WHERE "projectId" IN ('proj_2','demo_p3');

INSERT INTO "Tranche"("id","projectId","code","name","orderIndex","status","plannedStart","plannedDelivery","actualDelivery","progressPct","budget","updatedAt") VALUES
 ('tr_p2_t1','proj_2','T1','Tranche unique',0,'EN_TRAVAUX','2025-03-01','2026-12-01',NULL,45,38000000,now()),
 ('tr_p3_t1','demo_p3','T1','Tranche 1',0,'LIVREE','2024-01-01','2025-06-01','2025-06-15',100,42000000,now());

INSERT INTO "Unit"("id","trancheId","reference","type","surfaceSqm","rooms","plannedStanding","plannedPrice","plannedSaleDate","standing","listPrice","status","reservedAt","soldAt","soldPrice","buyerName","deliveredAt","mortgageReleased","mortgageReleasedAt","releasedAmount","updatedAt") VALUES
 -- proj_2 (intermédiaire)
 ('p2t1u1','tr_p2_t1','AN-01','APPARTEMENT',70,3,'MOYEN',750000,'2026-03-01','MOYEN',760000,'VENDU','2026-01-20','2026-02-15',760000,'M. Idrissi',NULL,false,NULL,NULL,now()),
 ('p2t1u2','tr_p2_t1','AN-02','APPARTEMENT',70,3,'MOYEN',750000,'2026-04-01','MOYEN',750000,'RESERVE','2026-04-05',NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p2t1u3','tr_p2_t1','AN-03','APPARTEMENT',80,3,'MOYEN',850000,'2026-05-01','MOYEN',850000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p2t1u4','tr_p2_t1','AN-04','APPARTEMENT',80,3,'MOYEN',850000,'2026-09-01','MOYEN',850000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p2t1u5','tr_p2_t1','AN-05','APPARTEMENT',90,4,'MOYEN_HAUT',1000000,'2026-10-01','MOYEN_HAUT',1000000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p2t1u6','tr_p2_t1','AN-06','APPARTEMENT',90,4,'MOYEN_HAUT',1000000,'2026-07-01','MOYEN_HAUT',1010000,'COMPROMIS','2026-06-10',NULL,NULL,'Mme Naciri',NULL,false,NULL,NULL,now()),
 -- demo_p3 (moyen-haut, livré)
 ('p3t1u1','tr_p3_t1','TV-01','APPARTEMENT',95,4,'MOYEN_HAUT',1300000,'2025-09-01','MOYEN_HAUT',1320000,'LIVRE','2025-07-01','2025-08-01',1320000,'Famille Sefrioui','2025-06-20',true,'2025-09-01',950000,now()),
 ('p3t1u2','tr_p3_t1','TV-02','APPARTEMENT',95,4,'MOYEN_HAUT',1300000,'2025-10-01','MOYEN_HAUT',1310000,'LIVRE','2025-08-01','2025-09-10',1310000,'M. Kabbaj','2025-06-20',true,'2025-10-01',950000,now()),
 ('p3t1u3','tr_p3_t1','TV-03','APPARTEMENT',110,4,'MOYEN_HAUT',1550000,'2025-11-01','MOYEN_HAUT',1540000,'VENDU','2025-10-15','2025-12-01',1540000,'Mme Bennis',NULL,false,NULL,NULL,now()),
 ('p3t1u4','tr_p3_t1','TV-04','APPARTEMENT',110,4,'MOYEN_HAUT',1550000,'2026-01-01','MOYEN_HAUT',1560000,'VENDU','2025-12-20','2026-01-20',1560000,'M. Alami',NULL,false,NULL,NULL,now()),
 ('p3t1u5','tr_p3_t1','TV-05','APPARTEMENT',130,5,'HAUT',1900000,'2026-02-01','HAUT',1900000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now());

INSERT INTO "VisitReport"("id","projectId","authorId","visitDate","inspectorName","trancheCode","status","observedProgressPct","workforceCount","weatherImpact","qualityIssue","safetyIssue","delayRisk","summary","observations","recommendations","rawText","updatedAt") VALUES
 ('vr_p2_1','proj_2','user_RISK_ANALYST','2026-05-20','Rita Analyste','T1','FINALIZED',45,16,false,false,false,false,'Avancement conforme au planning.','Gros œuvre en cours, niveau R+3 atteint.','RAS.',NULL,now()),
 ('vr_p3_1','demo_p3','user_RISK_ANALYST','2026-03-10','Rita Analyste','T1','FINALIZED',100,4,false,false,false,false,'Tranche livrée, finitions terminées.','Réception prononcée, commercialisation quasi achevée.','Suivre les mainlevées restantes.',NULL,now());

SELECT
 (SELECT count(*) FROM "Attachment") AS attachments,
 (SELECT count(*) FROM "ImportBatch") AS imports,
 (SELECT count(DISTINCT t."projectId") FROM "Tranche" t) AS projets_avec_suivi,
 (SELECT count(*) FROM "Unit") AS units;