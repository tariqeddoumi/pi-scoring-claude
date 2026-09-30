// Génère le document « Grilles de scoring détaillées » depuis l'instantané du
// modèle publié (prisma/models/PI_PROMOTION_v4.0.0.json) : aucune valeur n'est
// recopiée à la main. Usage (racine du dépôt) : node docs/_sources/gen_grilles_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, PageBreak, TableOfContents, PageNumber, Footer, Header, LevelFormat,
} = require("docx");
const M = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "prisma", "models", "PI_PROMOTION_v4.0.0.json"), "utf8"));
const GD = JSON.parse(fs.readFileSync(path.join(__dirname, "guide_data.json"), "utf8"));
const VEC = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "tools", "excel", "_build", "vectors.json"), "utf8"));
const OUT = path.join(__dirname, "..", "Grilles_Scoring_PI_PROMOTION_v4.docx");

const NAVY = "1F3864", BLUE = "2E5496", LIGHT = "D9E1F2", ZEBRA = "F2F5FB", GREY = "595959", CRIT = "C00000", WARN = "B45F06", OKG = "2E7D32";
const LVL = { crit: { t: "Critique", c: CRIT, bg: "FBE4E1" }, vig: { t: "Vigilance", c: WARN, bg: "FFF1DC" }, fav: { t: "Favorable", c: OKG, bg: "E4F2E5" } };
const level = (s) => (s <= 3 ? LVL.crit : s <= 7 ? LVL.vig : LVL.fav);
const fr = (n) => String(n).replace(".", ",").replace("-", "−");
const pct = (x) => `${Math.round(x * 1000) / 10}`.replace(".", ",") + " %";
const T = (t, o = {}) => new TextRun({ text: t, size: o.size ?? 21, bold: o.bold, italics: o.italics, color: o.color, font: "Calibri" });
const P = (x, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 276 }, alignment: o.align, keepNext: o.keepNext, children: Array.isArray(x) ? x : [T(x, o)] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: t })] });
const bullet = (r) => new Paragraph({ numbering: { reference: "puces", level: 0 }, spacing: { after: 60, line: 276 }, children: Array.isArray(r) ? r : [T(r)] });
const brk = () => new Paragraph({ children: [new PageBreak()] });

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: "AEB6C6" };
const cell = (c, o) => new TableCell({
  width: { size: o.w, type: WidthType.DXA }, rowSpan: o.rowSpan, columnSpan: o.span, verticalAlign: o.v,
  shading: o.bg ? { type: ShadingType.CLEAR, fill: o.bg, color: "auto" } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 },
  children: (Array.isArray(c) ? c : [c]).map((line) => new Paragraph({ alignment: o.align, spacing: { after: 0, line: 240 },
    children: Array.isArray(line) ? line : [new TextRun({ text: String(line ?? ""), bold: o.bold, color: o.color, size: o.size ?? 18, font: "Calibri" })] })),
});
function table(head, rows, w) {
  const trs = [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, { w: w[i], bg: BLUE, bold: true, color: "FFFFFF" })) })];
  rows.forEach((r) => trs.push(new TableRow({ cantSplit: true, children: r })));
  return new Table({ columnWidths: w, width: { size: w.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: trs,
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D6E2" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D0D6E2" } } });
}
const box = (titre, texte, color = BLUE, fill = "EEF3FB") => new Table({ columnWidths: [9638], width: { size: 9638, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color }, bottom: { style: BorderStyle.SINGLE, size: 4, color }, left: { style: BorderStyle.SINGLE, size: 4, color }, right: { style: BorderStyle.SINGLE, size: 4, color }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: 9638, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill, color: "auto" }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [new Paragraph({ spacing: { after: 40 }, children: [T(titre, { bold: true, color })] }), new Paragraph({ spacing: { after: 0, line: 276 }, children: [T(texte)] })] })] })] });

