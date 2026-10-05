"use client";

// Écran « Documents du dossier » :
//  1. dépôt des pièces (autant que nécessaire) : chaque fichier est préparé dans
//     le navigateur (découpage des gros PDF, tableurs en texte) puis lu partie
//     par partie ; la pièce est classée et enregistrée comme reçue ;
//  2. revue des valeurs lues, avec leur source (pièce, page, citation) et les
//     désaccords entre pièces ; champs vides cochés par défaut, remplacement
//     d'une valeur saisie seulement sur demande ;
//  3. liste des pièces : manquantes au jalon du dossier, à prévoir, reçues ;
//     liste à copier pour la relance du client.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { FormMessage, Select } from "@/components/form";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TONE } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { DOSSIER_DOCUMENTS, DOSSIER_DOC_DEFS, OTHER_DOC, classifyByFileName, type ChecklistState, type ExtractedField } from "@/lib/domain/dossierDocuments";
import { prepareDocument } from "@/lib/client/documentParts";
import {
  applyDocumentValues, changePieceType, deleteDossierPiece, readDossierPiece, recordDossierPiece, setPieceStatus,
} from "@/server/actions/dossierDocuments";

type V = number | boolean | string;

export interface ReviewCandidate {
  key: string;
  label: string;
  conflict: boolean;
  current: V | null;
  currentDisplay: string;
  options: { value: V; display: string; sources: { fileName: string; docLabel: string; page: number | null; quote: string }[] }[];
}
export interface AuthProposal { code: string; label: string; fileName: string; obtainedAt: string | null }
export interface ChecklistView {
  stageLabel: string;
  received: number;
  expected: number;
  missingCount: number;
  missingText: string;
  groups: { title: string; items: { code: string; label: string; purpose: string; state: ChecklistState; when: string; manualReceived: boolean; files: number }[] }[];
  pieces: {
    id: string; docType: string; fileName: string; source: string; title: string | null; issuer: string | null;
    documentDate: string | null; summary: string | null; attention: string[]; values: number; createdAt: string;
  }[];
}

type QueueItem = { name: string; status: "attente" | "lecture" | "ok" | "nom" | "erreur"; detail?: string };

const TYPE_OPTIONS = [...DOSSIER_DOCUMENTS.map((d) => ({ value: d.code, label: d.label })), { value: OTHER_DOC, label: "Autre pièce" }];
const docLabel = (code: string) => DOSSIER_DOC_DEFS.get(code)?.label ?? "Autre pièce";

const STATE_UI: Record<ChecklistState, { label: string; tone: string }> = {
  recu: { label: "Reçue", tone: TONE.success },
  manquant: { label: "Manquante", tone: TONE.danger },
  a_prevoir: { label: "À prévoir", tone: TONE.info },
  non_applicable: { label: "Sans objet", tone: TONE.neutral },
  facultatif: { label: "Facultative", tone: TONE.neutral },
};

export function DossierDocumentsPanel(props: {
  projectId: string;
  canWrite: boolean;
  aiConfigured: boolean;
  candidates: ReviewCandidate[];
  authProposals: AuthProposal[];
  checklist: ChecklistView;
}) {
  return (
    <div className="space-y-4">
      {props.canWrite && <UploadCard projectId={props.projectId} aiConfigured={props.aiConfigured} />}
      {props.canWrite && (props.candidates.length > 0 || props.authProposals.length > 0) && (
        <ReviewCard key={props.candidates.map((c) => `${c.key}=${String(c.current)}`).concat(props.authProposals.map((a) => a.code)).join("|")} projectId={props.projectId} candidates={props.candidates} authProposals={props.authProposals} />
      )}
      <ChecklistCard projectId={props.projectId} canWrite={props.canWrite} checklist={props.checklist} />
    </div>
  );
}

// ------------------------------------------------------------------ dépôt

