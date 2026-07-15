import { describe, it, expect } from "vitest";
import {
  WORKFLOW_TRANSITIONS,
  allowedTransitions,
  findTransition,
  isTerminal,
  outcomeToState,
  quorumReached,
  votesConsistent,
  actionableStatesFor,
  roleTransitions,
  type WorkflowStateName,
} from "@/lib/workflow";
import { PERMISSIONS } from "@/lib/rbac";

describe("workflow — machine à états crédit", () => {
  it("suit le circuit nominal CA → Analyste → Responsable → Comité → Approuvé", () => {
    expect(findTransition("DRAFT", "SUBMITTED")).toBeDefined();
    expect(findTransition("SUBMITTED", "ANALYST_REVIEW")).toBeDefined();
    expect(findTransition("ANALYST_REVIEW", "MANAGER_VALIDATION")).toBeDefined();
    expect(findTransition("MANAGER_VALIDATION", "COMMITTEE")).toBeDefined();
    expect(findTransition("COMMITTEE", "APPROVED")).toBeDefined();
  });

  it("interdit les transitions non définies (ex. DRAFT → APPROVED)", () => {
    expect(findTransition("DRAFT", "APPROVED")).toBeUndefined();
    expect(findTransition("SUBMITTED", "COMMITTEE")).toBeUndefined();
    expect(findTransition("ANALYST_REVIEW", "APPROVED")).toBeUndefined();
  });

  it("exige scoring.validate pour les décisions du responsable/comité", () => {
    expect(findTransition("MANAGER_VALIDATION", "APPROVED")?.permission).toBe(PERMISSIONS.SCORING_VALIDATE);
    expect(findTransition("COMMITTEE", "APPROVED")?.permission).toBe(PERMISSIONS.SCORING_VALIDATE);
    expect(findTransition("COMMITTEE", "REJECTED")?.permission).toBe(PERMISSIONS.SCORING_VALIDATE);
  });

  it("marque la SoD sur les approbations (responsable et comité)", () => {
    expect(findTransition("MANAGER_VALIDATION", "APPROVED")?.sod).toBe(true);
    expect(findTransition("COMMITTEE", "APPROVED")?.sod).toBe(true);
    // Le passage en comité n'est pas une approbation finale → pas de SoD.
    expect(findTransition("MANAGER_VALIDATION", "COMMITTEE")?.sod).toBeFalsy();
  });

  it("permet le rejet depuis toute étape d'instruction et la reprise après rejet", () => {
    expect(findTransition("SUBMITTED", "REJECTED")).toBeDefined();
    expect(findTransition("ANALYST_REVIEW", "REJECTED")).toBeDefined();
    expect(findTransition("MANAGER_VALIDATION", "REJECTED")).toBeDefined();
    expect(findTransition("REJECTED", "DRAFT")).toBeDefined();
  });

  it("APPROVED est terminal, DRAFT ne l'est pas", () => {
    expect(isTerminal("APPROVED")).toBe(true);
    expect(isTerminal("DRAFT")).toBe(false);
    expect(allowedTransitions("APPROVED")).toHaveLength(0);
  });

  it("toutes les cibles de transition sont des états connus", () => {
    const states = Object.keys(WORKFLOW_TRANSITIONS) as WorkflowStateName[];
    for (const from of states) {
      for (const t of WORKFLOW_TRANSITIONS[from]) {
        expect(states).toContain(t.to);
      }
    }
  });
});

describe("workflow — décision de comité", () => {
  it("mappe le sens de décision vers l'état cible", () => {
    expect(outcomeToState("FAVORABLE")).toBe("APPROVED");
    expect(outcomeToState("FAVORABLE_CONDITIONS")).toBe("APPROVED");
    expect(outcomeToState("DEFAVORABLE")).toBe("REJECTED");
    expect(outcomeToState("AJOURNE")).toBeNull();
  });

  it("valide le quorum (présents ≥ quorum et > 0)", () => {
    expect(quorumReached(3, 3)).toBe(true);
    expect(quorumReached(3, 4)).toBe(true);
    expect(quorumReached(3, 2)).toBe(false);
    expect(quorumReached(0, 0)).toBe(false);
  });

  it("vérifie la cohérence des votes (somme ≤ présents)", () => {
    expect(votesConsistent({ presentCount: 5, votesFor: 3, votesAgainst: 1, votesAbstain: 1 })).toBe(true);
    expect(votesConsistent({ presentCount: 3, votesFor: 3, votesAgainst: 1, votesAbstain: 0 })).toBe(false);
  });
});

