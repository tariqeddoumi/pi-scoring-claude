"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  runScoringAction,
  runClassificationAction,
  runEconomicScoringAction,
  runProvisioningAction,
} from "@/server/actions/scoring";

export function RunScoringButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  // Lance une action serveur et restitue son message, puis rafraîchit la page.
  const run = (fn: () => Promise<string>) =>
    start(async () => {
      setMsg(null);
      try {
        setMsg(await fn());
      } catch {
        setMsg("Échec");
      }
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await runScoringAction(projectId);
              return r.ok ? `Score ${r.scoreFinal} · ${r.decision} · ${r.resultClass}` : (r.error ?? "Échec");
            })
          }
        >
          {pending ? "Calcul en cours…" : "Lancer le scoring + classification BKAM"}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>

      {/* Moteurs découplés (Phase 3) : classification / scoring / provision séparés. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Moteurs séparés :</span>
        <Button
          variant="outline" className="text-xs px-2 py-1" disabled={pending}
          onClick={() => run(async () => {
            const r = await runClassificationAction(projectId);
            return r.ok ? `Classe ${r.resultClass}${r.isWatchList ? " (Watch List)" : ""}` : (r.error ?? "Échec");
          })}
        >
          1. Classifier (1/W)
        </Button>
        <Button
          variant="outline" className="text-xs px-2 py-1" disabled={pending}
          onClick={() => run(async () => {
            const r = await runEconomicScoringAction(projectId);
            return r.ok ? `Score ${r.scoreFinal} · ${r.decision}` : (r.error ?? "Échec");
          })}
        >
          2. Scorer
        </Button>
        <Button
          variant="outline" className="text-xs px-2 py-1" disabled={pending}
          onClick={() => run(async () => {
            const r = await runProvisioningAction(projectId);
            return r.ok ? `Provision ${Math.round(r.provisionAmount).toLocaleString("fr-FR")} MAD · ${r.classCode}` : (r.error ?? "Échec");
          })}
        >
          3. Provisionner
        </Button>
      </div>
    </div>
  );
}
