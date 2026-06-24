import { createBrowserClient } from "@supabase/ssr";

// Client Supabase côté navigateur — USAGE STRICTEMENT LIMITÉ À L'AUTHENTIFICATION
// (signIn/signOut/getUser). Aucune lecture/écriture de données métier ici :
// le schéma pi_scoring est isolé en backend-only (cf. prisma/security/backend_only.sql
// et docs/ADR-001-isolation-backend-only.md), la clé anon n'y a aucun privilège.
// Toutes les données transitent par Prisma côté serveur.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
