import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { countByLevel, NOTIFICATION_KIND_LABELS, type Notification } from "@/lib/domain/notifications";
import { TONE } from "@/lib/tones";

/** Encart du tableau de bord : alertes prioritaires et accès à la liste complète. */
export function AlertsSummary({ items, max = 5 }: { items: Notification[]; max?: number }) {
  const c = countByLevel(items);
  const top = items.slice(0, max);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex flex-wrap items-center gap-2">
          Alertes & échéances
          {c.danger > 0 && <Badge className={TONE.danger}>{c.danger} prioritaire(s)</Badge>}
          {c.warning > 0 && <Badge className={TONE.warning}>{c.warning} vigilance</Badge>}
        </CardTitle>
        <Link href="/alerts" className="text-sm font-medium text-primary hover:underline">Tout voir ({items.length}) →</Link>
      </CardHeader>
      <CardContent className="p-0">
        {top.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucune alerte : les dossiers sont à jour.</p>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((n) => (
              <li key={n.id}>
                <Link href={n.href} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 hover:bg-muted/50">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 self-center rounded-full ${n.level === "danger" ? "bg-red-500" : n.level === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                  <span className="font-medium text-primary">{n.reference}</span>
                  <span className="text-sm">{n.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{NOTIFICATION_KIND_LABELS[n.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
