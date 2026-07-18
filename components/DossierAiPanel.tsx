"use client";

// Lecture IA des documents du dossier : dépose de documents (PDF/images) et/ou
// texte collé → l'IA propose des valeurs pour les champs qu'elle sait lire.
// Écran de revue : les champs VIDES sont cochés par défaut (complétés), les
// champs déjà saisis ne sont remplacés que si on les coche explicitement.
// Tout reste ensuite modifiable dans le wizard.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { analyzeDossierDocuments, applyDossierExtraction } from "@/server/actions/dossierAi";
import { INPUT_LABELS } from "@/lib/inputLabels";

interface DocPayload { base64: string; mediaType: string; name: string }

const MAX_DOCS = 5;
const MAX_SIZE = 4 * 1024 * 1024; // 4 Mo (limite server actions 5 Mo)

interface Candidate {
  key: string;
  value: number | boolean | string;
  alreadyFilled: boolean;
  selected: boolean;
}

export function DossierAiPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocPayload[]>([]);
  const [rawText, setRawText] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []).slice(0, MAX_DOCS);
    const loaded: DocPayload[] = [];
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setError(`« ${f.name} » dépasse 4 Mo — compressez ou découpez le document.`);
        continue;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      loaded.push({ base64, mediaType: f.type, name: f.name });
    }
    setDocs(loaded);
  }

  const analyze = () =>
    start(async () => {
      setError(null);
      setDone(null);
      setCandidates(null);
      const res = await analyzeDossierDocuments(projectId, {
        rawText: rawText || undefined,
        documents: docs.map((d) => ({ base64: d.base64, mediaType: d.mediaType })),
      });
      if (!res.ok) {
        setError(res.error ?? "Analyse impossible.");
        return;
      }
      const filled = new Set(res.filledKeys);
      setCandidates(
        res.readKeys.map((key) => ({
          key,
          value: res.values[key]!,
          alreadyFilled: filled.has(key),
          // Par défaut : on COMPLÈTE les champs vides, on ne REMPLACE pas.
          selected: !filled.has(key),
        })),
      );
      setUnreadCount(res.unreadKeys.length);
    });

  const apply = () =>
    start(async () => {
      if (!candidates) return;
      setError(null);
      const chosen = candidates.filter((c) => c.selected);
      const values = Object.fromEntries(chosen.map((c) => [c.key, c.value]));
      const overwriteKeys = chosen.filter((c) => c.alreadyFilled).map((c) => c.key);
      const res = await applyDossierExtraction(projectId, values, overwriteKeys);
      if (!res.ok) {
        setError(res.error ?? "Application impossible.");
        return;
      }
      setDone(`${res.applied} champ(s) appliqué(s) — vérifiez et complétez le reste dans le wizard ci-dessous (tout est modifiable).`);
      setCandidates(null);
      router.refresh();
    });

  const fmt = (v: number | boolean | string) =>
    typeof v === "boolean" ? (v ? "Oui" : "Non") : String(v);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lecture IA des documents du dossier</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Déposez le business plan, la note de présentation, les autorisations… L&apos;IA pré-remplit
          <span className="font-medium"> uniquement les champs qu&apos;elle sait lire</span> ; vous saisissez le reste,
          et toute valeur importée reste modifiable.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
            onChange={onFiles}
            className="text-sm"
          />
          {docs.length > 0 && <Badge className="bg-muted">{docs.length} document(s)</Badge>}
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Ou collez ici un extrait de texte (note, tableau, email)…"
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <Button onClick={analyze} disabled={pending || (docs.length === 0 && !rawText.trim())}>
          {pending && !candidates ? "Analyse en cours…" : "Analyser avec l'IA"}
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && <p className="text-sm text-emerald-700">{done}</p>}

        {candidates && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-medium">{candidates.length} champ(s) lu(s)</span>
              <span className="text-muted-foreground">· {unreadCount} champ(s) non lus, à saisir manuellement</span>
            </div>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun champ n&apos;a pu être établi à partir de ces documents.
              </p>
            ) : (
              <>
                <ul className="space-y-1">
                  {candidates.map((c, idx) => (
                    <li key={c.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={c.selected}
                        onChange={() =>
                          setCandidates((prev) =>
                            prev!.map((x, i) => (i === idx ? { ...x, selected: !x.selected } : x)),
                          )
                        }
                      />
                      <span className="font-medium">{INPUT_LABELS[c.key] ?? c.key}</span>
                      <span>→ {fmt(c.value)}</span>
                      {c.alreadyFilled && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                          déjà saisi — cocher pour remplacer
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                <Button onClick={apply} disabled={pending || candidates.every((c) => !c.selected)}>
                  {pending ? "Application…" : "Appliquer les champs cochés"}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
