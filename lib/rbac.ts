// =====================================================================
//  RBAC — rôles, permissions et garde côté serveur.
//  Le mapping rôle -> permissions est la source de vérité du seed.
//
//  Profils (orientation banque de détail / centre d'affaires) :
//  - RELATIONSHIP_MANAGER : chargé d'affaires (front) — instruit et saisit.
//  - BRANCH_DIRECTOR      : directeur de centre d'affaires — avis front.
//  - REGIONAL_DIRECTOR    : directeur de région / banque régionale — décision
//                           selon délégation.
//  - RISK_ANALYST         : contre-étude / analyse risque — valide le score.
//  - MANAGER              : comité de crédit (président).
//  - AUDITOR              : audit interne (lecture).
//  - ADMIN                : tout (paramétrage, utilisateurs).
// =====================================================================

export type RoleName =
  | "ADMIN"
  | "RISK_ANALYST"
  | "RELATIONSHIP_MANAGER"
  | "BRANCH_DIRECTOR"
  | "REGIONAL_DIRECTOR"
  | "MANAGER"
  | "AUDITOR";

// Permissions atomiques par domaine fonctionnel.
export const PERMISSIONS = {
  PROJECT_READ: "project.read",
  PROJECT_WRITE: "project.write",
  SCORING_RUN: "scoring.run",
  SCORING_VALIDATE: "scoring.validate",
  WORKFLOW_ENDORSE: "workflow.endorse", // avis front (directeur de centre d'affaires)
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
  BRANCH_DIRECTOR: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.SCORING_RUN,
    PERMISSIONS.WORKFLOW_ENDORSE,
    PERMISSIONS.EXPORT_RUN,
  ],
  REGIONAL_DIRECTOR: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.SCORING_RUN,
    PERMISSIONS.SCORING_VALIDATE,
    PERMISSIONS.WORKFLOW_ENDORSE,
    PERMISSIONS.MODEL_READ,
    PERMISSIONS.REGIME_READ,
    PERMISSIONS.EXPORT_RUN,
    PERMISSIONS.AUDIT_READ,
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
  RISK_ANALYST: "Contre-étude (Risque)",
  RELATIONSHIP_MANAGER: "Chargé d'affaires",
  BRANCH_DIRECTOR: "Directeur de centre d'affaires",
  REGIONAL_DIRECTOR: "Directeur de région",
  MANAGER: "Comité de crédit",
  AUDITOR: "Auditeur",
};

/** Rôles du réseau (front) — pilotage commercial du dossier. */
export const FRONT_ROLES: RoleName[] = [
  "RELATIONSHIP_MANAGER",
  "BRANCH_DIRECTOR",
  "REGIONAL_DIRECTOR",
];

export function isFrontRole(role: RoleName): boolean {
  return FRONT_ROLES.includes(role);
}

export function hasPermission(role: RoleName, perm: PermissionCode): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

/** Garde serveur — lève si la permission manque. */
export function assertPermission(role: RoleName, perm: PermissionCode): void {
  if (!hasPermission(role, perm)) {
    throw new Error(`Accès refusé: le rôle ${role} ne dispose pas de ${perm}`);
  }
}
