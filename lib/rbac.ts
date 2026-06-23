// =====================================================================
//  RBAC — rôles, permissions et garde côté serveur.
//  Le mapping rôle -> permissions est la source de vérité du seed.
// =====================================================================

export type RoleName =
  | "ADMIN"
  | "RISK_ANALYST"
  | "RELATIONSHIP_MANAGER"
  | "MANAGER"
  | "AUDITOR";

// Permissions atomiques par domaine fonctionnel.
export const PERMISSIONS = {
  PROJECT_READ: "project.read",
  PROJECT_WRITE: "project.write",
  SCORING_RUN: "scoring.run",
  SCORING_VALIDATE: "scoring.validate",
  MODEL_READ: "model.read",
  MODEL_WRITE: "model.write",
  REGIME_READ: "regime.read",
  REGIME_WRITE: "regime.write",
  IMPORT_RUN: "import.run",
  EXPORT_RUN: "export.run",
  AUDIT_READ: "audit.read",
  ADMIN_USERS: "admin.users",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  ADMIN: Object.values(PERMISSIONS),
  RISK_ANALYST: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.SCORING_RUN,
    PERMISSIONS.MODEL_READ,
    PERMISSIONS.REGIME_READ,
    PERMISSIONS.IMPORT_RUN,
    PERMISSIONS.EXPORT_RUN,
    PERMISSIONS.AUDIT_READ,
  ],
  RELATIONSHIP_MANAGER: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.SCORING_RUN,
    PERMISSIONS.EXPORT_RUN,
  ],
  MANAGER: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.SCORING_RUN,
    PERMISSIONS.SCORING_VALIDATE,
    PERMISSIONS.MODEL_READ,
    PERMISSIONS.REGIME_READ,
    PERMISSIONS.EXPORT_RUN,
    PERMISSIONS.AUDIT_READ,
  ],
  AUDITOR: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.MODEL_READ,
    PERMISSIONS.REGIME_READ,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.EXPORT_RUN,
  ],
};

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: "Administrateur",
  RISK_ANALYST: "Analyste Risque",
  RELATIONSHIP_MANAGER: "Chargé d'affaires",
  MANAGER: "Manager / Comité",
  AUDITOR: "Auditeur",
};

export function hasPermission(role: RoleName, perm: PermissionCode): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

/** Garde serveur — lève si la permission manque. */
export function assertPermission(role: RoleName, perm: PermissionCode): void {
  if (!hasPermission(role, perm)) {
    throw new Error(`Accès refusé: le rôle ${role} ne dispose pas de ${perm}`);
  }
}
