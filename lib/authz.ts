// =====================================================================
//  Couche d'autorisation serveur (deny‑by‑default).
//  Point d'application unique du RBAC : récupère l'acteur authentifié et
//  vérifie la permission requise. Toute action/route/écran sensible doit
//  passer par `authorize` (échec fermé) ou `currentUserCan` (affichage UI).
// =====================================================================

import "server-only";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { assertPermission, hasPermission, type PermissionCode, type RoleName } from "@/lib/rbac";

/** Erreur d'autorisation distincte des erreurs techniques. */
export class AuthorizationError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Exige un acteur authentifié disposant de la permission. Lève
 * `AuthorizationError` sinon. Retourne l'utilisateur applicatif.
 */
export async function authorize(permission: PermissionCode) {
  const user = await getCurrentAppUser();
  if (!user) throw new AuthorizationError("Non authentifié : accès refusé.");
  assertPermission(user.role.name as RoleName, permission);
  return user;
}

/** Vrai si l'acteur courant possède la permission (pour conditionner l'UI). */
export async function currentUserCan(permission: PermissionCode): Promise<boolean> {
  const user = await getCurrentAppUser();
  return !!user && hasPermission(user.role.name as RoleName, permission);
}
