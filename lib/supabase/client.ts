import { createBrowserClient } from "@supabase/ssr";

// Client Supabase côté navigateur — USAGE STRICTEMENT LIMITÉ À L'AUTHENTIFICATION
// (signIn/signOut/getUser). Aucune lecture/écriture de données métier ici :
// le schéma pi_scoring est isolé en backend-only (cf. prisma/security/backend_only.sql
// et docs/ADR-001-isolation-backend-only.md), la clé anon n'y a aucun privilège.
// Toutes les données transitent par Prisma côté serveur.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Variables NEXT_PUBLIC_* : figées dans le bundle AU MOMENT du build. Si elles
  // manquent ici, elles étaient absentes de l'environnement de build (les définir
  // sur l'hébergeur ne suffit pas : il faut re-builder ensuite).
  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Configuration absente du build : ${missing}. ` +
        "Définissez ces variables dans l'environnement de build puis relancez un build/déploiement.",
    );
  }
  return createBrowserClient(url, anonKey);
}
