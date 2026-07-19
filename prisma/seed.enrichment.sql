-- =====================================================================
--  seed.enrichment.sql — Complément de seed démo (juillet 2026) :
--  signalétique promoteurs, liens entre promoteurs, fiche projet enrichie
--  (foncier/autorisations/calendrier/référence SI), journal d'événements,
--  planning des déblocages (jalons + déblocages rattachés / à rattacher).
--  IDEMPOTENT : identifiants fixes + ON CONFLICT DO NOTHING / updates ciblés.
-- =====================================================================
SET search_path TO "pi_scoring";
BEGIN;

-- 1. Signalétique promoteurs -------------------------------------------------
UPDATE "Promoter" SET
  "legalForm"='SA', "ifNumber"='40112233', "cnssNumber"='7788990',
  "patenteNumber"='36502114', "capital"=50000000, "foundedYear"=2004,
  "managerName"='Hassan Berrada', "shareholders"='Famille Berrada 70 %, CIMR 30 %',
  "address"='12, Bd Al Massira', "city"='casablanca', "internalRating"='B+',
  "bankRelations"='AWB (caisse), BCP (crédit promotion)'
WHERE id='promo_1' AND "managerName" IS NULL;

UPDATE "Promoter" SET
  "legalForm"='SARL', "ifNumber"='40225566', "capital"=8000000, "foundedYear"=2015,
  "managerName"='Salima El Fassi', "shareholders"='S. El Fassi 60 %, K. El Fassi 40 %',
  "city"='rabat', "internalRating"='C+'
WHERE id='promo_2' AND "managerName" IS NULL;

UPDATE "Promoter" SET
  "legalForm"='SA', "ifNumber"='40331122', "capital"=120000000, "foundedYear"=1998,
  "managerName"='Omar Benjelloun', "shareholders"='Holding Benjelloun 85 %, flottant 15 %',
  "city"='casablanca', "internalRating"='A'
WHERE id='dpromo_1' AND "managerName" IS NULL;

UPDATE "Promoter" SET
  "legalForm"='SARL', "ifNumber"='40447788', "capital"=15000000, "foundedYear"=2012,
  "managerName"='Nawal Chraibi', "city"='marrakech', "internalRating"='B'
WHERE id='dpromo_2' AND "managerName" IS NULL;

UPDATE "Promoter" SET
  "legalForm"='SA', "ifNumber"='40559911', "capital"=60000000, "foundedYear"=2007,
  "managerName"='Youssef Alaoui', "shareholders"='Y. Alaoui 55 %, MCMA 45 %',
  "city"='tanger', "internalRating"='B'
WHERE id='dpromo_3' AND "managerName" IS NULL;

UPDATE "Promoter" SET
  "legalForm"='SARL_AU', "ifNumber"='40663344', "capital"=5000000, "foundedYear"=2018,
  "managerName"='Rachid Amrani', "city"='agadir', "internalRating"='C'
WHERE id='dpromo_4' AND "managerName" IS NULL;

-- 2. Liens entre promoteurs (parties liées) ----------------------------------
INSERT INTO "PromoterLink"("id","fromId","toId","type","note") VALUES
  ('plink_1','dpromo_1','dpromo_3','actionnaire_commun','Participation croisée via Holding Benjelloun'),
  ('plink_2','promo_1','promo_2','dirigeant_commun','Administrateur commun au conseil'),
  ('plink_3','dpromo_3','dpromo_4','caution_croisee','Caution solidaire sur le programme Agadir')
ON CONFLICT DO NOTHING;

-- 3. Fiche projet enrichie (foncier, autorisations, calendrier, réf. SI) ------
UPDATE "RealEstateProject" SET
  "address"='Angle Bd Ghandi / rue Ibn Sina', "landTitleRef"='TF 45812/C',
  "landStatus"='titre_foncier', "buildPermitRef"='AC-2025-0341',
  "buildPermitDate"='2025-09-15', "startDate"='2025-11-01',
  "expectedDeliveryDate"='2027-12-31', "coreBankingRef"='T24-PI-000112',
  "city"='casablanca', "region"='casablanca_settat'
WHERE id='proj_1' AND "landTitleRef" IS NULL;

UPDATE "RealEstateProject" SET
  "landTitleRef"='TF 12904/R', "landStatus"='titre_foncier',
  "buildPermitRef"='AC-2025-0518', "buildPermitDate"='2025-06-20',
  "startDate"='2025-08-15', "expectedDeliveryDate"='2027-06-30',
  "coreBankingRef"='T24-PI-000127', "city"='casablanca', "region"='casablanca_settat'
WHERE id='demo_p3' AND "landTitleRef" IS NULL;

UPDATE "RealEstateProject" SET
  "landTitleRef"='TF 7761/M', "landStatus"='en_cours_immatriculation',
  "buildPermitRef"='AC-2026-0092', "buildPermitDate"='2026-02-10',
  "startDate"='2026-03-01', "expectedDeliveryDate"='2028-03-31',
  "coreBankingRef"='T24-PI-000131', "city"='marrakech', "region"='marrakech_safi'
