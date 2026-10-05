import { describe, it, expect } from "vitest";
import {
  applyProjectFilters, parseProjectFilters, sortHref, hasActiveFilters, toQuery, pageHref, pagination, pageWindow, fold,
  DEFAULT_PAGE_SIZE, type ProjectRow,
} from "@/lib/projectFilters";
import { ACCENTED, PLAIN, likeEscape } from "@/server/services/projectList";

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

describe("Pagination de la liste", () => {
  it("lit la page et la taille dans l'URL, avec des valeurs sûres par défaut", () => {
    expect(parseProjectFilters({})).toMatchObject({ page: 1, size: DEFAULT_PAGE_SIZE });
    expect(parseProjectFilters({ page: "3", size: "50" })).toMatchObject({ page: 3, size: 50 });
    // Taille hors de la liste proposée, page invalide ou négative : valeurs par défaut.
    expect(parseProjectFilters({ page: "-2", size: "1000" })).toMatchObject({ page: 1, size: DEFAULT_PAGE_SIZE });
    expect(parseProjectFilters({ page: "abc" }).page).toBe(1);
  });
  it("garde des liens courts (page 1 et taille par défaut implicites) et revient en page 1 au tri", () => {
    const f = parseProjectFilters({ q: "atlas", page: "4" });
    expect(toQuery({ ...f, page: 1 })).toBe("?q=atlas&sort=updatedAt&dir=desc");
    expect(pageHref(f, 2)).toBe("?q=atlas&sort=updatedAt&dir=desc&page=2");
    expect(pageHref({ ...f, size: 100 }, 2)).toContain("size=100");
    expect(sortHref(f, "name")).not.toContain("page=");
  });
  it("calcule le nombre de pages et ramène la page dans l'intervalle", () => {
    expect(pagination(0, 1, 25)).toEqual({ pageCount: 1, page: 1, from: 0, to: 0 });
    expect(pagination(51, 3, 25)).toEqual({ pageCount: 3, page: 3, from: 51, to: 51 });
    expect(pagination(51, 9, 25)).toMatchObject({ page: 3 });
    expect(pagination(50, 2, 25)).toEqual({ pageCount: 2, page: 2, from: 26, to: 50 });
  });
  it("affiche la première, la dernière et les voisines de la page courante", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(7, 20)).toEqual([1, null, 6, 7, 8, null, 20]);
    // Une seule page masquée : affichée plutôt qu'une ellipse.
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20]);
  });
});

describe("Recherche côté base", () => {
  it("le repli des accents de la base équivaut à fold()", () => {
    expect(ACCENTED.length).toBe(PLAIN.length);
    expect(fold(ACCENTED)).toBe(PLAIN);
  });
  it("échappe les jokers de LIKE", () => {
    expect(likeEscape("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});