function UploadCard({ projectId, aiConfigured }: { projectId: string; aiConfigured: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const update = (i: number, patch: Partial<QueueItem>) => setQueue((q) => q.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function processOne(file: File, i: number) {
    const byName = classifyByFileName(file.name);
    const recordByName = async (detail: string) => {
      const r = await recordDossierPiece(projectId, { docType: byName ?? OTHER_DOC, fileName: file.name, source: "nom" });
      update(i, r.ok ? { status: "nom", detail: `${docLabel(byName ?? OTHER_DOC)} — ${detail}` } : { status: "erreur", detail: r.error });
    };
    if (!aiConfigured) return recordByName("classée d'après son nom (lecture du contenu non configurée)");
    update(i, { status: "lecture", detail: "Préparation…" });
    const prepared = await prepareDocument(file).catch((e: unknown) => ({ unsupported: e instanceof Error ? e.message : "fichier illisible" }));
    if ("unsupported" in prepared) return recordByName(`classée d'après son nom : ${prepared.unsupported}`);

    const readings = [];
    for (const [n, part] of prepared.parts.entries()) {
      update(i, { detail: prepared.parts.length > 1 ? `Lecture ${n + 1} / ${prepared.parts.length} (${part.label})…` : "Lecture en cours…" });
      const r = await readDossierPiece(projectId, { fileName: file.name, partLabel: part.label, part: part.part }).catch(() => null);
      if (!r) return update(i, { status: "erreur", detail: "Lecture interrompue (délai dépassé ou connexion) — redéposez la pièce." });
      if (!r.ok) {
        if ("notConfigured" in r) return recordByName("classée d'après son nom");
        return update(i, { status: "erreur", detail: r.error });
      }
      readings.push({ ...r.reading, firstPage: part.firstPage });
    }

    // Fusion des parties : type le plus fréquent, première valeur trouvée par donnée.
    const counts = new Map<string, number>();
    for (const r of readings) if (r.docType !== OTHER_DOC) counts.set(r.docType, (counts.get(r.docType) ?? 0) + 1);
    const docType = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? byName ?? OTHER_DOC;
    const fields: ExtractedField[] = [];
    for (const r of readings) {
      for (const f of r.fields) {
        if (fields.some((x) => x.key === f.key)) continue;
        fields.push({ ...f, page: f.page === null ? null : f.page + r.firstPage - 1 });
      }
    }
    const first = readings[0]!;
    const rec = await recordDossierPiece(projectId, {
      docType, fileName: file.name, source: "ia",
      title: first.title, issuer: first.issuer, documentDate: first.documentDate,
      summary: readings.map((r) => r.summary).filter(Boolean).join(" "),
      attention: [...new Set(readings.flatMap((r) => r.attention))],
      extracted: fields,
    });
    update(i, rec.ok
      ? { status: "ok", detail: `${docLabel(docType)} — ${fields.length ? `${fields.length} donnée${fields.length > 1 ? "s" : ""} lue${fields.length > 1 ? "s" : ""}` : "aucune donnée de la saisie"}` }
      : { status: "erreur", detail: rec.error });
  }

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length || busy) return;
    const offset = queue.length;
    setQueue((q) => [...q, ...files.map((f) => ({ name: f.name, status: "attente" as const }))]);
    setBusy(true);
    // Deux pièces lues à la fois.
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const k = next++;
        await processOne(files[k]!, offset + k).catch((e: unknown) => update(offset + k, { status: "erreur", detail: e instanceof Error ? e.message : "Erreur" }));
      }
    };
    await Promise.all([worker(), worker()]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const statusUi: Record<QueueItem["status"], { label: string; tone: string }> = {
    attente: { label: "En attente", tone: TONE.neutral },
    lecture: { label: "Lecture", tone: TONE.info },
    ok: { label: "Lue", tone: TONE.success },
    nom: { label: "Classée", tone: TONE.warning },
    erreur: { label: "Erreur", tone: TONE.danger },
  };

  return (
    <Card>
      <CardHeader><CardTitle>Déposer des pièces</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void onFiles(e.dataTransfer.files); }}
          className={cn("flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm cursor-pointer transition",
            drag ? "border-primary bg-muted" : "border-border hover:bg-muted", busy && "pointer-events-none opacity-60")}
        >
          <span className="font-medium">Glissez les pièces ici ou cliquez pour les choisir</span>
          <span className="text-xs text-muted-foreground">
            PDF (même longs : découpés automatiquement), photos ou scans, Excel / CSV. Plusieurs fichiers à la fois.
          </span>
          <input ref={inputRef} type="file" multiple className="sr-only" aria-label="Choisir des pièces"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xlsm,.xls,.ods,.csv,.txt,.doc,.docx,image/*,application/pdf"
            onChange={(e) => void onFiles(e.target.files)} disabled={busy} />
        </label>
        {!aiConfigured && (
          <p className={cn("rounded-md border px-3 py-2 text-xs", TONE.warning)}>
            Lecture du contenu non configurée sur ce serveur (clé ANTHROPIC_API_KEY) : les pièces sont classées d&apos;après le nom du fichier
            et la liste des pièces manquantes est tenue à jour ; corrigez le type si besoin.
          </p>
        )}
        {queue.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border" aria-live="polite">
            {queue.map((q, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <Badge className={statusUi[q.status].tone}>{statusUi[q.status].label}</Badge>
                <span className="font-medium break-all">{q.name}</span>
                {q.detail && <span className="text-muted-foreground">{q.detail}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Les fichiers sont transmis pour lecture puis oubliés : seuls le type de pièce, le résumé et les valeurs lues (avec page et citation) sont gardés au dossier.
        </p>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ revue

function ReviewCard({ projectId, candidates, authProposals }: { projectId: string; candidates: ReviewCandidate[]; authProposals: AuthProposal[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([
      ...candidates.map((c) => [c.key, c.current === null]),
      ...authProposals.map((a) => [`auth:${a.code}`, true]),
    ]));
  const [choice, setChoice] = useState<Record<string, number>>({});

  const selected = candidates.filter((c) => checked[c.key]);
  const selectedAuth = authProposals.filter((a) => checked[`auth:${a.code}`]);
  const nReplace = selected.filter((c) => c.current !== null).length;

  const apply = () => start(async () => {
    setMsg({});
    const r = await applyDocumentValues(projectId, {
      values: selected.map((c) => ({ key: c.key, value: c.options[choice[c.key] ?? 0]!.value })),
      overwriteKeys: selected.filter((c) => c.current !== null).map((c) => c.key),
      authorizations: selectedAuth.map((a) => ({ code: a.code, obtainedAt: a.obtainedAt })),
    });
    if (!r.ok) return setMsg({ error: r.error });
    setMsg({ success: `${r.applied} valeur${r.applied > 1 ? "s" : ""} reportée${r.applied > 1 ? "s" : ""} dans la saisie. Relancez le scoring pour en tenir compte.` });
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Données lues à reporter dans la saisie</CardTitle>
        <p className="text-sm text-muted-foreground">
          Vérifiez chaque valeur avec sa source. Les champs encore vides sont cochés ; une valeur déjà saisie n&apos;est remplacée que si vous la cochez.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border rounded-md border border-border">
          {candidates.map((c) => {
            const idx = choice[c.key] ?? 0;
            return (
              <li key={c.key} className="px-3 py-2 text-sm space-y-1">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <input type="checkbox" className="mt-1" id={`cand-${c.key}`} checked={!!checked[c.key]}
                    onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))} />
                  <label htmlFor={`cand-${c.key}`} className="font-medium min-w-[12rem] flex-1">{c.label}</label>
                  <span className="font-semibold">{c.options[idx]!.display}</span>
                  {c.current !== null && <Badge className={TONE.warning}>saisi : {c.currentDisplay}</Badge>}
                  {c.conflict && <Badge className={TONE.alert}>les pièces divergent</Badge>}
                </div>
                {c.options.map((o, k) => (
                  <div key={k} className={cn("ml-6 text-xs text-muted-foreground", c.conflict && "flex gap-2 items-start")}>
                    {c.conflict && (
                      <input type="radio" name={`opt-${c.key}`} aria-label={`Retenir ${o.display}`} checked={idx === k}
                        onChange={() => setChoice((s) => ({ ...s, [c.key]: k }))} className="mt-0.5" />
                    )}
                    <div>
                      {c.conflict && <span className="font-medium text-foreground">{o.display} — </span>}
                      {o.sources.map((s, j) => (
                        <span key={j} className="block">
                          {s.docLabel} ({s.fileName}{s.page ? `, p. ${s.page}` : ""}){s.quote ? <> : « <q className="italic">{s.quote}</q> »</> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </li>
            );
          })}
          {authProposals.map((a) => (
            <li key={a.code} className="px-3 py-2 text-sm flex flex-wrap items-center gap-3">
              <input type="checkbox" id={`auth-${a.code}`} checked={!!checked[`auth:${a.code}`]}
                onChange={(e) => setChecked((s) => ({ ...s, [`auth:${a.code}`]: e.target.checked }))} />
              <label htmlFor={`auth-${a.code}`} className="font-medium flex-1">Autorisation obtenue : {a.label}</label>
              <span className="text-xs text-muted-foreground">{a.fileName}{a.obtainedAt ? ` · du ${new Date(a.obtainedAt).toLocaleDateString("fr-FR")}` : ""}</span>
            </li>
          ))}
        </ul>
        <FormMessage error={msg.error} success={msg.success} />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={apply} disabled={pending || selected.length + selectedAuth.length === 0}>
            {pending ? "Report…" : `Reporter ${selected.length + selectedAuth.length} élément${selected.length + selectedAuth.length > 1 ? "s" : ""}`}
          </Button>
          {nReplace > 0 && <span className="text-xs text-amber-700">{nReplace} valeur{nReplace > 1 ? "s" : ""} déjà saisie{nReplace > 1 ? "s" : ""} sera remplacée{nReplace > 1 ? "s" : ""}.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ liste des pièces

function ChecklistCard({ projectId, canWrite, checklist }: { projectId: string; canWrite: boolean; checklist: ChecklistView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) setError(r.error ?? "Action impossible.");
    else router.refresh();
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(checklist.missingText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Copie impossible : sélectionnez le texte ci-dessous.");
      setShowAll(true);
    }
  };
  const piecesFor = (code: string) => checklist.pieces.filter((p) => p.docType === code);
  const others = checklist.pieces.filter((p) => !checklist.groups.some((g) => g.items.some((i) => i.code === p.docType)));
  const pct = checklist.expected ? Math.round((checklist.received / checklist.expected) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pièces du dossier</CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span><strong>{checklist.received}</strong> / {checklist.expected} pièces attendues reçues</span>
          <div className="h-2 w-40 rounded bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Pièces reçues">
            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          {checklist.missingCount > 0
            ? <Badge className={TONE.danger}>{checklist.missingCount} manquante{checklist.missingCount > 1 ? "s" : ""} {checklist.stageLabel}</Badge>
            : <Badge className={TONE.success}>Complet {checklist.stageLabel}</Badge>}
          <Button variant="outline" onClick={copy} className="ml-auto">{copied ? "Liste copiée ✓" : "Copier la liste des pièces manquantes"}</Button>
          <Button variant="ghost" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>{showAll ? "Masquer le texte" : "Voir le texte"}</Button>
        </div>
        {showAll && <pre className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-xs select-all">{checklist.missingText}</pre>}
      </CardHeader>
      <CardContent className="space-y-5">
        <FormMessage error={error} />
        {checklist.groups.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">{g.title}</h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {g.items.map((it) => (
                <li key={it.code} className={cn("px-3 py-2 text-sm", it.state === "manquant" && "bg-red-50/60 dark:bg-red-950/30")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATE_UI[it.state].tone}>{STATE_UI[it.state].label}</Badge>
                    <span className="font-medium">{it.label}</span>
                    {(it.state === "manquant" || it.state === "a_prevoir") && <span className="text-xs text-muted-foreground">{it.when}</span>}
                    {canWrite && (
                      <span className="ml-auto flex gap-1">
                        {it.state !== "recu" && it.state !== "non_applicable" && (
                          <>
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setPieceStatus(projectId, it.code, "RECU", true))}>Reçue (papier)</Button>
                            <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setPieceStatus(projectId, it.code, "NON_APPLICABLE", true))}>Sans objet</Button>
                          </>
                        )}
                        {it.state === "non_applicable" && (
                          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setPieceStatus(projectId, it.code, "NON_APPLICABLE", false))}>Rétablir</Button>
                        )}
                        {it.manualReceived && (
                          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setPieceStatus(projectId, it.code, "RECU", false))}>Annuler « reçue »</Button>
                        )}
                      </span>
                    )}
                  </div>
                  {it.state === "manquant" && <p className="text-xs text-muted-foreground mt-0.5">{it.purpose}</p>}
                  {piecesFor(it.code).map((p) => <PieceRow key={p.id} piece={p} canWrite={canWrite} pending={pending} run={run} />)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {others.length > 0 && (
          <section aria-label="Autres pièces">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Autres pièces reçues</h3>
            <ul className="divide-y divide-border rounded-md border border-border">
              {others.map((p) => <li key={p.id} className="px-3 py-2"><PieceRow piece={p} canWrite={canWrite} pending={pending} run={run} /></li>)}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function PieceRow({ piece: p, canWrite, pending, run }: {
  piece: ChecklistView["pieces"][number];
  canWrite: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm break-all">{p.fileName}</span>
        <Badge className={p.source === "ia" ? TONE.info : TONE.warning}>{p.source === "ia" ? "contenu lu" : "classée d'après le nom"}</Badge>
        {p.values > 0 && <span className="text-muted-foreground">{p.values} donnée{p.values > 1 ? "s" : ""} lue{p.values > 1 ? "s" : ""}</span>}
        <span className="text-muted-foreground">déposée le {new Date(p.createdAt).toLocaleDateString("fr-FR")}</span>
        {canWrite && (
          <span className="ml-auto flex items-center gap-1">
            <Select aria-label={`Type de la pièce ${p.fileName}`} className="h-7 py-0 text-xs w-56" value={p.docType} disabled={pending}
              options={TYPE_OPTIONS} onChange={(e) => run(() => changePieceType(p.id, e.target.value))} />
            <ConfirmButton variant="ghost" className="px-2 py-1 text-xs" title="Retirer cette pièce ?" confirmLabel="Retirer"
              description="La pièce et les valeurs lues sont retirées du dossier ; les valeurs déjà reportées dans la saisie ne changent pas."
              disabled={pending} onConfirm={() => run(() => deleteDossierPiece(p.id))}>Retirer</ConfirmButton>
          </span>
        )}
      </div>
      {(p.title || p.issuer || p.documentDate) && (
        <p className="text-muted-foreground">{[p.title, p.issuer, p.documentDate && `du ${p.documentDate}`].filter(Boolean).join(" · ")}</p>
      )}
      {p.summary && <p>{p.summary}</p>}
      {p.attention.length > 0 && (
        <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300">
          {p.attention.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}
