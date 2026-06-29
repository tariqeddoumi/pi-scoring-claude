"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createModelDraft } from "@/server/actions/modelBuilder";

export function CreateDraftButton({ label = "Créer un brouillon éditable" }: { label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null); setPending(true);
    try {
      const res = await createModelDraft();
      if (!res.ok) { setError(res.error); return; }
      router.push("/admin/model/draft");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button onClick={onCreate} disabled={pending}>{pending ? "Création…" : label}</Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