// ------------------------------------------------------------ données du modèle
const domains = [...M.domains].sort((a, b) => a.orderIndex - b.orderIndex);
const allCrit = domains.flatMap((d) => d.criteria.map((c) => ({ ...c, dom: d })));
const CRIT_KEYS = new Set(GD.criticalKeys);
const labelOf = (key) => { const c = GD.domains.flatMap((d) => d.criteria).find((x) => x.key === key); return c ? c.label : (GD.alerts.find((a) => a.key === key) || {}).label || key; };
const stripQ = (l) => (l || "").replace(/ \((critique|vigilance|favorable)\)/, "");
const bound = (v, kind) => (v === null || v === undefined ? "—" : fr(v));

// notation d'un critère (reproduit le moteur : borne basse incluse, haute exclue)
function noteOf(c, v) {
  if (v === undefined || v === null || v === "") return { note: Math.min(...[...c.options, ...c.ranges].map((x) => x.score)), floor: true };
  if (c.type === "QUAL") { const o = c.options.find((x) => x.value === v); return { note: o ? o.score : Math.min(...c.options.map((x) => x.score)), floor: !o }; }
  const r = c.ranges.find((x) => (x.minIncl === null || v >= x.minIncl) && (x.maxExcl === null || v < x.maxExcl));
  return { note: r.score, floor: false };
}

// ------------------------------------------------------------ contenu
const cover = [
  new Paragraph({ spacing: { before: 2000 }, alignment: AlignmentType.CENTER, children: [T("GRILLES DE SCORING DÉTAILLÉES", { bold: true, size: 46, color: NAVY })] }),
  new Paragraph({ spacing: { before: 80 }, alignment: AlignmentType.CENTER, children: [T(`Modèle PI_PROMOTION ${M.version}`, { bold: true, size: 32, color: BLUE })] }),
  new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 12, color: LIGHT, space: 8 } }, children: [T("", { size: 2 })] }),
  new Paragraph({ spacing: { before: 280 }, alignment: AlignmentType.CENTER, children: [T("Poids, tranches, notes, critères éliminatoires, alertes, ajustements, coefficients et seuils de décision", { italics: true, size: 26, color: GREY })] }),
  new Paragraph({ spacing: { before: 1300 }, alignment: AlignmentType.CENTER, children: [T(`${allCrit.length} critères · ${M.redFlags.length} alertes · 4 domaines · notes de 1 à ${M.scoreScale}`, { bold: true, size: 22, color: NAVY })] }),
  new Paragraph({ spacing: { before: 40 }, alignment: AlignmentType.CENTER, children: [T("30 septembre 2026 — extrait de la version publiée en base", { size: 20, color: GREY })] }),
  brk(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Sommaire" })] }),
  new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-2" }),
  brk(),
];

