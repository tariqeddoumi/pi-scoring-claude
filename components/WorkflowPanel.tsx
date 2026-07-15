"use client";

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

const STATE_COLORS: Record<WorkflowStateName, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  SUBMITTED: "bg-blue-100 text-blue-800 border-blue-300",
  BRANCH_REVIEW: "bg-cyan-100 text-cyan-800 border-cyan-300",
  ANALYST_REVIEW: "bg-indigo-100 text-indigo-800 border-indigo-300",
  MANAGER_VALIDATION: "bg-violet-100 text-violet-800 border-violet-300",
  COMMITTEE: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
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
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Commentaire (optionnel)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => (
                <Button
                  key={t.to}
                  variant={t.kind === "reject" ? "danger" : t.kind === "rework" ? "outline" : "primary"}
                  disabled={pending !== null}
                  onClick={() => onTransition(t.to)}
                >
                  {pending === t.to ? "…" : t.label}
                </Button>
              ))}
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
