import Link from "next/link";
import { CONTROL } from "@/lib/formStyles";
import { loadProjectPage } from "@/server/services/projectList";
import { Card, CardContent, Table, Th, Td, Badge, Button } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { formatMAD, formatMADCompact, formatDate } from "@/lib/utils";
import { CLASS_LABELS, CLASS_COLORS, DECISION_LABELS, DECISION_COLORS, WORKFLOW_STATE_COLORS } from "@/lib/labels";
import { WORKFLOW_LABELS, type WorkflowStateName } from "@/lib/workflow";
import { SEGMENTS, CITIES } from "@/lib/domain/referentiels";
import type { Decision, RegulatoryClassCode } from "@/lib/domain/types";
import {
  hasActiveFilters, pageHref, pageWindow, parseProjectFilters, sortHref, toQuery,
  DEFAULT_PAGE_SIZE, PAGE_SIZES, type ProjectFilters, type SortKey,
} from "@/lib/projectFilters";

export const dynamic = "force-dynamic";

const sel = `${CONTROL} min-w-0`;

function SortTh({ f, k, children, className }: { f: ProjectFilters; k: SortKey; children: React.ReactNode; className?: string }) {
  const active = f.sort === k;
  return (
    <Th className={className} aria-sort={active ? (f.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={`/projects${sortHref(f, k)}`} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <span aria-hidden="true" className={active ? "text-foreground" : "opacity-30"}>{active && f.dir === "asc" ? "▲" : "▼"}</span>
      </Link>
    </Th>
  );
}

/** Navigation entre les pages et taille de page (liens : fonctionne sans JavaScript). */
function Pager({ f, page, pageCount, total }: { f: ProjectFilters; page: number; pageCount: number; total: number }) {
  const link = "inline-flex min-w-9 items-center justify-center rounded-md px-2.5 py-1.5 text-sm";
  const sizes = total > PAGE_SIZES[0] && (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <span>Par page :</span>
      {PAGE_SIZES.map((n) => n === f.size
        ? <span key={n} aria-current="true" className="rounded px-1.5 py-0.5 font-semibold text-foreground">{n}</span>
        : <Link key={n} href={`/projects${toQuery({ ...f, size: n, page: 1 })}`} aria-label={`${n} dossiers par page`} className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground">{n}</Link>)}
    </div>
  );
  if (pageCount <= 1) return sizes ? <div className="flex justify-end">{sizes}</div> : null;
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1">
      {page > 1
        ? <Link href={`/projects${pageHref(f, page - 1)}`} rel="prev" className={`${link} hover:bg-muted`}>← Précédente</Link>
        : <span className={`${link} text-muted-foreground opacity-50`} aria-hidden="true">← Précédente</span>}
      {pageWindow(page, pageCount).map((n, i) => n == null
        ? <span key={`e${i}`} className={`${link} text-muted-foreground`} aria-hidden="true">…</span>
        : n === page
          ? <span key={n} aria-current="page" className={`${link} bg-primary font-semibold text-primary-foreground`}>{n}</span>
          : <Link key={n} href={`/projects${pageHref(f, n)}`} aria-label={`Page ${n}`} className={`${link} hover:bg-muted`}>{n}</Link>)}
      {page < pageCount
        ? <Link href={`/projects${pageHref(f, page + 1)}`} rel="next" className={`${link} hover:bg-muted`}>Suivante →</Link>
        : <span className={`${link} text-muted-foreground opacity-50`} aria-hidden="true">Suivante →</span>}
    </nav>
    {sizes}
    </div>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = parseProjectFilters(await searchParams);
  const res = await safe(() => loadProjectPage(f));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const canWrite = await currentUserCan(PERMISSIONS.PROJECT_WRITE);
  const canExport = await currentUserCan(PERMISSIONS.EXPORT_RUN);
  const { rows: list, total, all, exposure, page, pageCount, from, to } = res.data;
  const active = hasActiveFilters(f);
  // L'export reprend les filtres et le tri, pas la page : il contient toute la liste.
  const exportQuery = (format: "csv" | "xlsx") => toQuery({ ...f, page: 1, size: undefined, format });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Projets de promotion immobilière</h1>
          <p className="text-sm text-muted-foreground">
            {total} dossier(s){active ? ` sur ${all}` : ""} · exposition {formatMADCompact(exposure)}
            {pageCount > 1 && <> · {from}–{to} affichés</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && total > 0 && (
            <>
              <a href={`/api/export/projects${exportQuery("xlsx")}`}
                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                title="Exporte la liste affichée (filtres et tri appliqués)">
                Exporter · Excel
              </a>
              <a href={`/api/export/projects${exportQuery("csv")}`}
                className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                CSV
              </a>
            </>
          )}
          {canWrite && <Link href="/projects/new"><Button>+ Nouveau projet</Button></Link>}
        </div>
      </div>

      <Card>
        <CardContent>
          <form method="get" action="/projects" role="search" aria-label="Filtrer les projets"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,2fr)_repeat(5,minmax(0,1fr))_auto]">
            <label className="sr-only" htmlFor="f-q">Rechercher</label>
            <input id="f-q" name="q" type="search" defaultValue={f.q} placeholder="Référence, projet, promoteur, ville…" className={sel} />
            <label className="sr-only" htmlFor="f-seg">Segment</label>
            <select id="f-seg" name="segment" defaultValue={f.segment} className={sel}>
              <option value="">Segment</option>
              {SEGMENTS.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="f-dec">Décision</label>
            <select id="f-dec" name="decision" defaultValue={f.decision} className={sel}>
              <option value="">Décision</option>
              {(Object.keys(DECISION_LABELS) as Decision[]).map((d) => <option key={d} value={d}>{DECISION_LABELS[d]}</option>)}
            </select>
            <label className="sr-only" htmlFor="f-cls">Classe BKAM</label>
            <select id="f-cls" name="cls" defaultValue={f.cls} className={sel}>
              <option value="">Classe BKAM</option>
              {(Object.keys(CLASS_LABELS) as RegulatoryClassCode[]).map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
            </select>
            <label className="sr-only" htmlFor="f-state">Étape du circuit</label>
            <select id="f-state" name="state" defaultValue={f.state} className={sel}>
              <option value="">Étape</option>
              {(Object.keys(WORKFLOW_LABELS) as WorkflowStateName[]).map((s) => <option key={s} value={s}>{WORKFLOW_LABELS[s]}</option>)}
            </select>
            <label className="sr-only" htmlFor="f-scored">Scoring</label>
            <select id="f-scored" name="scored" defaultValue={f.scored} className={sel}>
              <option value="">Scoring</option>
              <option value="scored">Déjà scorés</option>
              <option value="unscored">Jamais scorés</option>
              <option value="stale">À rafraîchir</option>
            </select>
            <input type="hidden" name="sort" value={f.sort} />
            <input type="hidden" name="dir" value={f.dir} />
            {f.size !== DEFAULT_PAGE_SIZE && <input type="hidden" name="size" value={f.size} />}
            <div className="flex gap-2">
              <Button type="submit">Filtrer</Button>
              {active && <Link href={`/projects${toQuery({ sort: f.sort, dir: f.dir, size: f.size })}`} className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Effacer</Link>}
            </div>
          </form>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="font-medium">{all === 0 ? "Aucun projet pour l'instant." : "Aucun dossier ne correspond à ces critères."}</p>
          {active && <Link href="/projects" className="mt-2 inline-block text-sm text-primary hover:underline">Afficher tous les projets</Link>}
        </CardContent></Card>
      ) : (
        <>
          {/* Mobile : une carte par dossier */}
          <ul className="space-y-2 md:hidden">
            {list.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${r.id}`} className="block rounded-lg border border-border bg-background p-3 shadow-sm hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.reference} · {r.promoter}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-semibold tabular-nums">{r.score != null ? Math.round(r.score) : "—"}</div>
                      <div className="text-[11px] text-muted-foreground">score</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge className={WORKFLOW_STATE_COLORS[r.state as WorkflowStateName]}>{WORKFLOW_LABELS[r.state as WorkflowStateName] ?? r.state}</Badge>
                    {r.decision && <Badge className={DECISION_COLORS[r.decision as Decision]}>{DECISION_LABELS[r.decision as Decision]}</Badge>}
                    {r.regulatoryClass && <Badge className={CLASS_COLORS[r.regulatoryClass as RegulatoryClassCode]}>{CLASS_LABELS[r.regulatoryClass as RegulatoryClassCode]}</Badge>}
                    <span className="ml-auto text-muted-foreground">{formatMADCompact(r.loanAmount)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Écran large : tableau triable */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <SortTh f={f} k="reference">Réf.</SortTh>
                    <SortTh f={f} k="name">Projet</SortTh>
                    <SortTh f={f} k="promoter">Promoteur</SortTh>
                    <Th className="hidden lg:table-cell">Ville · segment</Th>
                    <SortTh f={f} k="loanAmount" className="text-right">Crédit</SortTh>
                    <SortTh f={f} k="score" className="text-right">Score</SortTh>
                    <Th>Classe</Th><Th>Décision</Th><Th>Étape</Th>
                    <SortTh f={f} k="updatedAt" className="hidden 2xl:table-cell">Mis à jour</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <Td className="whitespace-nowrap"><Link className="text-primary hover:underline font-medium" href={`/projects/${r.id}`}>{r.reference}</Link></Td>
                      <Td>{r.name}</Td>
                      <Td className="text-muted-foreground">{r.promoter}</Td>
                      <Td className="hidden lg:table-cell text-muted-foreground">{CITIES.labelOf(r.city)}<div className="text-xs">{SEGMENTS.labelOf(r.segment)}</div></Td>
                      <Td className="text-right whitespace-nowrap" ><span title={formatMAD(r.loanAmount)}>{formatMADCompact(r.loanAmount)}</span></Td>
                      <Td className="text-right font-semibold">{r.score != null ? Math.round(r.score) : <span className="text-muted-foreground font-normal">—</span>}</Td>
                      <Td>{r.regulatoryClass ? <Badge className={CLASS_COLORS[r.regulatoryClass as RegulatoryClassCode]}>{CLASS_LABELS[r.regulatoryClass as RegulatoryClassCode]}</Badge> : "—"}</Td>
                      <Td>{r.decision ? <Badge className={DECISION_COLORS[r.decision as Decision]}>{DECISION_LABELS[r.decision as Decision]}</Badge> : <span className="text-xs text-muted-foreground">non scoré</span>}</Td>
                      <Td className="whitespace-nowrap"><Badge className={WORKFLOW_STATE_COLORS[r.state as WorkflowStateName]}>{WORKFLOW_LABELS[r.state as WorkflowStateName] ?? r.state}</Badge></Td>
                      <Td className="hidden 2xl:table-cell whitespace-nowrap text-muted-foreground">{formatDate(r.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          <Pager f={f} page={page} pageCount={pageCount} total={total} />
        </>
      )}
    </div>
  );
}
