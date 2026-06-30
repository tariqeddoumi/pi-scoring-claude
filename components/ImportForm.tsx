"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { runImport, type ImportSummary } from "@/server/actions/imports";

export function ImportForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [autoScore, setAutoScore] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null); setSummary(null); setPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (autoScore) fd.append("autoScore", "1");
      const res = await runImport(fd);
      if (!res.ok) { setError(res.error); return; }
      setSummary(res.summary);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Échec de l'import.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        <Button type="submit" disabled={pending || !file}>{pending ? "Import en cours…" : "Importer"}</Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={autoScore} onChange={(e) => setAutoScore(e.target.checked)} />
        Lancer le scoring automatiquement après l'import (projets de promotion)
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="rounded-md border border-border p-3 text-sm space-y-2">
          <p>
            <span className="font-medium">{summary.success}</span> ligne(s) importée(s) sur {summary.total}
            {summary.failed > 0 && <> · <span className="text-red-600 font-medium">{summary.failed} en erreur</span></>}.
          </p>
          {summary.scored !== undefined && (
            <p>
              <span className="font-medium">{summary.scored}</span> projet(s) scoré(s) automatiquement
              {summary.scoreFailed ? <> · <span className="text-amber-600 font-medium">{summary.scoreFailed} non scoré(s)</span></> : null}.
            </p>
          )}
          {summary.errors.length > 0 && (
            <ul className="list-disc pl-5 text-red-600 space-y-0.5 max-h-48 overflow-auto">
              {summary.errors.map((er, i) => <li key={i}>Ligne {er.rowIndex} : {er.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
