"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { DECISION_LABELS } from "@/lib/labels";
import { rescorePortfolioAction } from "@/server/actions/scoring";
import type { Decision } from "@/lib/domain/types";

type Result = { total: number; scored: number; synced: number; decisions: Record<string, number>; errors: string[] };

/**
 * Recalcul du portefeuille sur le modèle publié. Après la publication d'une
 * nouvelle version, les scores existants restent ceux de l'ancienne version
 * tant qu'ils ne sont pas recalculés.
 */
export function RescorePortfolioButton({ staleCount, totalCount }: { staleCount: number; totalCount: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [syncFirst, setSyncFirst] = useState(true);
  const [onlyStale, setOnlyStale] = useState(staleCount > 0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const res = await rescorePortfolioAction({ syncFirst, onlyStale });
      if (!res.ok) setError(res.error);
      else {
        setResult(res);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        {staleCount > 0 ? (
          <span className="text-amber-700">
            {staleCount} projet(s) sur {totalCount} n'ont pas de score calculé avec la version publiée.
          </span>
        ) : (
          <span className="text-muted-foreground">Tous les scores ({totalCount}) sont calculés avec la version publiée.</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={syncFirst} onChange={(e) => setSyncFirst(e.target.checked)} />
          Synchroniser d'abord les données de suivi (autorisations, financement acquéreur, désengagement, division des risques, impayés)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} />
          Uniquement les scores périmés
        </label>
        <ConfirmButton variant="primary" tone="primary" onConfirm={run} disabled={pending}
          title={onlyStale ? `Recalculer ${staleCount} dossier(s) ?` : `Recalculer les ${totalCount} dossiers du portefeuille ?`}
          description="Chaque dossier reçoit un nouveau score avec le modèle publié. Une donnée non renseignée est notée au plancher : renseignez les données du modèle avant de recalculer, sinon des décisions peuvent se dégrader mécaniquement."
          confirmLabel="Recalculer">
          {pending ? "Recalcul en cours…" : "Recalculer le portefeuille"}
        </ConfirmButton>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-md border border-border p-3 text-sm space-y-1">
          <p className="font-medium">
            {result.scored} / {result.total} projet(s) recalculé(s){result.synced ? ` · ${result.synced} synchronisé(s)` : ""}.
          </p>
          <p className="text-muted-foreground">
            {Object.entries(result.decisions)
              .map(([d, n]) => `${DECISION_LABELS[d as Decision] ?? d} : ${n}`)
              .join(" · ") || "—"}
          </p>
          {result.errors.length > 0 && (
            <ul className="list-disc pl-5 text-red-700">
              {result.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
