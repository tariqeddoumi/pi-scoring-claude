// Génère le guide Word du chargé d'affaires.
// Usage (racine du dépôt) : node docs/_sources/gen_guide_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, PageBreak, TableOfContents, PageNumber, Footer, Header, LevelFormat, PageOrientation,
} = require("docx");
const G = JSON.parse(fs.readFileSync(path.join(__dirname, "guide_data.json"), "utf8"));
const { PIECES, FAMILLES, DONNEES, CLASSIFICATION, ETAPES } = require("./guide_content.js");
const OUT = path.join(__dirname, "..", "Guide_Charge_Affaires_Promotion_Immobiliere.docx");

const NAVY = "1F3864", BLUE = "2E5496", LIGHT = "D9E1F2", ZEBRA = "F2F5FB", GREY = "595959", OKG = "548235", WARN = "B45F06", CRIT = "C00000";
const CRIT_KEYS = new Set(G.criticalKeys);
const T = (t, o = {}) => new TextRun({ text: t, size: o.size ?? 21, bold: o.bold, italics: o.italics, color: o.color, font: "Calibri" });
const P = (x, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 276 }, alignment: o.align, heading: o.heading, keepNext: o.keepNext,
  children: Array.isArray(x) ? x : [T(x, o)] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: t })] });
const bullet = (r) => new Paragraph({ numbering: { reference: "puces", level: 0 }, spacing: { after: 60, line: 276 }, children: Array.isArray(r) ? r : [T(r)] });
const num = (r, ref = "num") => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60, line: 276 }, children: Array.isArray(r) ? r : [T(r)] });
const brk = () => new Paragraph({ children: [new PageBreak()] });
const mc = (t, o = {}) => ({ __cell: true, text: t, ...o });
function cell(c, { w, bg, bold, align, color, size }) {
  const runs = Array.isArray(c) ? c : [new TextRun({ text: String(c ?? ""), bold, color, size: size ?? 17, font: "Calibri" })];
  return new TableCell({ width: { size: w, type: WidthType.DXA }, shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ alignment: align, spacing: { after: 0, line: 240 }, children: runs })] });
}
function table(h, rows, w) {
  const b = { style: BorderStyle.SINGLE, size: 2, color: "AEB6C6" }, bi = { style: BorderStyle.SINGLE, size: 1, color: "D0D6E2" };
  const trs = [new TableRow({ tableHeader: true, cantSplit: true, children: h.map((l, i) => cell(l, { w: w[i], bg: BLUE, bold: true, color: "FFFFFF" })) })];
  rows.forEach((r, i) => trs.push(new TableRow({ cantSplit: true, children: r.map((c, j) => (c && typeof c === "object" && c.__cell)
    ? cell(c.runs ?? c.text, { w: w[j], bg: c.bg ?? (i % 2 ? ZEBRA : undefined), bold: c.bold, align: c.align, color: c.color, size: c.size })
    : cell(c, { w: w[j], bg: i % 2 ? ZEBRA : undefined })) })));
  return new Table({ columnWidths: w, width: { size: w.reduce((a, x) => a + x, 0), type: WidthType.DXA }, rows: trs,
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: bi, insideVertical: bi } });
}
const callout = (titre, texte, color = BLUE, fill = "EEF3FB") => new Table({ columnWidths: [9638], width: { size: 9638, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color }, bottom: { style: BorderStyle.SINGLE, size: 4, color }, left: { style: BorderStyle.SINGLE, size: 4, color }, right: { style: BorderStyle.SINGLE, size: 4, color }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ children: [new TableCell({ width: { size: 9638, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill, color: "auto" }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [new Paragraph({ spacing: { after: 40 }, children: [T(titre, { bold: true, color })] }), new Paragraph({ spacing: { after: 0, line: 276 }, children: [T(texte)] })] })] })] });
const pct = (x) => `${Math.round(x * 1000) / 10}`.replace(".", ",") + " %";
const pieceRefs = (ids) => ids.join(", ");

