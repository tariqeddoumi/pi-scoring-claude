// Liste des projets (page /projects et son export) : recherche, filtres, tri
// et pagination exécutés par la base, en une requête paramétrée. La page et
// l'export passent par les mêmes conditions : le fichier exporté contient
// exactement la liste affichée (toutes pages confondues).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REVIEW_PERIOD_DAYS, REVIEW_PERIOD_DAYS } from "@/lib/domain/reviewPolicy";
import { fold, pagination, type ProjectFilters, type ProjectRow, type SortKey } from "@/lib/projectFilters";

/**
 * Repli des accents côté base, équivalent de fold() sans l'extension unaccent :
 * translate(lower(x), ACCENTED, PLAIN). Les majuscules accentuées sont listées
 * aussi, car lower() ne les convertit pas sous une locale « C ».
 */
export const ACCENTED = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ";
export const PLAIN = "aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy";

const folded = (expr: Prisma.Sql) => Prisma.sql`translate(lower(${expr}), ${ACCENTED}, ${PLAIN})`;

/** Échappe les jokers de LIKE (%, _ et le caractère d'échappement). */
export const likeEscape = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Dernier score, dernière classe et étape du circuit de chaque projet, et
 * indicateur « score à rafraîchir » — mêmes règles que scoreFreshness
 * (reviewPolicy) : jamais scoré, périodicité de revue de la classe atteinte,
 * ou événement matériel / imposant un comité postérieur au dernier score.
 */
function listCte(now: Date): Prisma.Sql {
  const period = Prisma.sql`CASE c.cls ${Prisma.join(
    Object.entries(REVIEW_PERIOD_DAYS).map(([cls, days]) => Prisma.sql`WHEN ${cls} THEN ${days}::int`),
    " ",
  )} ELSE ${DEFAULT_REVIEW_PERIOD_DAYS}::int END`;
  // Horodatages stockés en UTC sans fuseau : la date de référence l'est aussi.
  const at = Prisma.sql`${now.toISOString()}::timestamp`;
  return Prisma.sql`
    WITH l AS (
      SELECT p.id, p.reference, p.name, pr.name AS promoter, p.city, p.segment, p."loanAmount",
             p."updatedAt", p."createdAt",
             s."scoreFinal" AS score, s.decision::text AS decision,
             c.cls AS "regulatoryClass", COALESCE(w.state, 'DRAFT') AS state,
             (s."createdAt" IS NULL
               OR s."createdAt" + (${period}) * interval '1 day' <= ${at}
               OR EXISTS (SELECT 1 FROM "ProjectEvent" e
                          WHERE e."projectId" = p.id
                            AND (e."affectsScoring" OR e."requiresCommittee")
                            AND e."eventDate" > s."createdAt")) AS "needsRescoring"
      FROM "RealEstateProject" p
      JOIN "Promoter" pr ON pr.id = p."promoterId"
      LEFT JOIN LATERAL (SELECT r."scoreFinal", r.decision, r."createdAt" FROM "ScoringRun" r
                         WHERE r."projectId" = p.id ORDER BY r."createdAt" DESC LIMIT 1) s ON true
      LEFT JOIN LATERAL (SELECT k."resultClass"::text AS cls FROM "ClassificationRun" k
                         WHERE k."projectId" = p.id ORDER BY k."createdAt" DESC LIMIT 1) c ON true
      LEFT JOIN LATERAL (SELECT ws."toState"::text AS state FROM "WorkflowStep" ws
                         WHERE ws."projectId" = p.id ORDER BY ws."createdAt" DESC LIMIT 1) w ON true
    )`;
}

/** Conditions de filtrage (conjonction ; TRUE sans filtre). */
function condition(f: ProjectFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  const hay = folded(Prisma.sql`l.reference || ' ' || l.name || ' ' || l.promoter || ' ' || COALESCE(l.city, '')`);
  for (const term of fold(f.q).split(/\s+/).filter(Boolean)) {
    conds.push(Prisma.sql`${hay} LIKE ${`%${likeEscape(term)}%`}`);
  }
  if (f.segment) conds.push(Prisma.sql`l.segment = ${f.segment}`);
  if (f.decision) conds.push(Prisma.sql`l.decision = ${f.decision}`);
  if (f.cls) conds.push(Prisma.sql`l."regulatoryClass" = ${f.cls}`);
  if (f.state) conds.push(Prisma.sql`l.state = ${f.state}`);
  if (f.scored === "unscored") conds.push(Prisma.sql`l.score IS NULL`);
  if (f.scored === "scored") conds.push(Prisma.sql`l.score IS NOT NULL`);
  if (f.scored === "stale") conds.push(Prisma.sql`l."needsRescoring"`);
  return conds.length ? Prisma.join(conds, " AND ") : Prisma.sql`TRUE`;
}

