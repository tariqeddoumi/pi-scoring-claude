import { describe, it, expect } from "vitest";
import { applyProjectFilters, parseProjectFilters, sortHref, hasActiveFilters, type ProjectRow } from "@/lib/projectFilters";

const row = (o: Partial<ProjectRow>): ProjectRow => ({
  id: "x", reference: "PI-1", name: "Projet", promoter: "Promo", city: "Casablanca", segment: "social", loanAmount: 10,
  score: null, decision: null, regulatoryClass: null, state: "DRAFT", updatedAt: "2026-01-01", ...o,
});
const rows = [
  row({ id: "a", reference: "PI-001", name: "Résidence Les Jardins", promoter: "Atlas", city: "Fès", loanAmount: 110, score: 92, decision: "GO", regulatoryClass: "SAIN", segment: "moyen_haut" }),
  row({ id: "b", reference: "PI-002", name: "Annour", promoter: "Nouvelle Résidence", city: "Marrakech", loanAmount: 38, score: 0, decision: "NO_GO", regulatoryClass: "PRE_DOUTEUX", state: "RISK_REVIEW" }),
  row({ id: "c", reference: "PI-101", name: "Tranche Verdure", promoter: "Détroit", loanAmount: 95 }),
];

describe("Liste des projets : recherche, filtres, tri", () => {
  it("recherche insensible à la casse et aux accents, tous les mots", () => {
    expect(applyProjectFilters(rows, parseProjectFilters({ q: "residence" })).map((r) => r.id)).toEqual(["a", "b"]);
    expect(applyProjectFilters(rows, parseProjectFilters({ q: "fes jardins" })).map((r) => r.id)).toEqual(["a"]);
    expect(applyProjectFilters(rows, parseProjectFilters({ q: "detroit" })).map((r) => r.id)).toEqual(["c"]);
  });
  it("filtres combinés et dossiers jamais scorés", () => {
    expect(applyProjectFilters(rows, parseProjectFilters({ decision: "NO_GO", state: "RISK_REVIEW" })).map((r) => r.id)).toEqual(["b"]);
    expect(applyProjectFilters(rows, parseProjectFilters({ scored: "unscored" })).map((r) => r.id)).toEqual(["c"]);
  });
  it("dossiers à rafraîchir (revue échue ou événement)", () => {
    const rs = rows.map((r) => ({ ...r, needsRescoring: r.id !== "a" }));
    expect(applyProjectFilters(rs, parseProjectFilters({ scored: "stale" })).map((r) => r.id)).toEqual(["b", "c"]);
  });
  it("tri par score décroissant, valeurs absentes en dernier", () => {
    const f = parseProjectFilters({ sort: "score", dir: "desc" });
    expect(applyProjectFilters(rows, f).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(applyProjectFilters(rows, { ...f, dir: "asc" }).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
  it("paramètres invalides ignorés ; lien de tri qui inverse le sens", () => {
    const f = parseProjectFilters({ sort: "hack", scored: "x" });
    expect(f.sort).toBe("updatedAt");
    expect(f.scored).toBe("");
    expect(hasActiveFilters(f)).toBe(false);
    expect(sortHref(parseProjectFilters({ sort: "name", dir: "asc", q: "a" }), "name")).toBe("?q=a&sort=name&dir=desc");
  });
});

describe("Export de la liste filtrée", () => {
  it("mêmes lignes que la liste, libellés lisibles, valeurs absentes vides", async () => {
    const { projectListTable } = await import("@/lib/projectFilters");
    const list = applyProjectFilters(rows, parseProjectFilters({ q: "residence", sort: "score", dir: "desc" }));
    const t = projectListTable(list, {
      city: (c) => c ?? "—", segment: (c) => c ?? "—", decision: (d) => (d ? `déc:${d}` : ""), cls: (c) => (c ? `cls:${c}` : ""), state: (s) => `étape:${s}`,
    });
    expect(t[0]).toContain("Score final");
    expect(t.slice(1).map((r) => r[0])).toEqual(["PI-001", "PI-002"]);
    expect(t[1]![6]).toBe(92);
    expect(t[1]![7]).toBe("déc:GO");
    expect(t[2]![9]).toBe("étape:RISK_REVIEW");
  });
});