describe("workflow — file d'attente par rôle", () => {
  it("l'analyste agit sur les états d'instruction, pas en comité", () => {
    const states = actionableStatesFor("RISK_ANALYST");
    expect(states).toContain("SUBMITTED");
    expect(states).toContain("ANALYST_REVIEW");
    expect(states).not.toContain("COMMITTEE");
    expect(states).not.toContain("MANAGER_VALIDATION");
  });

  it("le manager agit sur validation et comité (et l'instruction via scoring.run)", () => {
    const states = actionableStatesFor("MANAGER");
    expect(states).toContain("MANAGER_VALIDATION");
    expect(states).toContain("COMMITTEE");
  });

  it("seul un rôle avec scoring.validate couvre le stade comité", () => {
    expect(actionableStatesFor("RELATIONSHIP_MANAGER")).not.toContain("COMMITTEE");
    expect(actionableStatesFor("MANAGER")).toContain("COMMITTEE");
  });

  it("l'auditeur (lecture seule) n'a aucun état actionnable", () => {
    expect(actionableStatesFor("AUDITOR")).toHaveLength(0);
  });

  it("roleTransitions ne renvoie que les transitions permises au rôle", () => {
    const mgr = roleTransitions("MANAGER", "MANAGER_VALIDATION").map((t) => t.to);
    expect(mgr).toEqual(expect.arrayContaining(["COMMITTEE", "APPROVED", "REJECTED"]));
    // L'analyste n'a pas scoring.validate → aucune transition depuis ce stade.
    expect(roleTransitions("RISK_ANALYST", "MANAGER_VALIDATION")).toHaveLength(0);
  });
});

describe("workflow — étage front (avis directeur de centre d'affaires)", () => {
  it("le DCA prend le dossier soumis pour avis, puis le transmet à la contre-étude", () => {
    expect(findTransition("SUBMITTED", "BRANCH_REVIEW")?.permission).toBe(PERMISSIONS.WORKFLOW_ENDORSE);
    expect(findTransition("BRANCH_REVIEW", "ANALYST_REVIEW")?.permission).toBe(PERMISSIONS.WORKFLOW_ENDORSE);
  });

  it("le DCA peut renvoyer au chargé d'affaires ou rejeter", () => {
    expect(findTransition("BRANCH_REVIEW", "DRAFT")?.kind).toBe("rework");
    expect(findTransition("BRANCH_REVIEW", "REJECTED")?.kind).toBe("reject");
  });

  it("le chemin direct Soumis → Contre-étude reste ouvert (compatibilité)", () => {
    expect(findTransition("SUBMITTED", "ANALYST_REVIEW")).toBeDefined();
  });

  it("le chargé d'affaires n'agit pas au stade de l'avis DCA", () => {
    expect(roleTransitions("RELATIONSHIP_MANAGER", "BRANCH_REVIEW")).toHaveLength(0);
    expect(actionableStatesFor("BRANCH_DIRECTOR")).toContain("BRANCH_REVIEW");
    expect(actionableStatesFor("BRANCH_DIRECTOR")).toContain("SUBMITTED");
  });

  it("le directeur de région décide (délégation) mais la contre-étude non", () => {
    expect(actionableStatesFor("REGIONAL_DIRECTOR")).toContain("MANAGER_VALIDATION");
    expect(actionableStatesFor("REGIONAL_DIRECTOR")).toContain("COMMITTEE");
    expect(roleTransitions("RISK_ANALYST", "MANAGER_VALIDATION")).toHaveLength(0);
  });

  it("la contre-étude peut renvoyer le dossier au chargé d'affaires", () => {
    expect(findTransition("ANALYST_REVIEW", "DRAFT")?.kind).toBe("rework");
  });
});