// ------------------------------------------------------------------ contenu
const cover = [
  new Paragraph({ spacing: { before: 2000 }, alignment: AlignmentType.CENTER, children: [T("GUIDE DU CHARGÉ D'AFFAIRES", { bold: true, size: 48, color: NAVY })] }),
  new Paragraph({ spacing: { before: 80 }, alignment: AlignmentType.CENTER, children: [T("Crédit à la promotion immobilière", { bold: true, size: 34, color: BLUE })] }),
  new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 12, color: LIGHT, space: 8 } }, children: [T("", { size: 2 })] }),
  new Paragraph({ spacing: { before: 280 }, alignment: AlignmentType.CENTER, children: [T("Quelles pièces réunir, où saisir chaque donnée, comment lire le résultat et suivre le dossier", { italics: true, size: 26, color: GREY })] }),
  new Paragraph({ spacing: { before: 1300 }, alignment: AlignmentType.CENTER, children: [T(`Modèle de scoring PI_PROMOTION ${G.version} · outil Excel 4.1`, { bold: true, size: 22, color: NAVY })] }),
  new Paragraph({ spacing: { before: 40 }, alignment: AlignmentType.CENTER, children: [T("30 septembre 2026", { size: 20, color: GREY })] }),
  brk(),
  P("Sommaire", { heading: HeadingLevel.HEADING_1 }),
  new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-2" }),
  brk(),
];

const s1 = [
  H1("1. L'essentiel en une page"),
  P("Votre dossier est noté par le modèle PI_PROMOTION : 29 critères répartis en 4 domaines, 13 alertes, puis une décision. La qualité de cette note dépend entièrement des pièces que vous réunissez et de la rigueur de la saisie."),
  table(["Domaine", "Poids", "Ce qui est apprécié"], G.domains.map((d) => [mc(`${d.code} — ${d.name}`, { bold: true }), mc(pct(d.weight), { align: AlignmentType.CENTER }), d.criteria.map((c) => c.label.replace(/ \((%|x|jours|mois|pts)\)$/, "")).join(" · ")]), [2600, 900, 6138]),
  P("", { after: 60 }),
  H2("Les cinq règles à retenir"),
  num([T("Un champ vide = donnée absente. ", { bold: true }), T("Jamais 0, jamais « Non » par défaut. Une donnée absente reçoit la note la plus basse ; une donnée décisionnelle absente rend le dossier « Dossier incomplet ».")], "regles"),
  num([T("Chaque valeur saisie doit renvoyer à une pièce datée. ", { bold: true }), T("La section 5 donne, pour chaque donnée, la pièce source et la méthode de calcul.")], "regles"),
  num([T("Synchronisez avant de calculer. ", { bold: true }), T("Le bouton « Synchroniser vers le scoring » reporte automatiquement les données issues du suivi (ventes, autorisations, financement des acquéreurs, impayés, arrêt de chantier…).")], "regles"),
  num([T("Lisez l'encart « Lecture du résultat ». ", { bold: true }), T("Il liste les données manquantes, les conditions à lever et les alertes qui imposent un retour en comité.")], "regles"),
  num([T("Tout événement matériel se déclare au journal. ", { bold: true }), T("Impayé, arrêt de chantier, avenant, litige : il déclenche un nouveau calcul et, souvent, un retour en comité.")], "regles"),
  P("", { after: 60 }),
  callout("Données décisionnelles — à renseigner obligatoirement",
    "Sans elles, la décision est « Dossier incomplet » : " + G.criticalKeys.map((k) => {
      const c = G.domains.flatMap((d) => d.criteria).find((x) => x.key === k); const a = G.alerts.find((x) => x.key === k);
      return (c ? c.label : a ? a.label : k);
    }).join(" · ") + ". Pour le retard de paiement, le retard de chantier et la durée d'arrêt, saisir 0 lorsqu'il n'y en a pas.", CRIT, "FDECEA"),
];

