"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { runScoringAction } from "@/server/actions/scoring";

export function RunScoringButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runScoringAction(projectId);
            setMsg(r.ok ? `Score ${r.scoreFinal} · ${r.decision} · ${r.resultClass}` : (r.error ?? "Échec"));
            router.refresh();
          })
        }
      >
        {pending ? "Calcul en cours…" : "Lancer le scoring + classification BKAM"}
      </Button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </div>
  );
}
