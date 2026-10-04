// Recherche, filtres et tri de la liste des projets. Fonctions pures : l'état
// vit dans l'URL (?q=…&segment=…&sort=…), donc une liste filtrée se partage
// par lien et fonctionne sans JavaScript.

export interface ProjectRow {
  id: string;
  reference: string;
  name: string;
  promoter: string;
  city: string | null;
  segment: string | null;
  loanAmount: number | null;
  score: number | null;
  decision: string | null;
  regulatoryClass: string | null;
  state: string;
  updatedAt: Date | string;
}

export const SORT_KEYS = ["reference", "name", "promoter", "loanAmount", "score", "updatedAt"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface ProjectFilters {
  q: string;
  segment: string;
  decision: string;
  cls: string;
  state: string;
  /** "unscored" : dossiers jamais scorés. */
  scored: "" | "unscored" | "scored";
  sort: SortKey;
  dir: "asc" | "desc";
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export function parseProjectFilters(sp: Params): ProjectFilters {
  const sort = one(sp.sort) as SortKey;
  const scored = one(sp.scored);
  return {
    q: one(sp.q).slice(0, 100),
    segment: one(sp.segment),
    decision: one(sp.decision),
    cls: one(sp.cls),
    state: one(sp.state),
    scored: scored === "unscored" || scored === "scored" ? scored : "",
    sort: SORT_KEYS.includes(sort) ? sort : "updatedAt",
    dir: one(sp.dir) === "asc" ? "asc" : one(sp.dir) === "desc" ? "desc" : SORT_KEYS.includes(sort) && sort !== "updatedAt" ? "asc" : "desc",
  };
}

/** Recherche insensible à la casse et aux accents. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function applyProjectFilters<T extends ProjectRow>(rows: T[], f: ProjectFilters): T[] {
  const terms = fold(f.q).split(/\s+/).filter(Boolean);
  const out = rows.filter((r) => {
    if (terms.length) {
      const hay = fold([r.reference, r.name, r.promoter, r.city ?? ""].join(" "));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    if (f.segment && r.segment !== f.segment) return false;
    if (f.decision && r.decision !== f.decision) return false;
    if (f.cls && r.regulatoryClass !== f.cls) return false;
    if (f.state && r.state !== f.state) return false;
    if (f.scored === "unscored" && r.score != null) return false;
    if (f.scored === "scored" && r.score == null) return false;
    return true;
  });
  const val = (r: T): string | number | null => {
    switch (f.sort) {
      case "loanAmount": return r.loanAmount;
      case "score": return r.score;
      case "updatedAt": return new Date(r.updatedAt).getTime();
      default: return fold(String(r[f.sort] ?? ""));
    }
  };
  const sign = f.dir === "asc" ? 1 : -1;
  // Les valeurs absentes restent en fin de liste quel que soit le sens.
  return [...out].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * sign;
  });
}

/** Lien de tri d'une colonne : inverse le sens si la colonne est déjà triée. */
export function sortHref(f: ProjectFilters, key: SortKey): string {
  const dir = f.sort === key ? (f.dir === "asc" ? "desc" : "asc") : key === "updatedAt" || key === "score" || key === "loanAmount" ? "desc" : "asc";
  return toQuery({ ...f, sort: key, dir });
}

export function toQuery(f: Partial<ProjectFilters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: ProjectFilters): boolean {
  return !!(f.q || f.segment || f.decision || f.cls || f.state || f.scored);
}