const roleDesc = {
  RELATIONSHIP_MANAGER: "Monte le dossier, réunit les pièces, saisit, synchronise, calcule le score, soumet, assure le suivi.",
  BRANCH_DIRECTOR: "Émet l'avis front ; peut renvoyer le dossier au chargé d'affaires.",
  RISK_ANALYST: "Contre-étude : vérifie les données, recalcule, valide le score ou renvoie le dossier.",
  REGIONAL_DIRECTOR: "Avis et décision dans sa délégation.",
  MANAGER: "Décision ou comité de crédit.",
  AUDITOR: "Consultation et piste d'audit.",
  ADMIN: "Administration des utilisateurs, du modèle et des référentiels.",
};
const s2 = [
  brk(), H1("2. Votre rôle et le circuit du dossier"),
  P("Dans l'application, le chargé d'affaires peut consulter et modifier ses projets, lancer un calcul et exporter le dossier de comité. Il ne valide pas un score et ne décide pas : ces étapes relèvent de la contre-étude et de la délégation."),
  table(["Rôle", "Ce qu'il fait"], G.roles.map((r) => [mc(r.label, { bold: r.role === "RELATIONSHIP_MANAGER", color: r.role === "RELATIONSHIP_MANAGER" ? NAVY : undefined }), roleDesc[r.role] ?? ""]), [3000, 6638]),
  H2("Le circuit"),
  table(["Étape", "Actions possibles"], G.workflow.map((w) => [mc(w.label, { bold: true }), w.transitions.length ? w.transitions.join(" · ") : "Étape finale"]), [3400, 6238]),
  P([T("À retenir : ", { bold: true }), T("un dossier renvoyé revient à l'état « Brouillon (chargé d'affaires) ». Complétez, recalculez, puis soumettez de nouveau. Chaque transition est tracée avec son auteur.")], { before: 100 }),
];

const s3 = [
  brk(), H1("3. Le parcours en 10 étapes"),
  table(["#", "Étape", "Où et comment"], ETAPES.map((e, i) => [mc(String(i + 1), { bold: true, align: AlignmentType.CENTER, color: NAVY }), mc(e[0], { bold: true }), e[1]]), [500, 2600, 6538]),
  P("", { after: 60 }),
  callout("Lecture IA des documents",
    "Sur l'écran de saisie, « Lecture IA des documents » propose des valeurs extraites des pièces que vous déposez (business plan, autorisations, états financiers). Ce sont des propositions : chaque valeur doit être vérifiée contre la pièce avant d'être appliquée. L'IA ne remplit que ce que les documents établissent ; le reste reste à saisir."),
];

// Section 4 : pièces (paysage)
const s4 = [
  H1("4. Les pièces à réunir"),
  P("Liste de référence par famille. Pour chaque pièce : qui la produit, sa fraîcheur recommandée et les données du modèle qu'elle alimente. La liste est à valider avec la politique de crédit et la procédure interne de l'établissement."),
];
for (const [f, lib] of Object.entries(FAMILLES)) {
  s4.push(H2(`${f}. ${lib}`));
  s4.push(table(["Réf.", "Pièce", "Émetteur", "Fraîcheur", "Alimente"], PIECES.filter((p) => p.fam === f).map((p) => [mc(p.id, { bold: true }), p.nom, p.emetteur, p.fraicheur, p.sert]), [700, 5500, 2600, 2300, 3300]));
}

