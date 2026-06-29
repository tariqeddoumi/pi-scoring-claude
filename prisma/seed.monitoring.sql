-- =====================================================================
--  seed.monitoring.sql — Données démo du SUIVI DE PROMOTION (tranches/lots).
--  Idempotent : purge des tranches des projets démo (cascade sur les lots),
--  puis réinsertion. Illustre : multi-tranches, ventilation par type/standing,
--  décalage business plan (retards de calendrier + décote de prix),
--  déclassement de standing (TRES_HAUT → MOYEN) et suivi des mainlevées.
--  Application : via Supabase MCP avec SET search_path TO "pi_scoring".
-- =====================================================================

SET search_path TO "pi_scoring";

DELETE FROM "Tranche" WHERE "projectId" IN ('proj_1','demo_p10');

-- =====================================================================
--  proj_1 — Résidence Les Jardins de l'Atlas (appartements, sain)
-- =====================================================================
INSERT INTO "Tranche"("id","projectId","code","name","orderIndex","status","plannedStart","plannedDelivery","actualDelivery","progressPct","budget","updatedAt") VALUES
 ('tr_p1_t1','proj_1','T1','Tranche 1 — Bâtiment A',0,'LIVREE','2024-01-01','2025-06-01','2025-07-15',100,45000000,now()),
 ('tr_p1_t2','proj_1','T2','Tranche 2 — Bâtiment B',1,'EN_TRAVAUX','2025-01-01','2026-09-01',NULL,55,52000000,now());

INSERT INTO "Unit"("id","trancheId","reference","type","surfaceSqm","rooms","plannedStanding","plannedPrice","plannedSaleDate","standing","listPrice","status","reservedAt","soldAt","soldPrice","buyerName","deliveredAt","mortgageReleased","mortgageReleasedAt","releasedAmount","updatedAt") VALUES
 ('p1t1u1','tr_p1_t1','A-101','APPARTEMENT',85,3,'MOYEN_HAUT',1200000,'2024-09-01','MOYEN_HAUT',1250000,'LIVRE','2024-07-01','2024-08-15',1260000,'Famille Bennani','2025-07-20',true,'2025-08-01',900000,now()),
 ('p1t1u2','tr_p1_t1','A-102','APPARTEMENT',85,3,'MOYEN_HAUT',1200000,'2024-10-01','MOYEN_HAUT',1240000,'LIVRE','2024-08-01','2024-09-10',1240000,'M. Alaoui','2025-07-20',true,'2025-08-10',880000,now()),
 ('p1t1u3','tr_p1_t1','A-103','APPARTEMENT',95,4,'MOYEN_HAUT',1400000,'2024-11-01','MOYEN_HAUT',1420000,'VENDU','2024-10-15','2024-12-05',1420000,'Mme Tazi',NULL,true,'2025-01-15',1000000,now()),
 ('p1t1u4','tr_p1_t1','A-104','APPARTEMENT',95,4,'MOYEN_HAUT',1400000,'2025-01-01','MOYEN_HAUT',1400000,'VENDU','2025-01-10','2025-02-20',1380000,'M. Chraibi',NULL,false,NULL,NULL,now()),
 ('p1t1u5','tr_p1_t1','A-105','APPARTEMENT',110,4,'MOYEN_HAUT',1650000,'2025-02-01','MOYEN_HAUT',1700000,'LIVRE','2024-12-20','2025-01-15',1700000,'Famille Idrissi','2025-07-25',true,'2025-08-05',1200000,now()),
 ('p1t1u6','tr_p1_t1','A-106','APPARTEMENT',110,4,'MOYEN_HAUT',1650000,'2025-03-01','MOYEN_HAUT',1630000,'VENDU','2025-03-10','2025-04-10',1630000,'M. Berrada',NULL,false,NULL,NULL,now()),
 ('p1t2u1','tr_p1_t2','B-201','APPARTEMENT',85,3,'MOYEN_HAUT',1300000,'2025-12-01','MOYEN_HAUT',1320000,'VENDU','2025-11-01','2025-11-20',1320000,'Mme El Fassi',NULL,false,NULL,NULL,now()),
 ('p1t2u2','tr_p1_t2','B-202','APPARTEMENT',85,3,'MOYEN_HAUT',1300000,'2026-01-01','MOYEN_HAUT',1310000,'COMPROMIS','2025-12-15',NULL,NULL,'M. Saidi',NULL,false,NULL,NULL,now()),
 ('p1t2u3','tr_p1_t2','B-203','APPARTEMENT',95,4,'MOYEN_HAUT',1500000,'2026-02-01','MOYEN_HAUT',1520000,'RESERVE','2026-02-10',NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p1t2u4','tr_p1_t2','B-204','APPARTEMENT',95,4,'MOYEN_HAUT',1500000,'2026-03-01','MOYEN_HAUT',1500000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p1t2u5','tr_p1_t2','B-205','APPARTEMENT',110,4,'MOYEN_HAUT',1750000,'2026-08-01','MOYEN_HAUT',1750000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p1t2u6','tr_p1_t2','B-206','APPARTEMENT',110,4,'MOYEN_HAUT',1750000,'2026-09-01','MOYEN_HAUT',1750000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now());

-- =====================================================================
--  demo_p10 — Médina Lofts (villas, sous tension : déclassement + décote)
-- =====================================================================
INSERT INTO "Tranche"("id","projectId","code","name","orderIndex","status","plannedStart","plannedDelivery","actualDelivery","progressPct","budget","updatedAt") VALUES
 ('tr_p10_v1','demo_p10','V1','Villas — Phase 1',0,'EN_TRAVAUX','2024-06-01','2026-03-01',NULL,40,80000000,now());

INSERT INTO "Unit"("id","trancheId","reference","type","surfaceSqm","rooms","plannedStanding","plannedPrice","plannedSaleDate","standing","listPrice","status","reservedAt","soldAt","soldPrice","buyerName","deliveredAt","mortgageReleased","mortgageReleasedAt","releasedAmount","updatedAt") VALUES
 ('p10v1u1','tr_p10_v1','V-01','VILLA',320,6,'TRES_HAUT',6500000,'2025-06-01','MOYEN',5200000,'VENDU','2025-12-01','2026-01-15',5000000,'M. Lahlou',NULL,false,NULL,NULL,now()),
 ('p10v1u2','tr_p10_v1','V-02','VILLA',320,6,'TRES_HAUT',6500000,'2025-08-01','MOYEN_HAUT',5800000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p10v1u3','tr_p10_v1','V-03','VILLA',280,5,'HAUT',5000000,'2025-10-01','HAUT',5000000,'COMPROMIS','2026-05-01',NULL,NULL,'Mme Cherkaoui',NULL,false,NULL,NULL,now()),
 ('p10v1u4','tr_p10_v1','V-04','VILLA',280,5,'HAUT',5000000,'2026-09-01','HAUT',5000000,'DISPONIBLE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now()),
 ('p10v1u5','tr_p10_v1','V-05','VILLA',350,7,'TRES_HAUT',7200000,'2025-12-01','TRES_HAUT',7200000,'DESISTE',NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,now());
