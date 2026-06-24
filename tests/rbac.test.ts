import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  assertPermission,
  type RoleName,
} from "@/lib/rbac";

describe("RBAC — mapping rôles / permissions", () => {
  it("ADMIN possède toutes les permissions", () => {
    const all = Object.values(PERMISSIONS);
    for (const p of all) expect(hasPermission("ADMIN", p)).toBe(true);
  });

  it("RELATIONSHIP_MANAGER ne peut ni valider, ni administrer le modèle", () => {
    expect(hasPermission("RELATIONSHIP_MANAGER", PERMISSIONS.SCORING_RUN)).toBe(true);
    expect(hasPermission("RELATIONSHIP_MANAGER", PERMISSIONS.SCORING_VALIDATE)).toBe(false);
    expect(hasPermission("RELATIONSHIP_MANAGER", PERMISSIONS.MODEL_WRITE)).toBe(false);
    expect(hasPermission("RELATIONSHIP_MANAGER", PERMISSIONS.AUDIT_READ)).toBe(false);
  });

  it("AUDITOR est en lecture seule (audit oui, écriture non)", () => {
    expect(hasPermission("AUDITOR", PERMISSIONS.AUDIT_READ)).toBe(true);
    expect(hasPermission("AUDITOR", PERMISSIONS.PROJECT_READ)).toBe(true);
    expect(hasPermission("AUDITOR", PERMISSIONS.PROJECT_WRITE)).toBe(false);
    expect(hasPermission("AUDITOR", PERMISSIONS.SCORING_RUN)).toBe(false);
  });

  it("MANAGER peut valider un scoring mais pas écrire un projet", () => {
    expect(hasPermission("MANAGER", PERMISSIONS.SCORING_VALIDATE)).toBe(true);
    expect(hasPermission("MANAGER", PERMISSIONS.PROJECT_WRITE)).toBe(false);
  });

  it("seul l'ADMIN administre le modèle, les régimes et les utilisateurs", () => {
    const adminOnly = [PERMISSIONS.MODEL_WRITE, PERMISSIONS.REGIME_WRITE, PERMISSIONS.ADMIN_USERS];
    const roles: RoleName[] = ["RISK_ANALYST", "RELATIONSHIP_MANAGER", "MANAGER", "AUDITOR"];
    for (const p of adminOnly) {
      expect(hasPermission("ADMIN", p)).toBe(true);
      for (const r of roles) expect(hasPermission(r, p)).toBe(false);
    }
  });

  it("assertPermission lève pour un rôle non autorisé, passe sinon", () => {
    expect(() => assertPermission("AUDITOR", PERMISSIONS.PROJECT_WRITE)).toThrow();
    expect(() => assertPermission("RISK_ANALYST", PERMISSIONS.PROJECT_WRITE)).not.toThrow();
  });

  it("tout rôle a au moins la lecture projet (cohérence de base)", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as RoleName[]) {
      expect(hasPermission(role, PERMISSIONS.PROJECT_READ)).toBe(true);
    }
  });
});