const SORT_SQL: Record<SortKey, Prisma.Sql> = {
  // Ordre binaire du texte replié : le même que la comparaison JavaScript.
  reference: Prisma.sql`${folded(Prisma.sql`l.reference`)} COLLATE "C"`,
  name: Prisma.sql`${folded(Prisma.sql`l.name`)} COLLATE "C"`,
  promoter: Prisma.sql`${folded(Prisma.sql`l.promoter`)} COLLATE "C"`,
  loanAmount: Prisma.sql`l."loanAmount"`,
  score: Prisma.sql`l.score`,
  updatedAt: Prisma.sql`l."updatedAt"`,
};

/** Tri demandé, valeurs absentes en fin de liste, puis ordre stable (création la plus récente). */
function orderBy(f: ProjectFilters): Prisma.Sql {
  return Prisma.sql`ORDER BY ${SORT_SQL[f.sort]} ${Prisma.raw(f.dir === "asc" ? "ASC" : "DESC")} NULLS LAST, l."createdAt" DESC, l.id`;
}

type RawRow = Omit<ProjectRow, "needsRescoring"> & { needsRescoring: boolean };

async function selectRows(f: ProjectFilters, now: Date, limit?: { size: number; offset: number }): Promise<ProjectRow[]> {
  const page = limit ? Prisma.sql`LIMIT ${limit.size}::int OFFSET ${limit.offset}::int` : Prisma.empty;
  const rows = await prisma.$queryRaw<RawRow[]>`
    ${listCte(now)}
    SELECT l.id, l.reference, l.name, l.promoter, l.city, l.segment, l."loanAmount", l.score,
           l.decision, l."regulatoryClass", l.state, l."updatedAt", l."needsRescoring"
    FROM l WHERE ${condition(f)} ${orderBy(f)} ${page}`;
  return rows.map((r) => ({ ...r, needsRescoring: r.needsRescoring === true }));
}

export interface ProjectPage {
  rows: ProjectRow[];
  /** Dossiers correspondant aux filtres, et au total dans la base. */
  total: number;
  all: number;
  /** Exposition (crédits) des dossiers filtrés, toutes pages confondues. */
  exposure: number;
  page: number;
  pageCount: number;
  size: number;
  /** Rang du premier et du dernier dossier affichés (1-based). */
  from: number;
  to: number;
}

/** Une page de la liste filtrée et triée, avec les totaux des filtres. */
export async function loadProjectPage(f: ProjectFilters, now: Date = new Date()): Promise<ProjectPage> {
  const offset = (p: number) => (p - 1) * f.size;
  const [agg, firstTry] = await Promise.all([
    prisma.$queryRaw<{ all: number; total: number; exposure: number }[]>`
      ${listCte(now)}
      SELECT count(*)::int AS "all",
             (count(*) FILTER (WHERE ${condition(f)}))::int AS total,
             COALESCE(sum(l."loanAmount") FILTER (WHERE ${condition(f)}), 0)::float8 AS exposure
      FROM l`,
    selectRows(f, now, { size: f.size, offset: offset(f.page) }),
  ]);
  const { all, total, exposure } = agg[0] ?? { all: 0, total: 0, exposure: 0 };
  const pg = pagination(total, f.page, f.size);
  // Page demandée au-delà de la dernière (lien ancien, filtres resserrés) : on affiche la dernière.
  const rows = pg.page === f.page ? firstTry : await selectRows(f, now, { size: f.size, offset: offset(pg.page) });
  return { rows, total, all, exposure, size: f.size, ...pg };
}

/** Toute la liste filtrée et triée (export). */
export async function loadProjectRows(f: ProjectFilters, now: Date = new Date()): Promise<ProjectRow[]> {
  return selectRows(f, now);
}
