import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase côté serveur (App Router) — lecture de session via cookies.
// Sert de socle à l'authentification ; le RBAC applicatif reste géré par
// la table User/Role (lib/rbac.ts).
export function createClient() {
  const cookieStore = cookies();
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

/** Utilisateur applicatif courant : associe l'email Supabase à la table User. */
export async function getCurrentAppUser() {
  const { prisma } = await import("@/lib/prisma");
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
      if (user) return user;
    }
  } catch {
    // Auth non configurée : on retombe sur l'acteur par défaut (démo).
  }
  return prisma.user.findFirst({ where: { role: { name: "RISK_ANALYST" } }, include: { role: true } });
}
