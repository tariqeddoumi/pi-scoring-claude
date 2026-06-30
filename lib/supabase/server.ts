import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase côté serveur (App Router) — lecture de session via cookies.
// Sert de socle à l'authentification ; le RBAC applicatif reste géré par
// la table User/Role (lib/rbac.ts).
export async function createClient() {
  // Next 15 : cookies() est asynchrone (Dynamic APIs).
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : ignoré (middleware gère le refresh).
          }
        },
      },
    },
  );
}

/**
 * Utilisateur applicatif courant (deny‑by‑default).
 * Associe l'email de la session Supabase à la table User et exige un compte
 * actif. Retourne `null` si non authentifié, email inconnu, ou compte inactif —
 * aucun repli sur un acteur de démonstration (sécurité : pas d'identité falsifiée).
 */
export async function getCurrentAppUser() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) return null;
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user || !user.active) return null;
    return user;
  } catch {
    // Auth ou base non joignable : échec fermé.
    return null;
  }
}

/** Variante stricte : lève si aucun utilisateur applicatif autorisé. */
export async function requireAppUser() {
  const user = await getCurrentAppUser();
  if (!user) throw new Error("Non authentifié : accès refusé.");
  return user;
}
