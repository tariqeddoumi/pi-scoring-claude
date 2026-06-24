-- =====================================================================
--  Durcissement « backend-only » du schéma métier pi_scoring (V1.5 lot C)
--  --------------------------------------------------------------------
--  Posture : l'application accède aux données EXCLUSIVEMENT via Prisma,
--  connecté avec le rôle `postgres` (propriétaire des tables). Les rôles
--  exposés par la Data API Supabase (`anon`, `authenticated`) — et
--  `service_role`, non utilisé pour les données — ne doivent disposer
--  d'AUCUN privilège sur pi_scoring.
--
--  État constaté avant application : anon/authenticated sans USAGE sur le
--  schéma ni aucun grant de table (isolation déjà effective par création
--  d'un schéma dédié sans exposition). Ce script REND LA POSTURE EXPLICITE
--  et PERMANENTE (idempotent + privilèges par défaut) pour prévenir toute
--  dérive si le schéma venait à être exposé ultérieurement.
--
--  Conséquence RLS : les rôles API ne pouvant pas atteindre le schéma,
--  l'absence de policies RLS est sans effet pratique sur l'exposition.
--  Des policies RLS par rôle ne deviennent pertinentes que si pi_scoring
--  est un jour ajouté aux « Exposed schemas » de l'API (renvoyé en V2).
-- =====================================================================

-- 1. Révocation explicite des privilèges existants (idempotent).
REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA "pi_scoring" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "pi_scoring" FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "pi_scoring" FROM anon, authenticated, service_role;
REVOKE USAGE ON SCHEMA "pi_scoring" FROM anon, authenticated, service_role;

-- 2. Privilèges par défaut : aucune table/séquence/fonction future créée par
--    `postgres` dans pi_scoring ne sera accordée aux rôles API.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "pi_scoring"
  REVOKE ALL ON TABLES    FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "pi_scoring"
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "pi_scoring"
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;