// 1 — mode d'emploi
const s1 = [
  H1("1. Comment lire les grilles"),
  P("Chaque critère reçoit une note de 1 (critique) à 10 (favorable) selon la tranche de valeur, ou la modalité, dans laquelle se situe la donnée du dossier. Les notes sont ensuite pondérées puis agrégées en score de domaine, en score économique et en score final."),
  H2("La chaîne de calcul"),
];
s1.push(table(["Étape", "Règle"], [
  ["1. Note de critère", "Tranche numérique : borne basse incluse, borne haute exclue (min ≤ valeur < max). Modalité : correspondance exacte. Donnée absente : note plancher du critère (la plus basse), jamais une note neutre."],
  ["2. Score de domaine", "(Σ note × poids du critère ÷ Σ poids) ÷ 10 × 100. Les poids des critères d'un domaine totalisent 100 %."],
  ["3. Score économique", `S_éco = ${domains.map((d) => `${fr(d.weight)} × ${d.code}`).join(" + ")}`],
  ["4. Ajustement", "S_ajusté = S_éco × (1 + α segment + β zone), borné entre 0 et 100. Segment ou zone hors référentiel : aucun ajustement, signalé."],
  ["5. Alertes (D5)", "Malus cumulés en points ; une alerte bloquante impose la souffrance automatique ; une alerte à seuil numérique dont la donnée est absente applique son malus par prudence."],
  ["6. Après pénalités", "S = S_ajusté − malus, borné entre 0 et 100."],
  ["7. Coefficient BAM", "Score final = S × coefficient de la classe réglementaire (section 8)."],
  ["8. Décision", "Hiérarchie de verrous, puis seuils (section 9)."],
].map(([a, b]) => [cell(a, { w: 2400, bold: true, color: NAVY, bg: ZEBRA }), cell(b, { w: 7238 })]), [2400, 7238]));
s1.push(P("", { after: 80 }));
s1.push(H2("Repères utilisés dans les tableaux"));
s1.push(bullet([T("★ ", { bold: true, color: CRIT }), T("donnée décisionnelle : si elle est absente, la décision est « Dossier incomplet ».")]));
s1.push(bullet([T("⛔ ", { bold: true, color: CRIT }), T("critère éliminatoire : une note inférieure ou égale au seuil bloque la décision favorable tant que la condition n'est pas levée, au jalon indiqué.")]));
s1.push(bullet([T("S ", { bold: true, color: BLUE }), T("critère de la note de sûretés (le score économique et la note de sûretés sont calculés séparément, à titre d'information).")]));
s1.push(bullet([T("Niveau : ", { bold: true }), T("critique (note ≤ 3), vigilance (4 à 7), favorable (≥ 8).")]));

// 2 — vue d'ensemble
const s2 = [brk(), H1("2. Vue d'ensemble : 29 critères, poids et statut")];
s2.push(table(["Domaine", "Critère", "Poids critère", "Poids effectif", "Statut"], allCrit.map((c, i) => {
  const eff = c.weight * c.dom.weight;
  const flags = [];
  if (CRIT_KEYS.has(c.inputKey)) flags.push([T("★ décisionnelle", { color: CRIT, bold: true, size: 16 })]);
  if (c.isGate) flags.push([T(`⛔ éliminatoire (${c.gateStage ?? "TIRAGE"})`, { color: CRIT, bold: true, size: 16 })]);
  if (c.family === "GUARANTEE") flags.push([T("S sûretés", { color: BLUE, bold: true, size: 16 })]);
  const bg = i % 2 ? ZEBRA : undefined;
  return [cell(`${c.dom.code} — ${pct(c.dom.weight)}`, { w: 1700, bg, size: 16 }), cell([[T(c.code + "  ", { bold: true, size: 16, color: NAVY }), T(c.name, { size: 16 })]], { w: 4238, bg }),
    cell(pct(c.weight), { w: 1000, bg, align: AlignmentType.CENTER }), cell(pct(eff), { w: 1100, bg, align: AlignmentType.CENTER }), cell(flags.length ? flags : "—", { w: 1600, bg })];
}), [1700, 4238, 1000, 1100, 1600]));
s2.push(P("Poids effectif = poids du critère × poids de son domaine : part du critère dans le score économique.", { italics: true, color: GREY, before: 80, size: 18 }));