// Section 5 : donnée par donnée (paysage)
const s5 = [
  new Paragraph({ children: [new PageBreak()] }),
  H1("5. Donnée par donnée : où saisir, quelle pièce, comment calculer"),
  P([T("★ ", { bold: true, color: CRIT }), T("donnée décisionnelle (absente = dossier incomplet) · "), T("⛔ ", { bold: true, color: CRIT }), T("critère éliminatoire (jalon indiqué) · "), T("S ", { bold: true, color: BLUE }), T("note de sûretés. La colonne « Barème » donne la note de 1 à 10 selon la valeur.")]),
];
const W5 = [2600, 1100, 4300, 2600, 3800];
const H5 = ["Donnée (clé technique)", "Pièces", "Comment l'obtenir", "Barème", "Attention"];
const rowFor = (c) => {
  const d = DONNEES[c.key] ?? { pieces: [], calcul: "", piege: "" };
  const flags = [];
  if (CRIT_KEYS.has(c.key)) flags.push(new TextRun({ text: "★ ", bold: true, color: CRIT, size: 17, font: "Calibri" }));
  if (c.gate) flags.push(new TextRun({ text: `⛔ ${c.gateStage ?? "TIRAGE"} `, bold: true, color: CRIT, size: 15, font: "Calibri" }));
  if (c.family === "GUARANTEE") flags.push(new TextRun({ text: "S ", bold: true, color: BLUE, size: 17, font: "Calibri" }));
  return [
    mc(null, { runs: [...flags, new TextRun({ text: c.label, bold: true, size: 17, font: "Calibri" }), new TextRun({ text: `  ${c.code} · ${c.key}`, size: 14, color: GREY, font: "Calibri" }), new TextRun({ text: `  Étape : ${c.step}`, size: 14, color: GREY, italics: true, font: "Calibri", break: 1 })] }),
    mc(pieceRefs(d.pieces), { align: AlignmentType.CENTER }),
    d.calcul, mc(c.scale.join(" · "), { size: 15 }), mc(d.piege, { color: d.piege.startsWith("DONNÉE") ? CRIT : undefined }),
  ];
};
for (const d of G.domains) {
  s5.push(H2(`${d.code} — ${d.name} (${pct(d.weight)})`));
  s5.push(table(H5, d.criteria.map(rowFor), W5));
}
const alertOnly = G.alerts.filter((a) => !G.domains.some((d) => d.criteria.some((c) => c.key === a.key)));
s5.push(H2("Données d'alerte (couche D5)"));
s5.push(table(H5, alertOnly.map((a) => {
  const d = DONNEES[a.key] ?? { pieces: [], calcul: "", piege: "" };
  const sev = a.severity === "BLOCKING" ? "bloquante (souffrance)" : `malus ${a.malus}`;
  return [
    mc(null, { runs: [...(CRIT_KEYS.has(a.key) ? [new TextRun({ text: "★ ", bold: true, color: CRIT, size: 17, font: "Calibri" })] : []), new TextRun({ text: a.label, bold: true, size: 17, font: "Calibri" }), new TextRun({ text: `  ${a.key}`, size: 14, color: GREY, font: "Calibri" }), new TextRun({ text: `  Étape : ${a.step}`, size: 14, color: GREY, italics: true, font: "Calibri", break: 1 })] }),
    mc(pieceRefs(d.pieces), { align: AlignmentType.CENTER }), d.calcul,
    mc(`${a.name} — ${sev}${a.committee ? " · retour en comité" : ""}`, { size: 15 }), mc(d.piege, { color: d.piege.startsWith("DONNÉE") ? CRIT : undefined }),
  ];
}), W5));
s5.push(H2("Données de classification BAM (circulaire 1/W)"));
s5.push(P("Ces données ne sont pas notées dans le score mais déterminent la classe réglementaire (saine, sensible, pré-douteuse, douteuse, compromise, contentieux), qui module le score final. Elles se saisissent dans les étapes « Crédit & dépassements » et « Vulnérabilité réglementaire BAM » du wizard ; plusieurs sont alimentées par le journal d'événements."));
s5.push(table(["Donnée", "Pièces", "Source"], CLASSIFICATION.map((c) => [mc(c[0], { bold: true }), mc(c[1], { align: AlignmentType.CENTER }), c[2]]), [8000, 1800, 4500]));

