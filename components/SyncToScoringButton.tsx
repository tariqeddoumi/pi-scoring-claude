"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { syncMonitoringToInputs } from "@/server/actions/scoring";

type Note = { key: string; label: string; value: string; reason: string };

export function SyncToScoringButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSync() {
    setError(null);
    setPending(true);
    try {
      const res = await syncMonitoringToInputs(projectId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotes(res.notes);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" onClick={onSync} disabled={pending}>
          {pending ? "Synchronisation…" : "Synchroniser vers le scoring"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Reporte prévente, ventes/plan, avancement/plan et décalage BP dans les entrées de scoring.
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notes && (
        <div className="rounded-md border border-border p-3 text-sm space-y-1">
          <p className="font-medium">Entrées de scoring mises à jour :</p>
          <ul className="space-y-0.5">
            {notes.map((n) => (
              <li key={n.key} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{n.label} :</span>
                <span>{n.value}</span>
                <span className="text-muted-foreground">— {n.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Relancez le scoring pour intégrer ces valeurs.</p>
        </div>
      )}
    </div>
  );
}
