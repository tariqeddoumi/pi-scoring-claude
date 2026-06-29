import { describe, it, expect } from "vitest";
import { validateModelForPublish, hasBlockingIssues, type ModelLite } from "@/lib/domain/modelValidation";

const crit = (over: Partial<ModelLite["domains"][0]["criteria"][0]> = {}) => ({
  code: "C1", type: "QUAL" as const, weight: 1, optionsCount: 2, rangesCount: 0, ...over,
});

const validModel: ModelLite = {
  domains: [
    { code: "D1", weight: 0.5, criteria: [crit({ code: "D1C1", weight: 0.6 }), crit({ code: "D1C2", weight: 0.4 })] },
    { code: "D2", weight: 0.5, criteria: [crit({ code: "D2C1", type: "NUM", weight: 1, optionsCount: 0, rangesCount: 3 })] },
  ],
};

describe("validation du modèle avant publication", () => {
  it("un modèle cohérent ne produit aucune erreur", () => {
    const issues = validateModelForPublish(validModel);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("bloque si la somme des poids de domaines ≠ 100%", () => {
    const m: ModelLite = { domains: [{ code: "D1", weight: 0.7, criteria: [crit()] }] };
    const issues = validateModelForPublish(m);
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues.some((i) => /domaines doit faire 100/.test(i.message))).toBe(true);
  });

  it("bloque si les poids des critères d'un domaine ≠ 100%", () => {
    const m: ModelLite = {
      domains: [{ code: "D1", weight: 1, criteria: [crit({ weight: 0.5 }), crit({ code: "C2", weight: 0.2 })] }],
    };
    expect(hasBlockingIssues(validateModelForPublish(m))).toBe(true);
  });

  it("bloque un critère QUAL sans modalité et NUM sans barème", () => {
    const m: ModelLite = {
      domains: [{ code: "D1", weight: 1, criteria: [crit({ optionsCount: 0 })] }],
    };
    expect(validateModelForPublish(m).some((i) => /sans aucune modalité/.test(i.message))).toBe(true);
  });

  it("bloque un modèle vide", () => {
    expect(hasBlockingIssues(validateModelForPublish({ domains: [] }))).toBe(true);
  });
});
