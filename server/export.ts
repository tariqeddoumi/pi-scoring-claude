// =====================================================================
//  Génération des exports rapport comité (CSV Excel + HTML imprimable PDF).
//  Sans dépendance lourde : CSV ouvrable dans Excel, HTML imprimable en PDF
//  via le navigateur (Ctrl+P → Enregistrer en PDF).
//  Le dossier de comité consolide toutes les dimensions de risque : décision,
//  classification BKAM, métriques Bâle/IFRS 9, double provisionnement, GFA/VEFA,
//  EAD réel (facilités), groupe d'intérêt, circuit et décision de comité.
// =====================================================================

import { prisma } from "@/lib/prisma";
import { CLASS_LABELS, DECISION_LABELS } from "@/lib/labels";
import { formatMAD, formatDate } from "@/lib/utils";
import { getActiveCalibration, getGroups } from "@/server/queries";
import { computeRiskMetrics, SLOTTING_LABELS } from "@/lib/domain/riskMetrics";
import { computeEcl } from "@/lib/domain/ifrs9";
import { projectEad, facilityEad, scheduleDpd, totalOverdue } from "@/lib/domain/facility";
import { computeGfaRelief } from "@/lib/domain/gfaVefa";
import { WORKFLOW_LABELS, COMMITTEE_OUTCOME_LABELS, type WorkflowStateName, type CommitteeOutcomeName } from "@/lib/workflow";
import { buildCommitteeWorkbook, type CommitteeData, type WorkbookSheet } from "@/lib/domain/committeeWorkbook";
import type { RegulatoryClassCode } from "@/lib/domain/types";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: (string | number | null)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\n");
}