// 3..6 — grilles par domaine
const secs = [];
domains.forEach((d, di) => {
  secs.push(brk(), H1(`${3 + di}. ${d.code} — ${d.name} (${pct(d.weight)})`));
  secs.push(P(`${d.criteria.length} critères. Poids des critères au sein du domaine : ${d.criteria.map((c) => `${c.code} ${pct(c.weight)}`).join(" · ")}.`));
  [...d.criteria].sort((a, b) => a.orderIndex - b.orderIndex).forEach((c) => {
    const label = labelOf(c.inputKey);
    const tags = [];
    if (CRIT_KEYS.has(c.inputKey)) tags.push("★ donnée décisionnelle");
    if (c.isGate) tags.push(`⛔ critère éliminatoire — seuil : note ≤ ${c.gateThreshold}, jalon ${c.gateStage ?? "TIRAGE"}`);
    if (c.family === "GUARANTEE") tags.push("S — note de sûretés");
    secs.push(H2(`${c.code} — ${c.name}`));
    secs.push(P([T(`Poids ${pct(c.weight)} du domaine`, { bold: true }), T(` · soit ${pct(c.weight * d.weight)} du score économique · clé technique `), T(c.inputKey, { bold: true }), T(c.type === "QUAL" ? " · critère qualitatif" : ` · critère numérique${c.unit && c.unit !== "ratio/%" ? ` (${c.unit})` : ""}`)], { after: 40, keepNext: true }));
    if (tags.length) secs.push(P([T(tags.join("   ·   "), { color: CRIT, bold: true, size: 18 })], { after: 40, keepNext: true }));
    if (c.definition) secs.push(P([T("Définition : ", { bold: true, size: 19 }), T(c.definition, { size: 19 })], { after: 60, keepNext: true }));
    if (c.type === "QUAL") {
      const rows = [...c.options].sort((a, b) => a.orderIndex - b.orderIndex).map((o) => { const l = level(o.score);
        return [cell(o.value, { w: 2000, size: 17, color: GREY }), cell(o.label, { w: 4238, bold: true }), cell(String(o.score), { w: 1200, bold: true, align: AlignmentType.CENTER, size: 22, bg: l.bg, color: l.c }), cell(l.t, { w: 2200, color: l.c, bold: true })]; });
      secs.push(table(["Valeur saisie", "Modalité", "Note /10", "Niveau"], rows, [2000, 4238, 1200, 2200]));
    } else {
      const rows = [...c.ranges].sort((a, b) => a.orderIndex - b.orderIndex).map((r) => { const l = level(r.score);
        return [cell(bound(r.minIncl), { w: 1500, align: AlignmentType.CENTER }), cell(bound(r.maxExcl), { w: 1500, align: AlignmentType.CENTER }), cell(stripQ(r.label), { w: 3138, bold: true }),
          cell(String(r.score), { w: 1200, bold: true, align: AlignmentType.CENTER, size: 22, bg: l.bg, color: l.c }), cell(l.t, { w: 2300, color: l.c, bold: true })]; });
      secs.push(table(["Min (≥)", "Max (<)", "Tranche", "Note /10", "Niveau"], rows, [1500, 1500, 3138, 1200, 2300]));
    }
    const floor = Math.min(...[...c.options, ...c.ranges].map((x) => x.score));
    secs.push(P([T(`Donnée absente : note plancher ${floor}${CRIT_KEYS.has(c.inputKey) ? " et dossier incomplet (donnée décisionnelle)" : ""}.`, { italics: true, size: 18, color: GREY })], { before: 60, after: 160 }));
  });
});