// Section 6 : lire le résultat (portrait)
const s6 = [
  H1("6. Lire et exploiter le résultat"),
  P("Après le calcul, ouvrez la fiche projet, onglet « Scoring ». L'encart « Lecture du résultat » donne la version du modèle utilisée, la classe interne, la chaîne de calcul (score brut, ajustements, malus, coefficient BAM, score final), la PD indicative et les notes économique et de sûretés."),
  H2("Hiérarchie de la décision"),
  table(["Priorité", "Situation", "Décision"], [
    ["1", "Classe contentieux (CTX)", mc("NO_GO — score 0", { color: CRIT, bold: true })],
    ["2", "Alerte bloquante : impayé ≥ 90 j, arrêt ≥ 12 mois, contentieux", mc("NO_GO — souffrance", { color: CRIT, bold: true })],
    ["3", "Classe en défaut (pré-douteuse, douteuse, compromise)", mc("NO_GO — défaut avéré", { color: CRIT, bold: true })],
    ["4", "Donnée décisionnelle absente ou classe non établie", mc("DOSSIER_INCOMPLET", { color: GREY, bold: true })],
    ["5", "Critère éliminatoire franchi", mc("NO_GO + condition à lever", { color: CRIT, bold: true })],
    ["6", `Score ≥ ${G.thresholds.go} · ≥ ${G.thresholds.goWithConditions} · ≥ ${G.thresholds.watchList} · < ${G.thresholds.watchList}`, "GO · GO sous conditions · Watch list · NO_GO"]], [900, 5600, 3138]),
  H2("Que faire selon le résultat"),
  table(["Vous voyez", "Ce que vous faites"], [
    [mc("Dossier incomplet", { bold: true }), "L'encart liste les données manquantes en clair. Réunissez la pièce, saisissez la valeur (0 si « aucun »), synchronisez, recalculez."],
    [mc("Condition à lever (jalon)", { bold: true }), "Un critère éliminatoire est franchi (apport, foncier / autorisations). Indiquez dans la note au comité la pièce attendue et la date : aucun tirage ne sera autorisé avant sa levée."],
    [mc("Alerte avec malus", { bold: true }), "Documentez le mitigant (garantie complémentaire, apport supplémentaire, calendrier) ; le malus reste appliqué tant que la donnée ne change pas."],
    [mc("Retour en comité requis", { bold: true }), "Une alerte ou un événement l'impose (restructuration, retard ≥ 6 mois, mainlevée sous-tarifée, division des risques). Préparez le passage en comité."],
    [mc("Segment ou zone hors référentiel", { bold: true }), "Corrigez la fiche projet : aucun ajustement n'a été appliqué."],
    [mc("« Modèle … — version retirée »", { bold: true }), "Le score date d'une ancienne version du modèle : relancez le calcul."]], [3200, 6438]),
  P("", { after: 60 }),
  callout("La PD affichée est indicative", "Elle n'est pas calibrée sur l'historique de la banque. Elle éclaire la discussion ; elle ne sert ni au provisionnement ni au capital.", WARN, "FFF4E5"),
  H2("Le dossier de comité"),
  P("Depuis la fiche projet, « Dossier comité (PDF) » et « Dossier comité (Excel) » produisent la synthèse : décision, classe, lecture du résultat, métriques de risque, garanties, facilités, groupe. Vérifiez que le score est à jour avant l'export."),
];

// Section 7 : suivi (portrait)
const ev = G.events;
const s7 = [
  brk(), H1("7. Le suivi après octroi"),
  H2("Revues périodiques"),
  P(`Le score doit être recalculé au moins tous les ${G.review.SAIN} jours pour une créance saine, tous les ${G.review.SENSIBLE} jours pour une créance sensible et tous les ${G.review.PRE_DOUTEUX} jours pour une créance en souffrance — et immédiatement après tout événement matériel. La fiche projet affiche la « Fraîcheur du score » et l'échéance de la prochaine revue.`),
  H2("Déblocages"),
  bullet("Chaque tirage travaux s'appuie sur une situation de travaux visée par l'architecte ou le BET (référence et pourcentage certifié à saisir)."),
  bullet("Un verrou d'autorisation ouvert (pièce indispensable aux travaux manquante) interdit le tirage."),
  bullet("Mettez à jour les lots (statut, prix, financement de l'acquéreur) avant chaque synchronisation."),
  H2("Mainlevées partielles"),
  P("Chaque vente permet une mainlevée contre remboursement de la quotité de désengagement fixée par la convention. L'application compare cette quotité à la quotité d'équilibre (encours / valeur commercialisable) : une quotité inférieure déclenche l'alerte « Prix de mainlevée sous-tarifé » et un retour en comité."),
  H2("Événements à déclarer au journal"),
  P("Fiche projet › Suivi › Événements. Un événement « matériel » déclenche un nouveau calcul ; certains imposent un retour en comité."),
  table(["Événement", "Gravité", "Nouveau calcul", "Comité", "Référence"], ev.map((e) => [mc(e.label, { bold: e.severity === "CRITICAL" }),
    mc(e.severity === "CRITICAL" ? "Critique" : e.severity === "WARNING" ? "Vigilance" : "Information", { color: e.severity === "CRITICAL" ? CRIT : e.severity === "WARNING" ? WARN : GREY }),
    mc(e.affectsScoring ? "Oui" : "—", { align: AlignmentType.CENTER }), mc(e.committee ? "Oui" : "—", { align: AlignmentType.CENTER, bold: e.committee, color: e.committee ? CRIT : undefined }), mc(e.regRef, { size: 15 })]), [4000, 1300, 1300, 1000, 2038]),
  H2("Visites de chantier"),
  P("Saisissez chaque visite (date, avancement observé, effectif, incidents qualité, sécurité, intempéries, risque de retard). L'avancement observé alimente « Avancement vs planning » à la synchronisation."),
];

