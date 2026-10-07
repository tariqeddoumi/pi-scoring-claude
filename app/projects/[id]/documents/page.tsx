import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DbSetupNotice, safe } from "@/lib/dbGuard";
import { currentUserCan } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { ProjectSubnav } from "@/components/ProjectSubnav";
import { DossierDocumentsPanel, type ReviewCandidate, type AuthProposal, type ChecklistView } from "@/components/DossierDocumentsPanel";
import { WIZARD_STEPS, EXPLOITATION_WIZARD_STEPS, type FieldDef } from "@/lib/wizardFields";
import { INPUT_LABELS, fmtInput } from "@/lib/inputLabels";
import {
  DOC_CATEGORY_LABELS, DOSSIER_DOC_DEFS, STAGE_LABELS, buildChecklist, dossierStage, formatMissingList, mergeExtractions,
  type DocumentExtraction, type ExtractedField, type PieceRecord,
} from "@/lib/domain/dossierDocuments";
import { AUTHORIZATION_CHAIN, type ProgramKind } from "@/lib/domain/morocco";
import { PROJECT_FIELDS, isDocumentAiConfigured } from "@/server/services/claudeDocumentReader";
import { formatMAD, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
// Lecture d'une pièce par l'IA : jusqu'à quelques minutes pour un long PDF.
export const maxDuration = 300;

type V = number | boolean | string;

export default async function DossierDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await safe(() => prisma.realEstateProject.findUnique({
    where: { id },
    select: {
      id: true, reference: true, name: true, programKind: true, assetType: true,
      inputs: { select: { key: true, valueNum: true, valueStr: true, valueBool: true } },
      workflowSteps: { orderBy: { createdAt: "desc" }, take: 1, select: { toState: true } },
      facilities: { select: { drawnAmount: true } },
      authorizations: { select: { code: true, obtained: true } },
      ...Object.fromEntries(PROJECT_FIELDS.map((f) => [f.key, true])),
    },
  }));
  if (!res.ok) return <DbSetupNotice error={res.error} />;
  const p = res.data as (NonNullable<typeof res.data> & Record<string, unknown>) | null;
  if (!p) return notFound();

  // Table absente (migration non appliquée) : l'écran reste utilisable en lecture.
  const piecesRes = await safe(() => prisma.dossierPiece.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } }));
  const pieces = piecesRes.ok ? piecesRes.data : [];
  const canWrite = await currentUserCan(PERMISSIONS.PROJECT_WRITE).catch(() => false);

  const programKind = (p.programKind ?? "CONSTRUCTION") as ProgramKind;
  const stage = dossierStage(p.workflowSteps[0]?.toState ?? "DRAFT", p.facilities.reduce((s, f) => s + f.drawnAmount, 0));
  const records: PieceRecord[] = pieces.map((x) => ({ id: x.id, docType: x.docType, status: x.status as PieceRecord["status"], fileName: x.fileName, source: x.source, createdAt: x.createdAt }));
  const checklist = buildChecklist(records, { programKind, stage });
  const missingText = formatMissingList(checklist, { reference: p.reference, name: p.name });

  // Valeurs actuelles : saisie de scoring et fiche projet.
  const fields: FieldDef[] = (p.assetType === "EXPLOITATION" ? EXPLOITATION_WIZARD_STEPS : WIZARD_STEPS).flatMap((s) => s.fields);
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const current: Record<string, V | null> = {};
  for (const i of p.inputs) current[i.key] = i.valueNum ?? (i.valueStr === "" ? null : i.valueStr) ?? i.valueBool ?? null;
  for (const f of PROJECT_FIELDS) {
    const v = p[f.key];
    current[f.key] = v instanceof Date ? v.toISOString().slice(0, 10) : (v as V | null | undefined) ?? null;
  }

  const label = (key: string) => PROJECT_FIELDS.find((f) => f.key === key)?.label ?? fieldByKey.get(key)?.label ?? INPUT_LABELS[key] ?? key;
  const display = (key: string, v: V | null): string => {
    if (v === null) return "—";
    const pf = PROJECT_FIELDS.find((f) => f.key === key);
    if (pf?.type === "money" && typeof v === "number") return formatMAD(v);
    if (pf?.type === "date" && typeof v === "string") return new Date(v).toLocaleDateString("fr-FR");
    if ((pf?.type === "number" || pf?.type === "integer") && typeof v === "number") return formatNumber(v);
    const opt = fieldByKey.get(key)?.options?.find((o) => o.value === v);
    return opt ? opt.label : fmtInput(v);
  };

  const received = pieces.filter((x) => x.status === "RECU");
  const extractions: DocumentExtraction[] = received
    .filter((x) => Array.isArray(x.extracted) && x.extracted.length > 0)
    .map((x) => ({ fileName: x.fileName ?? "pièce", docType: x.docType, fields: x.extracted as unknown as ExtractedField[] }));
  const order = [...fields.map((f) => f.key), ...PROJECT_FIELDS.map((f) => f.key)];
  const candidates: ReviewCandidate[] = mergeExtractions(extractions, current, order)
    .filter((c) => !c.unchanged)
    .map((c) => ({
      key: c.key, label: label(c.key), conflict: c.conflict,
      current: c.current, currentDisplay: display(c.key, c.current),
      options: c.options.map((o) => ({
        value: o.value, display: display(c.key, o.value),
        sources: o.sources.map((s) => ({ fileName: s.fileName, docLabel: s.docType ? DOSSIER_DOC_DEFS.get(s.docType)?.label ?? "Autre pièce" : "Autre pièce", page: s.page, quote: s.quote })),
      })),
    }));

  // Autorisations dont la pièce est au dossier mais qui ne sont pas marquées obtenues.
  const obtained = new Set(p.authorizations.filter((a) => a.obtained).map((a) => a.code));
  const authProposals: AuthProposal[] = [];
  for (const a of AUTHORIZATION_CHAIN) {
    if (obtained.has(a.code) || !a.appliesTo.includes(programKind)) continue;
    const piece = received.find((x) => x.docType === a.code && x.source !== "manuel");
    if (!piece) continue;
    const date = piece.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(piece.documentDate) ? piece.documentDate : null;
    authProposals.push({ code: a.code, label: a.label, fileName: piece.fileName ?? "", obtainedAt: date });
  }

  const view: ChecklistView = {
    stageLabel: STAGE_LABELS[stage],
    received: checklist.received,
    expected: checklist.expected,
    missingCount: checklist.missingNow.length,
    missingText,
    groups: Object.entries(DOC_CATEGORY_LABELS).map(([cat, title]) => ({
      title,
      items: checklist.items.filter((i) => i.def.category === cat).map((i) => ({
        code: i.def.code, label: i.def.label, purpose: i.def.purpose, state: i.state,
        when: i.def.atDelivery ? "à la livraison" : STAGE_LABELS[i.def.stage],
        manualReceived: i.pieces.some((x) => x.source === "manuel" && x.status === "RECU"),
        files: i.pieces.filter((x) => x.status === "RECU" && x.source !== "manuel").length,
      })),
    })).filter((g) => g.items.length > 0),
    pieces: pieces.filter((x) => x.status === "RECU" && x.source !== "manuel").map((x) => ({
      id: x.id, docType: x.docType, fileName: x.fileName ?? "", source: x.source,
      title: x.title, issuer: x.issuer, documentDate: x.documentDate, summary: x.summary,
      attention: Array.isArray(x.attention) ? (x.attention as string[]) : [],
      values: Array.isArray(x.extracted) ? x.extracted.length : 0,
      createdAt: x.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:underline">← {p.name}</Link>
        <h1 className="text-2xl font-bold">Documents du dossier</h1>
        <p className="text-sm text-muted-foreground">
          Déposez les pièces reçues du client : elles sont lues, classées, les données utiles sont proposées pour la saisie
          et la liste des pièces manquantes se met à jour. Les fichiers ne sont pas conservés.
        </p>
      </div>
      <ProjectSubnav projectId={p.id} active="documents" />
      {!piecesRes.ok && <DbSetupNotice error={piecesRes.error} />}
      <DossierDocumentsPanel
        projectId={p.id}
        canWrite={canWrite && piecesRes.ok}
        aiConfigured={isDocumentAiConfigured()}
        candidates={candidates}
        authProposals={authProposals}
        checklist={view}
      />
    </div>
  );
}
