import { describe, it, expect } from "vitest";
import { mostSevereClass, groupContagionClass, classSeverity } from "@/lib/domain/groups";

describe("groups — effet de contagion", () => {
  it("classe la sévérité dans l'ordre BKAM", () => {
    expect(classSeverity("SAIN")).toBe(0);
    expect(classSeverity("CTX")).toBe(5);
    expect(classSeverity("DOUTEUX")).toBeGreaterThan(classSeverity("SENSIBLE"));
  });

  it("retourne la classe la plus sévère, en ignorant les nulls", () => {
    expect(mostSevereClass(["SAIN", "SENSIBLE", null, "DOUTEUX"])).toBe("DOUTEUX");
    expect(mostSevereClass([null, undefined])).toBeUndefined();
    expect(mostSevereClass([])).toBeUndefined();
  });

  it("contagion : un pair plus dégradé tire la contrepartie vers sa classe", () => {
    expect(groupContagionClass("SAIN", ["SENSIBLE", "COMPROMIS"])).toBe("COMPROMIS");
    expect(groupContagionClass("SENSIBLE", ["PRE_DOUTEUX"])).toBe("PRE_DOUTEUX");
  });

  it("pas de contagion si la contrepartie est déjà aussi/plus sévère", () => {
    expect(groupContagionClass("DOUTEUX", ["SAIN", "SENSIBLE"])).toBeUndefined();
    expect(groupContagionClass("COMPROMIS", ["COMPROMIS"])).toBeUndefined();
  });
});
