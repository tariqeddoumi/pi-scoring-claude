"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { createVisitReport, extractVisitReportWithAI } from "@/server/actions/projects";
import { extractReportFields, type ExtractedReportFields, type ReportDocument } from "@/lib/domain/visitReportExtraction";

// Lit un fichier (image/PDF) en base64 sans le préfixe data: pour l'envoi au serveur.
function fileToDocument(file: File): Promise<ReportDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ base64: result.slice(result.indexOf(",") + 1), mediaType: file.type });
    };
    reader.readAsDataURL(file);
  });
}

const FIELD_LABELS: Record<string, string> = {
  visitDate: "Date",
  observedProgressPct: "Avancement",
  workforceCount: "Effectif",
  trancheCode: "Tranche",
  weatherImpact: "Intempéries",
  qualityIssue: "Qualité",
  safetyIssue: "Sécurité",
  delayRisk: "Retard",
  summary: "Synthèse",
};

const emptyForm = {
  visitDate: "",
  inspectorName: "",
  trancheCode: "",
  status: "DRAFT",
  observedProgressPct: "",
  workforceCount: "",
  weatherImpact: false,
  qualityIssue: false,
  safetyIssue: false,
  delayRisk: false,
  summary: "",
  observations: "",
  recommendations: "",
};

export function VisitReportForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [detected, setDetected] = useState<string[] | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [aiPending, setAiPending] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));

  // Pré-remplit le formulaire à partir des champs candidats extraits.
  function applyFields(f: ExtractedReportFields) {
    setDetected(f.detected);
    setForm((prev) => ({
      ...prev,
      visitDate: f.visitDate ?? prev.visitDate,
      trancheCode: f.trancheCode ?? prev.trancheCode,
      observedProgressPct: f.observedProgressPct != null ? String(f.observedProgressPct) : prev.observedProgressPct,
      workforceCount: f.workforceCount != null ? String(f.workforceCount) : prev.workforceCount,
      weatherImpact: f.weatherImpact || prev.weatherImpact,
      qualityIssue: f.qualityIssue || prev.qualityIssue,
      safetyIssue: f.safetyIssue || prev.safetyIssue,
      delayRisk: f.delayRisk || prev.delayRisk,
      summary: f.summary ?? prev.summary,
    }));
  }

  // Extraction rapide, hors ligne (heuristique), à partir du texte collé.
  function onExtract() {
    applyFields(extractReportFields(rawText));
  }

  // Extraction assistée par l'IA (Claude) : texte + documents scannés (images/PDF).
  async function onExtractAI() {
    setError(null);
    setAiPending(true);
    try {
      const documents = await Promise.all(files.map(fileToDocument));
      const res = await extractVisitReportWithAI({ rawText: rawText || undefined, documents });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      applyFields(res.fields);
    } catch {
      setError("Échec de l'extraction IA. Réessayez ou utilisez l'extraction rapide.");
    } finally {
      setAiPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await createVisitReport({
        ...form,
        projectId,
        observedProgressPct: form.observedProgressPct === "" ? null : form.observedProgressPct,
        workforceCount: form.workforceCount === "" ? null : form.workforceCount,
        rawText: rawText || undefined,
      });
      if (!res.ok) {
        setError("error" in res && typeof res.error === "string" ? res.error : "Rapport invalide (vérifiez les champs).");
        return;
      }
      setForm({ ...emptyForm });
      setRawText("");
      setFiles([]);
      setDetected(null);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  if (!open) {
    return <Button variant="outline" onClick={() => setOpen(true)}>+ Nouveau rapport de visite</Button>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Nouveau rapport de visite</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Extraction depuis un texte collé et/ou un rapport scanné */}
          <div className="space-y-2 rounded-md border border-dashed border-border p-3">
            <p className="text-sm font-medium">Pré-remplir depuis un rapport (texte collé et/ou scan)</p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={4}
              placeholder="Ex. : Visite du 15/05/2026, tranche T2. Avancement 45%. 12 ouvriers présents. Intempéries en début de semaine…"
              className={inp}
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Scan du rapport (images ou PDF) — extraction IA</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
              />
              {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} fichier(s) : {files.map((f) => f.name).join(", ")}</p>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" onClick={onExtractAI} disabled={aiPending || (!rawText.trim() && files.length === 0)}>
                {aiPending ? "Extraction IA…" : "Extraire avec l'IA (texte + scan)"}
              </Button>
              <Button type="button" variant="outline" onClick={onExtract} disabled={!rawText.trim()}>Extraction rapide (texte, hors ligne)</Button>
            </div>
            {detected && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                {detected.length === 0 ? "Aucun champ détecté." : <><span>Champs détectés :</span>{detected.map((d) => (
                  <Badge key={d} className="bg-emerald-100 text-emerald-800 border-emerald-300">{FIELD_LABELS[d] ?? d}</Badge>
                ))}</>}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">L'IA lit le texte et les scans pour proposer des valeurs ; vérifiez-les avant d'enregistrer. Sans clé API configurée, l'extraction retombe automatiquement sur l'analyse de texte hors ligne.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="space-y-1 text-sm"><span className="font-medium">Date de visite *</span>
              <input type="date" value={form.visitDate} onChange={set("visitDate")} className={inp} required /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Tranche</span>
              <input type="text" value={form.trancheCode} onChange={set("trancheCode")} className={inp} placeholder="T1" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Contrôleur</span>
              <input type="text" value={form.inspectorName} onChange={set("inspectorName")} className={inp} /></label>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="space-y-1 text-sm"><span className="font-medium">Avancement constaté (%)</span>
              <input type="number" min={0} max={100} step="0.1" value={form.observedProgressPct} onChange={set("observedProgressPct")} className={inp} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Effectif présent</span>
              <input type="number" min={0} value={form.workforceCount} onChange={set("workforceCount")} className={inp} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Statut</span>
              <select value={form.status} onChange={set("status")} className={inp}>
                <option value="DRAFT">Brouillon</option>
                <option value="FINALIZED">Finalisé</option>
              </select></label>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.weatherImpact} onChange={toggle("weatherImpact")} /> Intempéries</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.qualityIssue} onChange={toggle("qualityIssue")} /> Non-conformité / qualité</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.safetyIssue} onChange={toggle("safetyIssue")} /> Sécurité (HSE)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.delayRisk} onChange={toggle("delayRisk")} /> Risque de retard</label>
          </div>

          <label className="space-y-1 text-sm block"><span className="font-medium">Synthèse</span>
            <input type="text" value={form.summary} onChange={set("summary")} className={inp} /></label>
          <label className="space-y-1 text-sm block"><span className="font-medium">Observations</span>
            <textarea value={form.observations} onChange={set("observations")} rows={3} className={inp} /></label>
          <label className="space-y-1 text-sm block"><span className="font-medium">Recommandations</span>
            <textarea value={form.recommendations} onChange={set("recommendations")} rows={2} className={inp} /></label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer le rapport"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
