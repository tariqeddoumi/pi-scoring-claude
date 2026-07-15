"use client";

// Panneau des liens entre promoteurs (parties liées) : liste + ajout +
// suppression. L'application des droits se fait côté serveur (project.write).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { addPromoterLink, removePromoterLink } from "@/server/actions/promoters";
import { PROMOTER_LINK_TYPES } from "@/lib/domain/referentiels";

export interface PromoterLinkView {
  id: string;
  otherId: string;
  otherName: string;
  direction: "from" | "to"; // from = ce promoteur est la source du lien
  type: string;
  note: string | null;
}

export function PromoterLinksPanel({ promoterId, links, others, canEdit }: {
  promoterId: string;
  links: PromoterLinkView[];
  others: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [toId, setToId] = useState("");
  const [type, setType] = useState("");
  const [note, setNote] = useState("");

  const inp = "rounded-md border border-border bg-background px-3 py-2 text-sm";

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await addPromoterLink({ fromId: promoterId, toId, type, note });
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Champs invalides.");
        return;
      }
      setToId(""); setType(""); setNote("");
      router.refresh();
    });

  const remove = (linkId: string) =>
    start(async () => {
      setError(null);
      const res = await removePromoterLink(linkId);
      if (!res.ok) setError(res.error ?? "Suppression impossible.");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Liens & parties liées
          <Badge className="bg-muted">{links.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun lien déclaré avec un autre promoteur.</p>
        )}
        {links.length > 0 && (
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span className="min-w-0">
                  <Badge className="bg-slate-100 text-slate-700 border-slate-300 mr-2">
                    {PROMOTER_LINK_TYPES.labelOf(l.type)}
                  </Badge>
                  <Link href={`/promoters/${l.otherId}`} className="text-primary hover:underline font-medium">
                    {l.otherName}
                  </Link>
                  {l.direction === "to" && <span className="text-muted-foreground"> (lien déclaré depuis ce promoteur)</span>}
                  {l.note && <span className="text-muted-foreground"> — {l.note}</span>}
                </span>
                {canEdit && (
                  <Button variant="outline" onClick={() => remove(l.id)} disabled={pending} className="shrink-0">
                    Retirer
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="rounded-md border border-dashed border-border p-3 space-y-2">
            <div className="text-sm font-medium">Déclarer un lien</div>
            <div className="flex flex-wrap gap-2">
              <select value={type} onChange={(e) => setType(e.target.value)} className={inp}>
                <option value="">— Type de lien —</option>
                {PROMOTER_LINK_TYPES.items.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className={inp}>
                <option value="">— Promoteur lié —</option>
                {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Précision (optionnel)"
                className={`${inp} flex-1 min-w-40`}
              />
              <Button onClick={submit} disabled={pending || !toId || !type}>
                {pending ? "Ajout…" : "Ajouter"}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
