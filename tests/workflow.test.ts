import { describe, it, expect } from "vitest";
import {
  WORKFLOW_TRANSITIONS,
  allowedTransitions,
  findTransition,
  isTerminal,
  outcomeToState,
  quorumReached,
  votesConsistent,
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