WHERE id='demo_p4' AND "landTitleRef" IS NULL;

UPDATE "RealEstateProject" SET
  "landTitleRef"='TF 3308/T', "landStatus"='titre_foncier',
  "coreBankingRef"='EVL-EXP-00871', "city"='tanger', "region"='tanger_tetouan_al_hoceima'
WHERE id='demo_p5' AND "landTitleRef" IS NULL;

-- Références SI sur les facilités existantes
UPDATE "Facility" SET "externalRef"='FAC-000112-01' WHERE id='fac_proj1_a' AND "externalRef" IS NULL;
UPDATE "Facility" SET "externalRef"='FAC-000131-01' WHERE id='fac_p4_a' AND "externalRef" IS NULL;
UPDATE "Facility" SET "externalRef"='FAC-00871-01' WHERE id='fac_p9_a' AND "externalRef" IS NULL;

-- 4. Planning des déblocages (BP initial) ------------------------------------
INSERT INTO "DisbursementMilestone"("id","projectId","seq","label","plannedDate","plannedAmount","updatedAt") VALUES
  ('dm_proj1_1','proj_1',1,'Déblocage 1 — acquisition foncier','2025-11-15',40000000,now()),
  ('dm_proj1_2','proj_1',2,'Déblocage 2 — gros œuvre','2026-05-31',40000000,now()),
  ('dm_proj1_3','proj_1',3,'Déblocage 3 — second œuvre & finitions','2027-02-28',30000000,now()),
  ('dm_p4_1','demo_p4',1,'Déblocage 1 — démarrage travaux','2026-04-15',25000000,now()),
  ('dm_p4_2','demo_p4',2,'Déblocage 2 — hors d''eau','2027-01-31',27000000,now())
ON CONFLICT (id) DO NOTHING;

-- 5. Journal d'événements ----------------------------------------------------
INSERT INTO "ProjectEvent"("id","projectId","type","severity","title","eventDate","endDate","amount","note","affectsScoring","resolved","milestoneId","source","createdById") VALUES
  -- proj_1 : autorisation obtenue, deux déblocages (1 rattaché, 1 à rattacher)
  ('pev_proj1_auth','proj_1','obtention_autorisation','INFO','Permis de construire AC-2025-0341','2025-09-15','2025-09-15',NULL,'Autorisation définitive obtenue',false,true,NULL,'MANUAL','user_RELATIONSHIP_MANAGER'),
  ('pev_proj1_dsb1','proj_1','deblocage','INFO','DSB-2025-0448','2025-11-20',NULL,40000000,'Acquisition foncier (import T24)',false,false,'dm_proj1_1','T24','user_RELATIONSHIP_MANAGER'),
  ('pev_proj1_dsb2','proj_1','deblocage','INFO','DSB-2026-0173','2026-06-05',NULL,25000000,'Gros œuvre — 1re tranche (import T24)',false,false,NULL,'T24','user_RELATIONSHIP_MANAGER'),
  -- demo_p3 : arrêt de chantier OUVERT (matériel)
  ('pev_p3_stop','demo_p3','arret_chantier','CRITICAL','Arrêt chantier — litige entreprise GO','2026-05-10',NULL,NULL,'Différend avec l''entreprise de gros œuvre',true,false,NULL,'MANUAL','user_RELATIONSHIP_MANAGER'),
  -- demo_p4 : déblocage à rattacher
  ('pev_p4_dsb1','demo_p4','deblocage','INFO','DSB-2026-0291','2026-04-22',NULL,25000000,'Démarrage travaux',false,false,NULL,'MANUAL','user_RELATIONSHIP_MANAGER'),
  -- demo_p6 : incident de paiement OUVERT (matériel)
  ('pev_p6_incident','demo_p6','incident_paiement','CRITICAL','Échéance juin impayée','2026-06-30',NULL,1200000,'Impayé sur échéance trimestrielle',true,false,NULL,'MANUAL','user_RELATIONSHIP_MANAGER'),
  -- demo_p8 : restructuration actée (clôturée, matérielle)
  ('pev_p8_restruct','demo_p8','restructuration','CRITICAL','Rééchelonnement 24 mois','2026-03-15','2026-03-15',NULL,'Différé de 6 mois + allongement de 24 mois',true,true,NULL,'MANUAL','user_RELATIONSHIP_MANAGER'),
  -- demo_p5 (exploitation) : événement commercial
  ('pev_p5_comm','demo_p5','evenement_commercial','INFO','Signature bail — enseigne internationale','2026-06-01','2026-06-01',NULL,'Bail 9 ans, 2 400 m²',false,true,NULL,'MANUAL','user_RELATIONSHIP_MANAGER'),
  -- proj_2 : mainlevée partielle
  ('pev_proj2_ml','proj_2','mainlevee','INFO','Mainlevée partielle — 6 lots livrés','2026-05-20','2026-05-20',4800000,'Mainlevée après encaissement des prix de vente',false,true,NULL,'MANUAL','user_RELATIONSHIP_MANAGER')
ON CONFLICT (id) DO NOTHING;

COMMIT;