const esc = (v: unknown): string =>
  v == null ? "" : String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)} %`;

export async function portfolioCsv(): Promise<string> {
  const calib = await getActiveCalibration();
  const projects = await prisma.realEstateProject.findMany({
    include: {
      promoter: true,
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      facilities: { select: { authorizedAmount: true, drawnAmount: true, ccf: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows: (string | number | null)[][] = [[
    "Référence", "Projet", "Promoteur", "Ville", "Segment", "Crédit autorisé (MAD)",
    "EAD réel (MAD)", "Score final", "Décision", "Classe BKAM", "Provision BKAM (MAD)",
    "Slotting", "Stage IFRS 9", "PD", "LGD", "Perte attendue EL (MAD)", "ECL IFRS 9 (MAD)",
  ]];
  for (const p of projects) {
    const r = p.scoringRuns[0];
    const c = p.classificationRuns[0];
    const prov = p.provisionRuns[0];
    const ead = prov?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead;
    const m = computeRiskMetrics({ score: r?.scoreFinal ?? null, cls: (c?.resultClass ?? null) as RegulatoryClassCode | null, ead, eligibleGuarantees: prov?.eligibleGuarantees ?? 0 }, calib);
    const ecl = computeEcl({ stage: m.stage, pd12m: m.pd, lgd: m.lgd, ead: m.ead, maturityYears: calib.maturityYears });
    rows.push([
      p.reference, p.name, p.promoter.name, p.city ?? "", p.segment ?? "",
      p.loanAmount ?? 0, m.ead,
      r?.scoreFinal ?? "", r?.decision ?? "", c?.resultClass ?? "",
      prov?.provisionAmount ?? 0,
      SLOTTING_LABELS[m.slotting], m.stage, m.pd, m.lgd, m.expectedLoss, ecl.ecl,
    ]);
  }
  return toCsv(rows);
}

const DOC_CSS = `
 body{font-family:system-ui,Arial,sans-serif;color:#0f172a;max-width:840px;margin:24px auto;padding:0 16px}
 h1{font-size:22px;margin:0} h2{font-size:15px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:24px}
 .muted{color:#64748b;font-size:13px} table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
 td,th{border:1px solid #e2e8f0;padding:6px 8px;text-align:left} .big{font-size:28px;font-weight:700}
 .pill{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
 .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:8px} .kpi .l{font-size:11px;color:#64748b} .kpi .v{font-size:16px;font-weight:700}
 .right{text-align:right} @media print{button{display:none}}
`;

/** Dossier de comité consolidé d'un projet, HTML imprimable en PDF. */
export async function projectReportHtml(projectId: string): Promise<string | null> {
  const [calib, p] = await Promise.all([
    getActiveCalibration(),
    prisma.realEstateProject.findUnique({
      where: { id: projectId },
      include: {
        promoter: true,
        group: true,
        facilities: { include: { installments: { orderBy: { seq: "asc" } } }, orderBy: { createdAt: "asc" } },
        committeeDecisions: { include: { chair: true }, orderBy: { createdAt: "desc" } },
        workflowSteps: { include: { actor: true }, orderBy: { createdAt: "desc" } },
        scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { domainResults: { include: { domain: true } } } },
        classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { regime: true } },
        provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);
  if (!p) return null;
  const run = p.scoringRuns[0];
  const cls = p.classificationRuns[0];
  const prov = p.provisionRuns[0];

  const ead = prov?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead;
  const eligible = prov?.eligibleGuarantees ?? 0;
  const m = computeRiskMetrics({ score: run?.scoreFinal ?? null, cls: (cls?.resultClass ?? null) as RegulatoryClassCode | null, ead, eligibleGuarantees: eligible }, calib);
  const ecl = computeEcl({ stage: m.stage, pd12m: m.pd, lgd: m.lgd, ead: m.ead, maturityYears: calib.maturityYears });
  const gfa = computeGfaRelief({ saleMode: p.saleMode, hasGFA: p.hasGFA, gfaAmount: p.gfaAmount, exposure: ead });

  const domainRows = (run?.domainResults ?? [])
    .map((d) => `<tr><td>${esc(d.domain.code)} — ${esc(d.domain.name)}</td><td class="right">${d.score.toFixed(0)}/100</td></tr>`).join("");
  const flags = ((run?.triggeredRedFlags as any[]) ?? [])
    .map((f) => `<li>${esc(f.name)}${f.malus ? ` (−${f.malus})` : ""}</li>`).join("");

  // Facilités & EAD réel
  const asOf = new Date();
  const facBlock = p.facilities.length === 0 ? "" : (() => {
    const allInst = p.facilities.flatMap((f) => f.installments);
    const dpd = scheduleDpd(allInst, asOf);
    const overdue = totalOverdue(allInst, asOf);
    const lines = p.facilities.map((f) => {
      const fd = scheduleDpd(f.installments, asOf);
      return `<tr><td>${esc(f.label)}</td><td class="right">${formatMAD(f.drawnAmount)} / ${formatMAD(f.authorizedAmount)}</td><td class="right">${Math.round(f.ccf * 100)} %</td><td class="right">${formatMAD(facilityEad(f))}</td><td class="right">${fd > 0 ? fd + " j" : "—"}</td></tr>`;
    }).join("");
    return `<h2>Facilités & EAD réel</h2>
<p class="muted">EAD réel ${formatMAD(ead)} · DPD max ${dpd} j · impayé échu ${formatMAD(overdue)}</p>
<table><thead><tr><th>Tranche</th><th class="right">Tiré / autorisé</th><th class="right">CCF</th><th class="right">EAD</th><th class="right">DPD</th></tr></thead><tbody>${lines}</tbody></table>`;
  })();

  // Groupe d'intérêt
  const groupBlock = !p.group ? "" : `<h2>Groupe d'intérêt</h2>
<p>${esc(p.group.name)}${p.group.sector ? ` · ${esc(p.group.sector)}` : ""}
${cls?.groupContagionClass ? `<br>Contagion groupe : <span class="pill">${CLASS_LABELS[cls.groupContagionClass as RegulatoryClassCode]}</span>` : ""}</p>`;

  // GFA / VEFA
  const gfaBlock = `<h2>Commercialisation & GFA</h2>
<p>Nature : <span class="pill">${p.assetType === "EXPLOITATION" ? "Actif d'exploitation" : "Promotion"}</span>
· Mode : <span class="pill">${p.saleMode === "VEFA" ? "VEFA (sur plan)" : "Vente classique"}</span>
· GFA : ${p.hasGFA ? `oui (${formatMAD(p.gfaAmount)}${p.gfaProvider ? `, ${esc(p.gfaProvider)}` : ""})` : "non"}
${gfa.applicable ? `<br>Effet sur l'assiette : −${formatMAD(gfa.admittedValue)} (${esc(gfa.note)})` : ""}</p>`;

  // Décision de comité + circuit
  const cd = p.committeeDecisions[0];
  const committeeBlock = !cd ? "" : `<h2>Décision de comité</h2>
<p><span class="pill">${COMMITTEE_OUTCOME_LABELS[cd.outcome as CommitteeOutcomeName]}</span>
· Président : ${esc(cd.chair.name)} · ${formatDate(cd.createdAt)}<br>
Quorum ${cd.presentCount}/${cd.quorum} · Pour ${cd.votesFor} / Contre ${cd.votesAgainst} / Abst. ${cd.votesAbstain}
${cd.approvedAmount != null ? `<br>Montant approuvé : ${formatMAD(cd.approvedAmount)}` : ""}
${cd.conditions ? `<br>Conditions : ${esc(cd.conditions)}` : ""}
${cd.validUntil ? `<br>Validité jusqu'au ${formatDate(cd.validUntil)}` : ""}
${cd.minutesRef ? `<br>PV : ${esc(cd.minutesRef)}` : ""}</p>`;

  const wfRows = p.workflowSteps.slice(0, 8).map((s) =>
    `<tr><td>${formatDate(s.createdAt)}</td><td>${s.fromState ? WORKFLOW_LABELS[s.fromState as WorkflowStateName] : "—"} → ${WORKFLOW_LABELS[s.toState as WorkflowStateName]}</td><td>${esc(s.actor?.name ?? "—")}</td></tr>`).join("");
  const wfBlock = p.workflowSteps.length === 0 ? "" : `<h2>Circuit de décision</h2>
<table><thead><tr><th>Date</th><th>Transition</th><th>Acteur</th></tr></thead><tbody>${wfRows}</tbody></table>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Dossier comité — ${esc(p.reference)}</title><style>${DOC_CSS}</style></head><body>
<h1>Dossier de comité — Promotion immobilière</h1>
<p class="muted">${esc(p.name)} · ${esc(p.reference)} · ${esc(p.promoter.name)} · ${esc(p.city ?? "")}</p>
<button onclick="print()">Imprimer / Enregistrer en PDF</button>

<h2>Synthèse de décision</h2>
<p><span class="big">${run?.scoreFinal?.toFixed(0) ?? "—"}</span> / 100 —
<span class="pill">${run?.decision ? DECISION_LABELS[run.decision] : "Non scoré"}</span>
· Classe BKAM <span class="pill">${cls ? CLASS_LABELS[cls.resultClass] : "—"}</span>${cls?.isWatchList ? " · Watch List" : ""}</p>

<h2>Métriques de risque — Bâle / IFRS 9</h2>
<p class="muted">Calibrage : ${esc(calib.label)} — paramètres indicatifs à calibrer.</p>
<div class="grid">
 <div class="kpi"><div class="l">Slotting</div><div class="v">${SLOTTING_LABELS[m.slotting]}</div></div>
 <div class="kpi"><div class="l">Stage IFRS 9</div><div class="v">Stage ${m.stage}</div></div>
 <div class="kpi"><div class="l">EAD</div><div class="v">${formatMAD(m.ead)}</div></div>
 <div class="kpi"><div class="l">PD</div><div class="v">${pct(m.pd, 2)}</div></div>
 <div class="kpi"><div class="l">LGD</div><div class="v">${pct(m.lgd, 1)}</div></div>
 <div class="kpi"><div class="l">Perte attendue (EL)</div><div class="v">${formatMAD(m.expectedLoss)}</div></div>
</div>
<table><tbody>
<tr><td>ECL IFRS 9 (${ecl.horizon === "12M" ? "12 mois" : "lifetime"})</td><td class="right">${formatMAD(ecl.ecl)}</td></tr>
<tr><td>Provision prudentielle BKAM</td><td class="right">${formatMAD(prov?.provisionAmount)}</td></tr>
<tr><td>RWA</td><td class="right">${formatMAD(m.rwa)} (pondération ${Math.round(m.riskWeight * 100)} %)</td></tr>
</tbody></table>

${gfaBlock}
${facBlock}
${groupBlock}

<h2>Scores par domaine</h2>
<table><tbody>${domainRows || '<tr><td colspan="2" class="muted">Aucun run.</td></tr>'}</tbody></table>

<h2>Classification BKAM</h2>
<p>Régime : ${esc(cls?.regime.name ?? "—")}<br>
Classe : <span class="pill">${cls ? CLASS_LABELS[cls.resultClass] : "—"}</span>
${cls?.restructuringNote ? `<br>Restructuration : ${esc(cls.restructuringNote)}` : ""}</p>

<h2>Provisionnement BKAM</h2>
<table><tbody>
<tr><td>EAD</td><td class="right">${formatMAD(prov?.ead)}</td></tr>
<tr><td>Garanties éligibles</td><td class="right">${formatMAD(prov?.eligibleGuarantees)}</td></tr>
<tr><td>Base provisionnable</td><td class="right">${formatMAD(prov?.provisionBase)}</td></tr>
<tr><td>Taux</td><td class="right">${prov ? (prov.rate * 100).toFixed(0) + " %" : "—"}</td></tr>
<tr><td><b>Provision</b></td><td class="right"><b>${formatMAD(prov?.provisionAmount)}</b></td></tr>
</tbody></table>

<h2>Red flags D5</h2>
<ul>${flags || '<li class="muted">Aucun</li>'}</ul>

${committeeBlock}
${wfBlock}

<p class="muted">Document généré automatiquement — normes minimales BKAM + lecture Bâle/IFRS 9 indicative, à valider en comité.</p>
</body></html>`;
}

/**
 * Dossier de comité DÉTAILLÉ d'un projet sous forme de feuilles Excel (AoA) :
 * synthèse + risque, scoring critère par critère, classification 1/W (avec
 * déclencheurs et qualité des données) et provisionnement (avec garanties).
 * Renvoie null si le projet est introuvable.
 */
export async function committeeWorkbookSheets(projectId: string): Promise<WorkbookSheet[] | null> {
  const [calib, p] = await Promise.all([
    getActiveCalibration(),
    prisma.realEstateProject.findUnique({
      where: { id: projectId },
      include: {
        promoter: true,
        facilities: { select: { authorizedAmount: true, drawnAmount: true, ccf: true } },
        scoringRuns: {
          orderBy: { createdAt: "desc" }, take: 1,
          include: {
            domainResults: { include: { domain: true } },
            criterionResults: { include: { criterion: { include: { domain: true } } } },
          },
        },
        classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { regime: true } },
        provisionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);
  if (!p) return null;

  const run = p.scoringRuns[0];
  const cls = p.classificationRuns[0];
  const prov = p.provisionRuns[0];
  const ead = prov?.ead ?? projectEad(p.facilities, p.loanAmount ?? 0).ead;
  const m = computeRiskMetrics(
    { score: run?.scoreFinal ?? null, cls: (cls?.resultClass ?? null) as RegulatoryClassCode | null, ead, eligibleGuarantees: prov?.eligibleGuarantees ?? 0 },
    calib,
  );
  const ecl = computeEcl({ stage: m.stage, pd12m: m.pd, lgd: m.lgd, ead: m.ead, maturityYears: calib.maturityYears });

  const data: CommitteeData = {
    project: {
      reference: p.reference, name: p.name, promoter: p.promoter.name,
      city: p.city, segment: p.segment, nature: p.assetType === "EXPLOITATION" ? "Exploitation" : "Promotion",
    },
    score: run?.scoreFinal ?? null,
    decision: run?.decision ? DECISION_LABELS[run.decision] : null,
    regulatory: {
      className: cls ? CLASS_LABELS[cls.resultClass] : "—",
      regimeName: cls?.regime.name ?? "—",
      isWatchList: cls?.isWatchList ?? false,
      restructuringNote: cls?.restructuringNote ?? null,
      dataQualityStatus: cls?.dataQualityStatus ?? null,
      missingCriticalData: Array.isArray(cls?.missingCriticalData) ? (cls!.missingCriticalData as string[]) : [],
      triggers: ((cls?.triggeredBy as any[]) ?? []).map((t) => ({ kind: String(t.kind ?? ""), targetClass: String(t.targetClass ?? ""), reason: String(t.reason ?? "") })),
    },
    metrics: {
      ead: m.ead, slotting: SLOTTING_LABELS[m.slotting], stage: m.stage, pd: m.pd, lgd: m.lgd,
      expectedLoss: m.expectedLoss, ecl: ecl.ecl, rwa: m.rwa, riskWeight: m.riskWeight,
    },
    provision: prov
      ? {
          ead: prov.ead, reservedAgios: prov.reservedAgios, eligibleGuarantees: prov.eligibleGuarantees,
          provisionBase: prov.provisionBase, rate: prov.rate, provisionAmount: prov.provisionAmount, isIrregular: prov.isIrregular,
          breakdown: ((prov.guaranteeBreakdown as any[]) ?? []).map((b) => ({
            typeCode: String(b.typeCode ?? ""), marketValue: Number(b.marketValue ?? 0),
            effectiveQuotity: Number(b.effectiveQuotity ?? 0), eligibleValue: Number(b.eligibleValue ?? 0),
          })),
        }
      : null,
    domains: (run?.domainResults ?? []).map((d) => ({ code: d.domain.code, name: d.domain.name, score: d.score })),
    criteria: (run?.criterionResults ?? []).map((c) => ({
      domainCode: c.criterion.domain.code, code: c.criterion.code, name: c.criterion.name,
      rawValue: c.rawValue, score: c.score, weighted: c.weighted, matchedRef: c.matchedRef, gateBlocked: c.gateBlocked,
    })),
    redFlags: ((run?.triggeredRedFlags as any[]) ?? []).map((f) => ({ name: String(f.name ?? ""), malus: Number(f.malus ?? 0) })),
  };

  return buildCommitteeWorkbook(data);
}

/** Dossier de comité consolidé d'un programme / groupe d'intérêt. */
export async function groupReportHtml(groupId: string): Promise<string | null> {
  const groups = await getGroups();
  const g = groups.find((x) => x.id === groupId);
  if (!g) return null;
  const c = g.consolidation;

  const memberRows = g.members.map((mem) => {
    const operated = mem.assetType === "EXPLOITATION";
    return `<tr><td>${esc(mem.reference)}</td><td>${esc(mem.name)}</td><td>${operated ? "Exploitation" : "Promotion"}</td><td>${mem.cls ? CLASS_LABELS[mem.cls] : "—"}</td><td class="right">${operated ? "hors note" : (mem.scoreFinal != null ? mem.scoreFinal + "/100" : "—")}</td><td class="right">${formatMAD(mem.exposure)}</td></tr>`;
  }).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Dossier comité — programme ${esc(g.name)}</title><style>${DOC_CSS}</style></head><body>
<h1>Dossier de comité — Programme / groupe d'intérêt</h1>
<p class="muted">${esc(g.name)}${g.sector ? ` · ${esc(g.sector)}` : ""}</p>
<button onclick="print()">Imprimer / Enregistrer en PDF</button>

<h2>Synthèse consolidée</h2>
<div class="grid">
 <div class="kpi"><div class="l">Note consolidée (promotion)</div><div class="v">${c.weightedScore != null ? c.weightedScore + "/100" : "—"}</div></div>
 <div class="kpi"><div class="l">Exposition totale</div><div class="v">${formatMAD(c.totalExposure)}</div></div>
 <div class="kpi"><div class="l">Classe la plus sévère</div><div class="v">${g.severeClass ? CLASS_LABELS[g.severeClass] : "—"}</div></div>
</div>
${c.operationalExposure > 0 ? `<p class="muted">Dont ${formatMAD(c.operationalExposure)} d'actif(s) d'exploitation (${c.operationalComponents}) exclu(s) de la note (modèle promotion inadapté), mais comptés dans l'exposition et le risque consolidés.</p>` : ""}

<h2>Composantes (${g.members.length})</h2>
<table><thead><tr><th>Référence</th><th>Projet</th><th>Nature</th><th>Classe</th><th class="right">Score</th><th class="right">Exposition</th></tr></thead>
<tbody>${memberRows}</tbody></table>

<p class="muted">Effet de contagion BKAM (19/G art.33 · 1/W art.50) : la classe la plus sévère d'un membre se propage aux entités liées lors du prochain calcul. Document généré automatiquement, à valider en comité.</p>
</body></html>`;
}