// 7 — alertes
const sevLabel = { BLOCKING: "Bloquante", HIGH: "Élevée", MEDIUM: "Moyenne", LOW: "Faible" };
const sevColor = { BLOCKING: CRIT, HIGH: WARN, MEDIUM: GREY, LOW: GREY };
const opText = { isTrue: "= Oui", isFalse: "= Non", eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" };
const rule = (r) => { const c = r.rule.clause; const v = c.value !== undefined && c.value !== null ? ` ${typeof c.value === "number" ? fr(c.value) : c.value}` : ""; return `${labelOf(c.key)} ${opText[c.op]}${v}`; };
const effLabel = { HYPOTHESIS: "Hypothèse économique", SURVEILLANCE: "Surveillance / tirage", REGULATORY: "Réglementaire" };
const s7 = [brk(), H1("7. Alertes D5 (red flags)")];
s7.push(P("Les alertes ne modifient pas la note des critères : elles retranchent des points au score ajusté (malus), imposent la souffrance automatique (bloquantes) ou exigent un retour en comité. Le malus s'applique dès que la règle est vérifiée. Pour une règle à seuil numérique dont la donnée est absente, le malus est appliqué par prudence (« non exclue »)."));
s7.push(box("Division des risques", "L'alerte « Limite de division des risques dépassée » porte un malus de 0 : on ne masque pas un dépassement en dégradant la note. Elle exige une décision au niveau de délégation requis (retour en comité).", WARN, "FFF4E5"));
s7.push(P("", { after: 80 }));
s7.push(table(["Alerte", "Règle de déclenchement", "Sévérité", "Malus", "Comité", "Effet / référence"], [...M.redFlags].sort((a, b) => (b.severity === "BLOCKING") - (a.severity === "BLOCKING") || b.malus - a.malus).map((r, i) => {
  const bg = i % 2 ? ZEBRA : undefined;
  return [cell([[T(r.name, { bold: true, size: 17 })], [T(r.code, { size: 14, color: GREY })]], { w: 2200, bg }), cell(rule(r), { w: 2000, bg, size: 17 }),
    cell(sevLabel[r.severity], { w: 1250, bg, bold: true, color: sevColor[r.severity] }),
    cell(r.severity === "BLOCKING" ? "souffrance" : r.malus === 0 ? "0" : `−${r.malus}`, { w: 1250, bg, align: AlignmentType.CENTER, bold: true, color: r.malus > 0 || r.severity === "BLOCKING" ? CRIT : GREY }),
    cell(r.requiresCommittee ? "Oui" : "—", { w: 950, bg, align: AlignmentType.CENTER, bold: r.requiresCommittee, color: r.requiresCommittee ? CRIT : GREY }),
    cell([[T(effLabel[r.effect] ?? "", { size: 16 })], [T(r.regRef ?? "", { size: 15, color: GREY, italics: true })]], { w: 1988, bg })];
}), [2200, 2000, 1250, 1250, 950, 1988]));
// 8 — BAM, ajustements
const clsLabel = { SAIN: "Saine", SENSIBLE: "Sensible (surveillance)", PRE_DOUTEUX: "Pré-douteuse", DOUTEUX: "Douteuse", COMPROMIS: "Compromise", CTX: "Contentieux" };
const segLab = { social: "Logement social", intermediaire: "Logement intermédiaire", moyen_haut: "Moyen-haut standing", touristique: "Touristique / hôtelier", bureaux: "Bureaux", commerces: "Commerces", villas: "Villas" };
const zoneLab = { casa_centre: "Casablanca — centre", casa_peripherie: "Casablanca — périphérie", rabat_centre: "Rabat — centre", rabat_peripherie: "Rabat — périphérie", tanger: "Tanger", marrakech: "Marrakech", agadir: "Agadir", fes_oriental: "Fès / Oriental", regions_interieures: "Régions intérieures" };
const sg = (v) => (v === 0 ? "0 %" : `${v > 0 ? "+" : "−"}${fr(Math.abs(v * 1000) / 10)} %`);
const sgc = (v) => (v < 0 ? CRIT : v > 0 ? OKG : GREY);
const s8 = [brk(), H1("8. Coefficient réglementaire BAM et ajustements territoriaux")];
s8.push(H2("Coefficient par classe réglementaire"));
s8.push(P("Le score après pénalités est multiplié par le coefficient de la classe réglementaire (circulaires 19/G/2002 et 1/W). Une classe en défaut (pré-douteuse, douteuse, compromise, contentieux) impose en outre une décision NO_GO."));
const order = ["SAIN", "SENSIBLE", "PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];
s8.push(table(["Classe", "Coefficient", "Effet sur un score de 80"], order.map((k, i) => [cell(clsLabel[k], { w: 4000, bold: true, bg: i % 2 ? ZEBRA : undefined }), cell(fr(M.bamCoefficients[k]), { w: 2000, align: AlignmentType.CENTER, bold: true, bg: i % 2 ? ZEBRA : undefined }), cell(fr(Math.round(80 * M.bamCoefficients[k] * 100) / 100), { w: 3638, align: AlignmentType.CENTER, bg: i % 2 ? ZEBRA : undefined })]), [4000, 2000, 3638]));
s8.push(H2("Ajustement par segment (α) et par zone (β)"));
s8.push(P("S_ajusté = S_éco × (1 + α + β). Ces coefficients ne sont pas encore étayés par une analyse de micro-marché : l'application les signale et permet de comparer le score avec et sans coefficients."));
const segs = Object.entries(M.segmentAdjustments), zones = Object.entries(M.zoneAdjustments);
s8.push(table(["Segment", "α", "Zone", "β"], Array.from({ length: Math.max(segs.length, zones.length) }, (_, i) => {
  const bg = i % 2 ? ZEBRA : undefined; const s_ = segs[i], z = zones[i];
  return [cell(s_ ? segLab[s_[0]] ?? s_[0] : "", { w: 2900, bg }), cell(s_ ? sg(s_[1]) : "", { w: 1500, bg, align: AlignmentType.CENTER, bold: true, color: s_ ? sgc(s_[1]) : GREY }), cell(z ? zoneLab[z[0]] ?? z[0] : "", { w: 3238, bg }), cell(z ? sg(z[1]) : "", { w: 2000, bg, align: AlignmentType.CENTER, bold: true, color: z ? sgc(z[1]) : GREY })];
}), [2900, 1500, 3238, 2000]));

// 9 — décision
const th = M.decisionThresholds;
const s9 = [brk(), H1("9. Décision")];
s9.push(H2("Hiérarchie des verrous"));
s9.push(P("Les situations suivantes sont examinées dans cet ordre ; la première qui s'applique décide. Les seuils de score n'interviennent qu'en dernier."));
s9.push(table(["Priorité", "Situation", "Décision", "Classe interne"], [
  ["1", "Classe contentieux (CTX)", "NO_GO — score 0", "Souffrance"],
  ["2", "Alerte bloquante : impayé ≥ 90 jours, projet à l'arrêt ≥ 12 mois, contentieux", "NO_GO", "Souffrance"],
  ["3", "Classe en défaut avéré (pré-douteuse, douteuse, compromise)", "NO_GO", "Défaut avéré"],
  ["4", "Donnée décisionnelle absente, ou classe réglementaire non renseignée", "DOSSIER_INCOMPLET", "Dossier incomplet"],
  ["5", "Critère éliminatoire franchi (note ≤ seuil)", "NO_GO + condition à lever", "selon le score"],
  ["6", "Aucun verrou : seuils de score (ci-dessous)", "GO · GO sous conditions · Watch list · NO_GO", "Sain · Surveillance · Sensible probable · Sensible"],
].map((r, i) => r.map((x, j) => cell(x, { w: [1000, 4200, 2438, 2000][j], bg: i % 2 ? ZEBRA : undefined, bold: j === 0 || j === 2, align: j === 0 ? AlignmentType.CENTER : undefined, color: j === 2 ? (i === 3 ? GREY : i === 5 ? NAVY : CRIT) : undefined }))), [1000, 4200, 2438, 2000]));
s9.push(H2("Seuils de score final"));
const dec = [["GO", `≥ ${th.go}`, "Sain", OKG, "E4F2E5"], ["GO sous conditions", `≥ ${th.goWithConditions} et < ${th.go}`, "Surveillance", "5F8D2B", "EEF5E1"], ["Watch list", `≥ ${th.watchList} et < ${th.goWithConditions}`, "Sensible probable", WARN, "FFF1DC"], ["NO_GO", `< ${th.watchList}`, "Sensible", CRIT, "FBE4E1"]];
s9.push(table(["Décision", "Score final", "Classe interne"], dec.map(([a, b, c, col, bg]) => [cell(a, { w: 3400, bold: true, color: col, bg }), cell(b, { w: 3000, align: AlignmentType.CENTER, bg }), cell(c, { w: 3238, bg })]), [3400, 3000, 3238]));
s9.push(P("", { after: 60 }));
s9.push(box("PD indicative", "Une probabilité de défaut indicative est déduite du score : PD = 1 / (1 + e^−(2,223 − 0,0802 × score final)). Elle n'est pas calibrée sur l'historique de la banque : elle ne sert ni au provisionnement, ni aux pertes attendues, ni au capital.", WARN, "FFF4E5"));

// 10 — exemple
const ex = VEC.find((v) => v.id === "T06");
const exRows = []; let exOk = true; const domScores = {};
domains.forEach((d) => {
  let num = 0, den = 0;
  d.criteria.forEach((c) => {
    const n = noteOf(c, ex.inputs[c.inputKey]); num += n.note * c.weight; den += c.weight;
    exRows.push({ d: d.code, c, v: ex.inputs[c.inputKey], n });
  });
  domScores[d.code] = Math.round((num / den / M.scoreScale) * 10000) / 100;
  if (Math.abs(domScores[d.code] - ex.expected.domains[d.code]) > 0.02) exOk = false;
});
if (!exOk) throw new Error("Exemple non conforme au moteur : " + JSON.stringify(domScores) + " vs " + JSON.stringify(ex.expected.domains));
const scoreEco = Math.round(domains.reduce((s, d) => s + domScores[d.code] * d.weight, 0) * 100) / 100;
const segTxt = ex.segment ? segLab[ex.segment] : "non renseigné", zoneTxt = ex.zone ? zoneLab[ex.zone] : "non renseignée";
const s10 = [brk(), H1("10. Exemple chiffré")];
s10.push(P(`Dossier de démonstration (cas de référence T06 des autotests : trésorerie tendue) : segment ${segTxt}, zone ${zoneTxt}, classe réglementaire ${ex.cls === "SAIN" ? "saine" : ex.cls}. Les scores de domaine ci-dessous ont été recalculés ici et vérifiés identiques à ceux du moteur de l'application.`));
domains.forEach((d) => {
  s10.push(H2(`${d.code} — ${d.name} : score ${fr(domScores[d.code])}`));
  const rows = exRows.filter((r) => r.d === d.code).map((r, i) => { const bg = i % 2 ? ZEBRA : undefined; const l = level(r.n.note);
    return [cell(`${r.c.code} ${r.c.name}`, { w: 4300, bg, size: 16 }), cell(r.v === undefined || r.v === null ? "absente" : typeof r.v === "number" ? fr(r.v) : r.v, { w: 1600, bg, align: AlignmentType.CENTER }), cell(String(r.n.note), { w: 900, bg: l.bg, bold: true, color: l.c, align: AlignmentType.CENTER, size: 20 }), cell(pct(r.c.weight), { w: 1000, bg, align: AlignmentType.CENTER }), cell(fr(Math.round(r.n.note * r.c.weight * 100) / 100), { w: 1838, bg, align: AlignmentType.CENTER })]; });
  const den = d.criteria.reduce((s, c) => s + c.weight, 0), num = exRows.filter((r) => r.d === d.code).reduce((s, r) => s + r.n.note * r.c.weight, 0);
  s10.push(table(["Critère", "Valeur", "Note", "Poids", "Note × poids"], rows, [4300, 1600, 900, 1000, 1838]));
  s10.push(P(`Score du domaine = (${fr(Math.round(num * 1000) / 1000)} ÷ ${fr(Math.round(den * 100) / 100)}) ÷ 10 × 100 = ${fr(domScores[d.code])}`, { italics: true, size: 19, before: 60 }));
});
const e = ex.expected;
s10.push(H2("Du score de domaine à la décision"));
s10.push(table(["Étape", "Calcul", "Résultat"], [
  ["Score économique", domains.map((d) => `${fr(d.weight)} × ${fr(domScores[d.code])}`).join(" + "), fr(scoreEco)],
  ["Ajustement", ex.segment || ex.zone ? `× (1 + α + β) avec α = ${sg(e.alphaSeg)} (${segTxt}) et β = ${sg(e.betaZone)} (${zoneTxt})` : "aucun segment ni zone renseigné : α = β = 0, aucun ajustement", fr(e.scoreAdjusted)],
  ["Malus des alertes", e.flags.length ? e.flags.join(", ") : "aucune alerte déclenchée", `− ${fr(e.totalMalus)}`],
  ["Après pénalités", "", fr(e.scoreAfterPenalties)],
  ["Coefficient BAM", `classe ${ex.cls === "SAIN" ? "saine" : ex.cls}`, `× ${fr(e.coeffBAM)}`],
  ["Score final", "", fr(e.scoreFinal)],
  ["Décision", `${fr(e.scoreFinal)} ≥ ${th.watchList} et < ${th.goWithConditions}`, `${e.decision} — ${e.internalClass}`],
].map((r, i) => r.map((x, j) => cell(x, { w: [2200, 4938, 2500][j], bg: i % 2 ? ZEBRA : undefined, bold: j === 0 || i >= 5, align: j === 2 ? AlignmentType.CENTER : undefined }))), [2200, 4938, 2500]));

// 11 — données décisionnelles et floor
const s11 = [brk(), H1("11. Données décisionnelles, notes plancher et jalons")];
s11.push(P("Données dont l'absence rend le dossier « incomplet » (aucune décision officielle possible) :"));
GD.criticalKeys.forEach((k) => s11.push(bullet([T(labelOf(k), { bold: true }), T(`  (${k})`, { color: GREY, size: 18 })])));
s11.push(P("", { after: 40 }));
s11.push(H2("Critères éliminatoires"));
s11.push(table(["Critère", "Seuil", "Jalon", "Effet"], allCrit.filter((c) => c.isGate).map((c, i) => [cell(`${c.code} — ${c.name}`, { w: 4200, bold: true, bg: i % 2 ? ZEBRA : undefined }), cell(`note ≤ ${c.gateThreshold}`, { w: 1400, align: AlignmentType.CENTER, bg: i % 2 ? ZEBRA : undefined }), cell(c.gateStage ?? "TIRAGE", { w: 1500, align: AlignmentType.CENTER, bg: i % 2 ? ZEBRA : undefined }), cell("NO_GO + condition nommée à lever avant le jalon", { w: 2538, bg: i % 2 ? ZEBRA : undefined, size: 17 })]), [4200, 1400, 1500, 2538]));
s11.push(H2("Note économique et note de sûretés"));
s11.push(P(`Les critères de la famille « sûretés » : ${allCrit.filter((c) => c.family === "GUARANTEE").map((c) => `${c.code} ${c.name}`).join(" ; ")}. La note de sûretés est la moyenne pondérée de ces critères ; la note économique, celle des autres. Elles sont affichées séparément à titre d'information ; le score final reste calculé sur l'ensemble des critères.`));

const doc = new Document({
  creator: "Outil de scoring PI", title: `Grilles de scoring détaillées — PI_PROMOTION ${M.version}`, features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Calibri", size: 21, color: "222222" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: NAVY, font: "Calibri" }, paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIGHT, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: BLUE, font: "Calibri" }, paragraph: { spacing: { before: 220, after: 80 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "puces", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT, space: 4 } }, children: [T(`Grilles de scoring détaillées — PI_PROMOTION ${M.version}`, { size: 15, color: GREY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [T("Page ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: "Calibri" }), T(" / ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY, font: "Calibri" })] })] }) },
    children: [...cover, ...s1, ...s2, ...secs, ...s7, ...s8, ...s9, ...s10, ...s11],
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log("OK", OUT, b.length, "· exemple T06 conforme au moteur :", JSON.stringify(domScores)); });
