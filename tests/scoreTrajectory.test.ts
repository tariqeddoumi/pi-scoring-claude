import { describe, it, expect } from "vitest";
import { scoreTrajectory } from "@/lib/domain/scoreTrajectory";

describe("Trajectoire du score (re-scoring périodique)", () => {
  it("stable sans historique", () => {
    expect(scoreTrajectory([]).level).toBe("STABLE");
    expect(scoreTrajectory([{ scoreFinal: 80, decision: "GO" }]).delta).toBeNull();
  });
  it("alerte sur une baisse cumulée ≥ 5 pts même sans changement de décision", () => {
    const t = scoreTrajectory([{ scoreFinal: 90, decision: "GO" }, { scoreFinal: 87, decision: "GO" }, { scoreFinal: 84, decision: "GO" }]);
    expect(t.cumulativeDrop).toBe(6);
    expect(t.consecutiveDeclines).toBe(2);
    expect(t.level).toBe("ALERTE");
  });
  it("alerte sur dégradation de décision", () => {
    const t = scoreTrajectory([{ scoreFinal: 76, decision: "GO" }, { scoreFinal: 74, decision: "GO_WITH_CONDITIONS" }]);
    expect(t.decisionDowngrade).toBe(true);
    expect(t.level).toBe("ALERTE");
  });
  it("vigilance à l'approche d'un seuil en baisse", () => {
    const t = scoreTrajectory([{ scoreFinal: 78, decision: "GO" }, { scoreFinal: 76, decision: "GO" }]);
    expect(t.nearThreshold).toBe(75);
    expect(t.level).toBe("VIGILANCE");
  });
  it("un changement de version du modèle n'est pas lu comme une dégradation", () => {
    const t = scoreTrajectory([{ scoreFinal: 88, decision: "GO", modelVersion: "v4.0.0" }, { scoreFinal: 80, decision: "GO", modelVersion: "v5.0.0" }]);
    expect(t.comparable).toBe(false);
    expect(t.delta).toBe(-8);
    expect(t.cumulativeDrop).toBeNull();
    expect(t.level).toBe("STABLE");
  });
});
