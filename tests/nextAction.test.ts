import { describe, it, expect } from "vitest";
import { nextActionFor } from "@/lib/domain/nextAction";

describe("nextAction — guide par rôle et étape", () => {
  it("brouillon incomplet : le CA est guidé vers la saisie", () => {
    const a = nextActionFor({ state: "DRAFT", role: "RELATIONSHIP_MANAGER", completenessPct: 60 });
    expect(a.actionable).toBe(true);
    expect(a.target).toBe("scoring");
    expect(a.title).toContain("Compléter");
  });

  it("brouillon complet sans score : calculer le score ; avec score : soumettre", () => {
    expect(nextActionFor({ state: "DRAFT", role: "RELATIONSHIP_MANAGER", completenessPct: 100, hasScore: false }).title).toContain("Calculer");
    expect(nextActionFor({ state: "DRAFT", role: "RELATIONSHIP_MANAGER", completenessPct: 100, hasScore: true }).title).toContain("Soumettre");
  });

  it("soumis : le DCA prend pour avis, l'auditeur attend", () => {
    expect(nextActionFor({ state: "SUBMITTED", role: "BRANCH_DIRECTOR" }).actionable).toBe(true);
    expect(nextActionFor({ state: "SUBMITTED", role: "AUDITOR" }).actionable).toBe(false);
  });

  it("avis DCA : seul le porteur de workflow.endorse est acteur", () => {
    expect(nextActionFor({ state: "BRANCH_REVIEW", role: "BRANCH_DIRECTOR" }).actionable).toBe(true);
    expect(nextActionFor({ state: "BRANCH_REVIEW", role: "RELATIONSHIP_MANAGER" }).actionable).toBe(false);
  });

  it("contre-étude : re-scorer d'abord si le score n'est plus frais", () => {
    const stale = nextActionFor({ state: "ANALYST_REVIEW", role: "RISK_ANALYST", needsRescoring: true });
    expect(stale.title).toContain("Re-scorer");
    expect(stale.target).toBe("scoring");
    const fresh = nextActionFor({ state: "ANALYST_REVIEW", role: "RISK_ANALYST", needsRescoring: false });
    expect(fresh.title).toContain("Valider");
  });

  it("décision : DR et comité sont acteurs, le CA attend", () => {
    expect(nextActionFor({ state: "MANAGER_VALIDATION", role: "REGIONAL_DIRECTOR" }).actionable).toBe(true);
    expect(nextActionFor({ state: "MANAGER_VALIDATION", role: "MANAGER" }).actionable).toBe(true);
    expect(nextActionFor({ state: "MANAGER_VALIDATION", role: "RELATIONSHIP_MANAGER" }).actionable).toBe(false);
  });

  it("approuvé : suivi rapproché, ou re-scoring si le score est périmé", () => {
    expect(nextActionFor({ state: "APPROVED", role: "RELATIONSHIP_MANAGER" }).target).toBe("suivi");
    expect(nextActionFor({ state: "APPROVED", role: "RISK_ANALYST", needsRescoring: true }).target).toBe("scoring");
  });

  it("rejeté : reprise possible par un rôle écrivain", () => {
    expect(nextActionFor({ state: "REJECTED", role: "RELATIONSHIP_MANAGER" }).actionable).toBe(true);
    expect(nextActionFor({ state: "REJECTED", role: "AUDITOR" }).actionable).toBe(false);
  });
});
