"use client";

import { ConfirmButton } from "@/components/ConfirmButton";
import { Input } from "@/components/form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import {
  allowedTransitions,
  WORKFLOW_LABELS,
  type WorkflowStateName,
} from "@/lib/workflow";
import { hasPermission, type RoleName } from "@/lib/rbac";
import { transitionWorkflow } from "@/server/actions/workflow";
import { TONE } from "@/lib/tones";

const STATE_COLORS: Record<WorkflowStateName, string> = {
  DRAFT: TONE.neutral,
  SUBMITTED: TONE.info,
  BRANCH_REVIEW: "bg-cyan-100 text-cyan-800 border-cyan-300",
  ANALYST_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
  MANAGER_VALIDATION: "bg-violet-100 text-violet-800 border-violet-300",
  COMMITTEE: TONE.warning,
  APPROVED: TONE.success,
  REJECTED: TONE.danger,
};

export function WorkflowPanel({
  projectId,
  currentState,
  role,
}: {
  projectId: string;
  currentState: WorkflowStateName;
  role: RoleName;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const transitions = allowedTransitions(currentState).filter((t) =>
    hasPermission(role, t.permission),
  );

  async function onTransition(to: WorkflowStateName) {
    setError(null);
    setPending(to);
    try {
      const res = await transitionWorkflow(projectId, to, comment);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setComment("");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Circuit de décision
          <Badge className={STATE_COLORS[currentState]}>{WORKFLOW_LABELS[currentState]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune action disponible pour votre rôle à cette étape.
          </p>
        ) : (
          <>
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-label="Commentaire de la transition"
              placeholder="Commentaire (optionnel, recommandé pour un renvoi ou un rejet)"
            />
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) =>
                t.kind === "reject" ? (
                  // Un rejet clôt le dossier : confirmation explicite.
                  <ConfirmButton
                    key={t.to}
                    variant="danger"
                    disabled={pending !== null}
                    title="Rejeter le dossier ?"
                    description={comment.trim() ? `Motif saisi : « ${comment.trim()} »` : "Aucun commentaire saisi : il est recommandé de motiver le rejet dans le champ ci-dessus."}
                    confirmLabel="Rejeter le dossier"
                    onConfirm={() => onTransition(t.to)}
                  >
                    {pending === t.to ? "…" : t.label}
                  </ConfirmButton>
                ) : (
                  <Button
                    key={t.to}
                    variant={t.kind === "rework" ? "outline" : "primary"}
                    disabled={pending !== null}
                    onClick={() => onTransition(t.to)}
                  >
                    {pending === t.to ? "…" : t.label}
                  </Button>
                ),
              )}
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
