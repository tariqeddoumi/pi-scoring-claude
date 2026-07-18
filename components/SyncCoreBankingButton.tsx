"use client";

// Bouton de synchronisation du dossier depuis le SI bancaire (T24 / Evolan) :
// facilités & encours, échéancier & impayés, déblocages, restructuration.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { syncFromCoreBanking } from "@/server/actions/coreBanking";

export function SyncCoreBankingButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSync() {
    setError(null);
    setDone(null);
    setPending(true);
    try {
      const res = await syncFromCoreBanking(projectId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(
        `${res.source} (situation au ${new Date(res.asOf).toLocaleDateString("fr-FR")}) : ` +
          `${res.facilitiesUpserted} facilité(s), ${res.disbursementsCreated} déblocage(s) importé(s)` +
          (res.restructurationCreated ? ", restructuration signalée" : "") +
          ". Rattachez les déblocages au planning du BP puis synchronisez vers le scoring.",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" onClick={onSync} disabled={pending}>
          {pending ? "Synchronisation SI…" : "Synchroniser depuis le SI (T24/Evolan)"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Encours, échéancier & impayés, déblocages, restructuration — via la référence SI du dossier.
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-emerald-700">{done}</p>}
    </div>
  );
}