// Section 8 : outil Excel
const s8 = [
  brk(), H1("8. L'outil Excel (hors application)"),
  P("Le classeur PI_Promotion_Modele_v4.xlsx reproduit exactement le calcul de l'application (vérifié sur 20 cas de référence). Il sert à simuler, préparer un comité, travailler hors connexion ou se former. La décision officielle et la traçabilité restent dans l'application."),
  H2("Utilisation"),
  num("Ouvrir le classeur (au premier usage, installer les macros : voir l'onglet LisezMoi).", "excel"),
  num("Bouton « Nouveau dossier » : vide la saisie et les calculateurs (le classeur s'ouvre sur un dossier d'exemple).", "excel"),
  num("Onglet Saisie : référence, nom, segment, zone, classe BAM, puis les données (cellules jaunes). Vide = absent, comme dans l'application.", "excel"),
  num("Onglet Calculateurs : chaîne d'autorisations, ventes sécurisées, quotité de désengagement, division des risques, durée d'arrêt de chantier.", "excel"),
  num("Onglet Resultat : décision, score, classe interne, données manquantes en clair, conditions avec jalon, alertes, comité.", "excel"),
  num("Onglet Stress : « Lancer le stress test » (prix, coût, retard, ventes, taux, sévère combiné).", "excel"),
  num("« Exporter en PDF » pour joindre la simulation à la note.", "excel"),
  P("", { after: 60 }),
  callout("Correspondance avec l'application", "Chaque ligne de la Saisie porte la clé technique de la donnée (colonne « Clé technique »), identique à celle indiquée dans la section 5 de ce guide. Les pièces à réunir sont donc les mêmes."),
];

// Section 9 : bonnes pratiques
const s9 = [
  H1("9. Bonnes pratiques et erreurs fréquentes"),
  table(["À faire", "À éviter"], [
    ["Laisser vide une donnée inconnue et réunir la pièce.", "Saisir 0 « pour avancer » : 0 peut donner la meilleure note (impasse, retard)."],
    ["Saisir 0 quand il n'y a réellement aucun impayé, retard ou arrêt.", "Laisser vide une donnée décisionnelle connue : le dossier reste incomplet."],
    ["Synchroniser juste avant chaque calcul.", "Calculer sur des lots ou des autorisations périmés."],
    ["Renseigner segment et zone depuis les listes du modèle.", "Saisir un segment ou une zone libre : aucun ajustement n'est appliqué."],
    ["Utiliser la valeur d'expertise indépendante pour la LTV.", "Reprendre la valeur commerciale du promoteur."],
    ["Justifier chaque apport par un paiement effectif.", "Compter un apport promis comme injecté."],
    ["Déclarer tous les liens du groupe (sociétés sœurs, cautions).", "Omettre une société liée : effet groupe et division des risques faussés."],
    ["Déclarer immédiatement tout événement matériel.", "Attendre la revue annuelle pour signaler un impayé ou un arrêt."],
    ["Vérifier chaque valeur proposée par la lecture IA.", "Appliquer les propositions IA sans les confronter aux pièces."],
    ["Recalculer après toute nouvelle version du modèle.", "Présenter en comité un score marqué « version retirée »."]], [4819, 4819]),
];

