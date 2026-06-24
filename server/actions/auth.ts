"use server";

// Actions de journalisation des événements d'authentification (V1.5 lot D).
// La connexion/déconnexion Supabase se fait côté client (GoTrue) ; ces actions
// persistent l'événement dans la piste d'audit et le flux de logs sécurité.

import { getCurrentAppUser } from "@/lib/supabase/server";
import { recordAudit } from "@/server/engines/auditService";
import { securityEvent } from "@/lib/securityLog";

/** Connexion réussie : journalise LOGIN (audit + log sécurité). */
export async function recordLogin() {
  const user = await getCurrentAppUser();
  if (!user) return;
  securityEvent("login_success", {
    actorId: user.id,
    email: user.email,
    role: user.role.name,
  });
  try {
    await recordAudit({
      actorId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      metadata: { event: "login" },
    });
  } catch {
    // L'échec de journalisation ne doit pas bloquer la connexion.
  }
}

/** Échec de connexion : journalise (log sécurité uniquement). */
export async function recordLoginFailure(email: string) {
  securityEvent("login_failure", { email, reason: "invalid_credentials" });
}
