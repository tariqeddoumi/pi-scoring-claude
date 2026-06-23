// =====================================================================
//  Génération des exports rapport comité (CSV Excel + HTML imprimable PDF).
//  Sans dépendance lourde : CSV ouvrable dans Excel, HTML imprimable en PDF
//  via le navigateur (Ctrl+P → Enregistrer en PDF).
// =====================================================================

import { prisma } from "@/lib/prisma";
import { CLASS_LABELS, DECISION_LABELS } from "@/lib/labels";
import { formatMAD } from "@/lib/utils";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: (string | number | null)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\n");
}

export async function portfolioCsv(): Promise<string> {
  const projects = await prisma.realEstateProject.findMany({
    include: {
      promoter: true,
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows: (string | number | null)[][] = [[
    "Référence", "Projet", "Promoteur", "Ville", "Segment", "Crédit (MAD)",
    "Score final", "Décision", "Classe BKAM", "Provision (MAD)",
  ]];
  for (const p of projects) {
    const r = p.scoringRuns[0];
    const c = p.classificationRuns[0];
    rows.push([
      p.reference, p.name, p.promoter.name, p.city ?? "", p.segment ?? "",
      p.loanAmount ?? 0,
      r?.scoreFinal ?? "", r?.decision ?? "", c?.resultClass ?? "",
      p.provisionRuns[0]?.provisionAmount ?? 0,
    ]);
  }
  return toCsv(rows);
}

/** Rapport comité d'un projet, HTML imprimable en PDF. */
export async function projectReportHtml(projectId: string): Promise<string | null> {
  const p = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    include: {
      promoter: true,
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { domainResults: { include: { domain: true } } } },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { regime: true } },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!p) return null;
  const run = p.scoringRuns[0];
  const cls = p.classificationRuns[0];
  const prov = p.provisionRuns[0];

  const domainRows = (run?.domainResults ?? [])
    .map((d) => `<tr><td>${d.domain.code} — ${d.domain.name}</td><td>${d.score.toFixed(0)}/100</td></tr>`)
    .join("");
  const flags = ((run?.triggeredRedFlags as any[]) ?? [])
    .map((f) => `<li>${f.name}${f.malus ? ` (−${f.malus})` : ""}</li>`).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Rapport comité — ${p.reference}</title>
<style>
 body{font-family:system-ui,Arial,sans-serif;color:#0f172a;max-width:800px;margin:24px auto;padding:0 16px}
 h1{font-size:22px;margin:0} h2{font-size:15px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:24px}
 .muted{color:#64748b;font-size:13px} table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
 td,th{border:1px solid #e2e8f0;padding:6px 8px;text-align:left} .big{font-size:28px;font-weight:700}
 .pill{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
 @media print{button{display:none}}
</style></head><body>
<h1>Rapport de comité — Promotion immobilière</h1>
<p class="muted">${p.name} · ${p.reference} · ${p.promoter.name} · ${p.city ?? ""}</p>
<button onclick="print()">Imprimer / Enregistrer en PDF</button>

<h2>Décision</h2>
<p><span class="big">${run?.scoreFinal?.toFixed(0) ?? "—"}</span> / 100 —
<span class="pill">${run?.decision ? DECISION_LABELS[run.decision] : "Non scoré"}</span></p>

<h2>Scores par domaine</h2>
<table><tbody>${domainRows || '<tr><td colspan="2" class="muted">Aucun run.</td></tr>'}</tbody></table>

<h2>Classification BKAM</h2>
<p>Régime : ${cls?.regime.name ?? "—"}<br>
Classe : <span class="pill">${cls ? CLASS_LABELS[cls.resultClass] : "—"}</span>
${cls?.isWatchList ? " · Watch List" : ""}
${cls?.restructuringNote ? `<br>Restructuration : ${cls.restructuringNote}` : ""}</p>

<h2>Provisionnement</h2>
<table><tbody>
<tr><td>EAD</td><td>${formatMAD(prov?.ead)}</td></tr>
<tr><td>Agios réservés</td><td>${formatMAD(prov?.reservedAgios)}</td></tr>
<tr><td>Garanties éligibles</td><td>${formatMAD(prov?.eligibleGuarantees)}</td></tr>
<tr><td>Base provisionnable</td><td>${formatMAD(prov?.provisionBase)}</td></tr>
<tr><td>Taux</td><td>${prov ? (prov.rate * 100).toFixed(0) + " %" : "—"}</td></tr>
<tr><td><b>Provision</b></td><td><b>${formatMAD(prov?.provisionAmount)}</b></td></tr>
</tbody></table>

<h2>Red flags D5</h2>
<ul>${flags || '<li class="muted">Aucun</li>'}</ul>

<p class="muted">Document généré automatiquement — normes minimales BKAM, à valider en comité.</p>
</body></html>`;
}