// Annexes
const annA = [
  brk(), H1("Annexe A — Check-list imprimable des pièces"),
  P("À cocher au montage du dossier puis à chaque revue. Date de la pièce à reporter dans la colonne prévue."),
];
for (const [f, lib] of Object.entries(FAMILLES)) {
  annA.push(H2(`${f}. ${lib}`));
  annA.push(table(["☐", "Réf.", "Pièce", "Date de la pièce"], PIECES.filter((p) => p.fam === f).map((p) => [mc("☐", { align: AlignmentType.CENTER, size: 22 }), mc(p.id, { bold: true }), p.nom, ""]), [500, 700, 6438, 2000]));
}
const annB = [
  H1("Annexe B — Glossaire"),
  table(["Terme", "Définition"], [
    ["Critère éliminatoire (gate)", "Critère dont une note plancher bloque la décision favorable tant que la condition n'est pas levée, au jalon indiqué (signature, tirage)."],
    ["Donnée décisionnelle", "Donnée sans laquelle aucune décision officielle n'est possible (dossier incomplet)."],
    ["Alerte (red flag)", "Règle de la couche D5 : malus en points, souffrance automatique (bloquante) ou retour en comité."],
    ["Classe réglementaire BAM", "Classement de la créance selon les circulaires de Bank Al-Maghrib (19/G/2002 et 1/W) ; module le score par un coefficient."],
    ["Quotité de désengagement", "Part du prix de vente d'un lot remboursée à la banque en contrepartie de la mainlevée partielle."],
    ["Quotité d'équilibre", "Encours / valeur commercialisable totale : quotité minimale qui éteint la dette à la vente du dernier lot."],
    ["Ventes sécurisées", "Ventes pondérées par la solidité du financement de l'acquéreur (débloqué, accordé, en cours, non instruit, refusé)."],
    ["Division des risques", "Limite d'exposition sur une contrepartie ou un groupe, rapportée aux fonds propres de la banque."],
    ["LTC / LTV", "Crédit rapporté au coût total du programme / à la valeur d'expertise décotée de 10 %."],
    ["Impasse", "Besoin de financement non couvert au pire mois du plan de trésorerie."],
    ["PD indicative", "Probabilité de défaut déduite du score par une formule non calibrée : à titre indicatif."],
    ["Synchroniser vers le scoring", "Bouton qui reporte dans la saisie les données calculées à partir du suivi (lots, autorisations, facilités, événements)."]], [3000, 6638]),
];

// ------------------------------------------------------------------ document
const doc = new Document({
  creator: "Outil de scoring PI", title: "Guide du chargé d'affaires — crédit à la promotion immobilière", features: { updateFields: true },
  styles: {
    default: { document: { run: { font: "Calibri", size: 21, color: "222222" } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: NAVY, font: "Calibri" }, paragraph: { spacing: { before: 240, after: 140 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LIGHT, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: BLUE, font: "Calibri" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "puces", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
    ...["num", "regles", "excel"].map((r) => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 320 } } } }] })),
  ] },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: hdr() }, footers: { default: ftr() }, children: [...cover, ...s1, ...s2, ...s3] },
    { properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      headers: { default: hdr() }, footers: { default: ftr() }, children: [...s4, ...s5] },
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: hdr() }, footers: { default: ftr() }, children: [...s6, ...s7, ...s8, ...s9, ...annA, ...annB] },
  ],
});
function hdr() { return new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT, space: 4 } }, children: [T(`Guide du chargé d'affaires — promotion immobilière · modèle ${G.version}`, { size: 15, color: GREY })] })] }); }
function ftr() { return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [T("Page ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: "Calibri" }), T(" / ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY, font: "Calibri" })] })] }); }
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log("OK", OUT, b.length); });
