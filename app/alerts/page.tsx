import Link from "next/link";
import { Card, CardContent, Badge } from "@/components/ui";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { getCurrentAppUser } from "@/lib/supabase/server";
import { loadNotifications } from "@/server/services/notifications";
import { countByLevel, NOTIFICATION_KIND_LABELS, type NotificationKind, type NotificationLevel } from "@/lib/domain/notifications";
import { formatDate } from "@/lib/utils";
import { TONE } from "@/lib/tones";

export const dynamic = "force-dynamic";

const LEVELS: { value: NotificationLevel; label: string; tone: string }[] = [
  { value: "danger", label: "À traiter en priorité", tone: TONE.danger },
  { value: "warning", label: "Vigilance", tone: TONE.warning },
  { value: "info", label: "À prévoir", tone: TONE.info },
];
const levelOf = (v: string) => LEVELS.find((l) => l.value === v);

export default async function AlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentAppUser();
  if (!user) return null;
  const res = await safe(() => loadNotifications(user));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const sp = await searchParams;
  const niveau = String(sp.niveau ?? "");
  const type = String(sp.type ?? "");
  const all = res.data;
  const counts = countByLevel(all);
  const kinds = [...new Set(all.map((n) => n.kind))];
  const list = all.filter((n) => (!niveau || n.level === niveau) && (!type || n.kind === type));
  const projects = new Set(list.map((n) => n.projectId)).size;
  const link = (o: { niveau?: string; type?: string }) => {
    const p = new URLSearchParams();
    const nv = o.niveau ?? niveau, ty = o.type ?? type;
    if (nv) p.set("niveau", nv);
    if (ty) p.set("type", ty);
    const q = p.toString();
    return `/alerts${q ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alertes & échéances</h1>
          <p className="text-sm text-muted-foreground">
            {user.role.name === "RELATIONSHIP_MANAGER" ? "Vos dossiers" : "Tout le portefeuille"} · revues de score, décisions de comité, alertes du dernier score, événements critiques, équipements exigés.
          </p>
        </div>
        <Link href="/alerts/resume" className="inline-flex items-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
          Résumé hebdomadaire par e-mail
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {LEVELS.map((l) => (
          <Link key={l.value} href={link({ niveau: niveau === l.value ? "" : l.value })} aria-pressed={niveau === l.value}
            className={`card block p-4 transition hover:shadow ${niveau === l.value ? "ring-2 ring-primary" : ""}`}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{l.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{counts[l.value]}</div>
          </Link>
        ))}
      </div>

      {kinds.length > 1 && (
        <nav aria-label="Filtrer par type d'alerte" className="flex flex-wrap gap-1.5">
          <Link href={link({ type: "" })} aria-current={!type ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${!type ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}>Tous les types</Link>
          {kinds.map((k) => (
            <Link key={k} href={link({ type: k })} aria-current={type === k ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${type === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}>
              {NOTIFICATION_KIND_LABELS[k as NotificationKind]}
            </Link>
          ))}
        </nav>
      )}

      {list.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <p className="font-medium">{all.length === 0 ? "Aucune alerte : tous les dossiers sont à jour." : "Aucune alerte pour ce filtre."}</p>
          {all.length > 0 && <Link href="/alerts" className="mt-2 inline-block text-sm text-primary hover:underline">Afficher toutes les alertes</Link>}
        </CardContent></Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{list.length} alerte(s) sur {projects} dossier(s)</p>
          <ul className="space-y-2">
            {list.map((n) => {
              const l = levelOf(n.level)!;
              return (
                <li key={n.id} className="card p-3 sm:p-4">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <Badge className={l.tone}>{l.label}</Badge>
                    <span className="text-xs text-muted-foreground">{NOTIFICATION_KIND_LABELS[n.kind]}</span>
                    {n.date && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatDate(n.date)}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/projects/${n.projectId}`} className="font-medium text-primary hover:underline">{n.reference}</Link>
                    <span className="text-sm text-muted-foreground">{n.projectName}</span>
                  </div>
                  <p className="mt-1 font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.detail}</p>
                  <Link href={n.href} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Traiter →</Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
