// Test d'intégration (base PostgreSQL réelle) : la liste filtrée, triée et
// paginée par la base doit être exactement celle que donne la définition de
// référence applyProjectFilters, et l'indicateur « à rafraîchir » celui de la
// file de re-scoring. Lancé en CI après les migrations et le jeu de test
// (npm run test:integration) ; ignoré sans DATABASE_URL.

import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRescoringQueue } from "@/server/queries";
import { loadProjectPage, loadProjectRows } from "@/server/services/projectList";
import { applyProjectFilters, fold, parseProjectFilters, SORT_KEYS, type ProjectFilters, type ProjectRow } from "@/lib/projectFilters";

const f = (sp: Record<string, string> = {}): ProjectFilters => parseProjectFilters(sp);
const ids = (rows: ProjectRow[]) => rows.map((r) => r.id);
// Valeur de tri d'une ligne (les égalités peuvent être départagées différemment).
const key = (r: ProjectRow, k: ProjectFilters["sort"]) =>
  k === "updatedAt" ? new Date(r.updatedAt).getTime() : k === "loanAmount" || k === "score" ? r[k] : fold(String(r[k]));

describe.skipIf(!process.env.DATABASE_URL)("liste des projets filtrée par la base", () => {
  afterAll(() => prisma.$disconnect());

  it("dispose d'un jeu de données suffisant", async () => {
    const all = await loadProjectRows(f());
    expect(all.length).toBeGreaterThan(25);
  });

  it("indique « à rafraîchir » exactement les dossiers de la file de re-scoring", async () => {
    const [all, queue] = await Promise.all([loadProjectRows(f()), getRescoringQueue()]);
    const stale = all.filter((r) => r.needsRescoring).map((r) => r.id).sort();
    expect(stale).toEqual(queue.items.map((i) => i.id).sort());
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.length).toBeLessThan(all.length);
  });

  it("filtre et trie comme la définition de référence", async () => {
    const all = await loadProjectRows(f());
    const sample = all.find((r) => /[éèêàç]/i.test(r.name)) ?? all[0]!;
    const word = sample.name.split(/\s+/).find((w) => /[éèêàç]/i.test(w)) ?? sample.name.split(/\s+/)[0]!;
    const cases: Record<string, string>[] = [
      {},
      // Recherche insensible à la casse et aux accents, plusieurs termes.
      { q: fold(word).toUpperCase() },
      { q: `${sample.reference.slice(-3)} ${fold(sample.promoter.split(" ")[0]!)}` },
      { q: "%" }, { q: "_" },
      ...[...new Set(all.map((r) => r.segment).filter(Boolean))].map((segment) => ({ segment: segment! })),
      ...[...new Set(all.map((r) => r.decision).filter(Boolean))].map((decision) => ({ decision: decision! })),
      ...[...new Set(all.map((r) => r.regulatoryClass).filter(Boolean))].map((cls) => ({ cls: cls! })),
      ...[...new Set(all.map((r) => r.state))].map((state) => ({ state })),
      { scored: "scored" }, { scored: "unscored" }, { scored: "stale" },
      { segment: "social", scored: "scored" },
      ...SORT_KEYS.flatMap((sort) => [{ sort, dir: "asc" }, { sort, dir: "desc" }]),
      { scored: "stale", sort: "loanAmount", dir: "asc" },
    ];
    for (const c of cases) {
      const filters = f(c);
      const sql = await loadProjectRows(filters);
      const ref = applyProjectFilters(all, filters);
      expect(ids(sql).sort(), JSON.stringify(c)).toEqual(ids(ref).sort());
      expect(sql.map((r) => key(r, filters.sort)), JSON.stringify(c)).toEqual(ref.map((r) => key(r, filters.sort)));
    }
  });

  it("pagine sans perte ni doublon, avec les totaux des filtres", async () => {
    const filters = f({ sort: "name", dir: "asc" });
    const full = await loadProjectRows(filters);
    const size = 7;
    const pages: ProjectRow[] = [];
    const first = await loadProjectPage({ ...filters, size });
    for (let p = 1; p <= first.pageCount; p++) pages.push(...(await loadProjectPage({ ...filters, size, page: p })).rows);
    expect(ids(pages)).toEqual(ids(full));
    expect(first.total).toBe(full.length);
    expect(first.all).toBe(full.length);
    expect(first.exposure).toBeCloseTo(full.reduce((s, r) => s + (r.loanAmount ?? 0), 0), 2);
    expect(first.pageCount).toBe(Math.ceil(full.length / size));

    // Page au-delà de la dernière : la dernière page est affichée.
    const beyond = await loadProjectPage({ ...filters, size, page: 999 });
    expect(beyond.page).toBe(first.pageCount);
    expect(ids(beyond.rows)).toEqual(ids(full.slice((first.pageCount - 1) * size)));

    // Totaux restreints aux filtres.
    const social = await loadProjectPage({ ...f({ segment: "social" }), size });
    const expected = full.filter((r) => r.segment === "social");
    expect(social.total).toBe(expected.length);
    expect(social.all).toBe(full.length);
    expect(social.exposure).toBeCloseTo(expected.reduce((s, r) => s + (r.loanAmount ?? 0), 0), 2);
  });
});
