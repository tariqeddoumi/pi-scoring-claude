// Génère le support de formation PowerPoint du chargé d'affaires.
// Usage : PPTX_DEPS=<dossier node_modules contenant pptxgenjs, react-icons, react, react-dom, sharp> node docs/_sources/gen_guide_pptx.js
// (toutes les dépendances sont chargées depuis ce même dossier pour éviter un
// mélange de versions de React avec celles du dépôt)
const fs = require("fs");
const path = require("path");
const dep = process.env.PPTX_DEPS ? require("module").createRequire(path.join(process.env.PPTX_DEPS, "noop.js")) : require;
const pptxgen = dep("pptxgenjs");
const React = dep("react");
const ReactDOMServer = dep("react-dom/server");
const sharp = dep("sharp");
const Fa = dep("react-icons/fa");
const G = JSON.parse(fs.readFileSync(path.join(__dirname, "guide_data.json"), "utf8"));
const { PIECES, FAMILLES, DONNEES } = require("./guide_content.js");
const OUT = path.join(__dirname, "..", "Guide_Charge_Affaires_Formation.pptx");

const NAVY = "1F3864", TERRA = "C8553D", TEAL = "2A7F8E", TINT = "EEF2F8", INK = "2B2B2B", MUTED = "5F6B7A", WHITE = "FFFFFF", ICE = "CADCFC";
const HF = "Cambria", BF = "Calibri";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 × 5,625 in
  pres.title = "Guide du chargé d'affaires — crédit à la promotion immobilière";
  const I = {
    building: await icon(Fa.FaBuilding, WHITE), user: await icon(Fa.FaUserTie, WHITE), map: await icon(Fa.FaMapMarkedAlt, WHITE),
    ruler: await icon(Fa.FaDraftingCompass, WHITE), hand: await icon(Fa.FaHandshake, WHITE), bank: await icon(Fa.FaUniversity, WHITE),
    warn: await icon(Fa.FaExclamationTriangle, WHITE), sync: await icon(Fa.FaSyncAlt, WHITE), file: await icon(Fa.FaFileExcel, WHITE),
    check: await icon(Fa.FaCheck, WHITE), times: await icon(Fa.FaTimes, WHITE), search: await icon(Fa.FaSearch, WHITE),
    cal: await icon(Fa.FaCalendarAlt, WHITE), key: await icon(Fa.FaKey, WHITE), chart: await icon(Fa.FaChartLine, WHITE), coins: await icon(Fa.FaCoins, WHITE),
    hard: await icon(Fa.FaHardHat, WHITE), gavel: await icon(Fa.FaGavel, WHITE),
  };
  const title = (s, t, sub) => {
    s.addText(t, { x: 0.5, y: 0.3, w: 9, h: 0.6, fontFace: HF, fontSize: 28, bold: true, color: NAVY, margin: 0, isTextBox: true });
    if (sub) s.addText(sub, { x: 0.5, y: 0.88, w: 9, h: 0.35, fontFace: BF, fontSize: 13, color: MUTED, italic: true, margin: 0, isTextBox: true });
  };
  const circleIcon = (s, img, x, y, d, fill) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    s.addImage({ data: img, x: x + d * 0.25, y: y + d * 0.25, w: d * 0.5, h: d * 0.5 });
  };
  const circleNum = (s, n, x, y, d, fill, fs = 14) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    s.addText(String(n), { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: BF, fontSize: fs, bold: true, color: WHITE, margin: 0, isTextBox: true });
  };
  const card = (s, x, y, w, h, fill = TINT) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
  const footer = (s, n) => s.addText(`Guide du chargé d'affaires · modèle ${G.version}   ${n}`, { x: 5.5, y: 5.28, w: 4, h: 0.25, fontFace: BF, fontSize: 9, color: MUTED, align: "right", margin: 0, isTextBox: true });

  // 1 — Titre
  let s = pres.addSlide(); s.background = { color: NAVY };
  circleIcon(s, I.building, 7.6, 1.2, 1.6, TERRA);
  s.addText([{ text: "Guide du", options: { breakLine: true } }, { text: "chargé d'affaires" }], { x: 0.6, y: 0.9, w: 6.8, h: 1.45, fontFace: HF, fontSize: 36, bold: true, color: WHITE, valign: "top", margin: 0, isTextBox: true });
  s.addText("Crédit à la promotion immobilière", { x: 0.6, y: 2.45, w: 6.8, h: 0.5, fontFace: HF, fontSize: 22, color: "F2B8A6", margin: 0, isTextBox: true });
  s.addText("Pièces à réunir · où saisir chaque donnée · lire le résultat · suivre le dossier", { x: 0.6, y: 3.1, w: 6.8, h: 0.5, fontFace: BF, fontSize: 14, color: WHITE, margin: 0, isTextBox: true });
  s.addText(`Modèle de scoring PI_PROMOTION ${G.version} · outil Excel 5.0 · octobre 2026`, { x: 0.6, y: 4.7, w: 8, h: 0.35, fontFace: BF, fontSize: 11, color: ICE, margin: 0, isTextBox: true });
  s.addNotes("Objectif de la session : savoir exactement quelles pièces réunir pour un dossier de promotion immobilière, où saisir chaque donnée, comment lire le résultat du scoring et comment suivre le dossier après octroi. Le guide Word détaille chaque point ; ce support en donne l'essentiel.");

  // 2 — L'essentiel
  s = pres.addSlide(); title(s, "L'essentiel : cinq règles", "Ce qui fait la qualité d'une note, avant tout calcul");
  const regles = [
    ["Vide = donnée absente", "Jamais 0, jamais « Non » par défaut : note la plus basse."],
    ["Une valeur, une pièce datée", "Chaque donnée saisie renvoie à une pièce du dossier."],
    ["Synchroniser avant de calculer", "Le suivi alimente ventes, autorisations, impayés…"],
    ["Lire « Lecture du résultat »", "Données manquantes, conditions, alertes, comité."],
    ["Déclarer tout événement", "Impayé, arrêt, avenant, litige : nouveau calcul."],
  ];
  regles.forEach(([h, t], i) => {
    const y = 1.45 + i * 0.72;
    circleNum(s, i + 1, 0.5, y, 0.5, TERRA);
    s.addText(h, { x: 1.15, y: y - 0.02, w: 5.3, h: 0.3, fontFace: BF, fontSize: 15, bold: true, color: NAVY, margin: 0, isTextBox: true });
    s.addText(t, { x: 1.15, y: y + 0.27, w: 5.3, h: 0.3, fontFace: BF, fontSize: 12, color: INK, margin: 0, isTextBox: true });
  });
  card(s, 6.65, 1.45, 2.85, 3.45, NAVY);
  s.addText(String(G.criticalKeys.length), { x: 6.65, y: 1.65, w: 2.85, h: 1.0, fontFace: HF, fontSize: 60, bold: true, color: WHITE, align: "center", margin: 0, isTextBox: true });
  s.addText("données décisionnelles", { x: 6.8, y: 2.65, w: 2.55, h: 0.35, fontFace: BF, fontSize: 15, bold: true, color: "F2B8A6", align: "center", margin: 0, isTextBox: true });
  s.addText("Si l'une manque, la décision est « Dossier incomplet ». Pour les impayés, le retard et l'arrêt de chantier : saisir 0 quand il n'y en a pas.", { x: 6.85, y: 3.1, w: 2.45, h: 1.6, fontFace: BF, fontSize: 12, color: WHITE, align: "center", valign: "top", margin: 0, isTextBox: true });
  footer(s, 2);
  s.addNotes("Insister sur la règle n°1 : dans l'ancienne saisie, un champ vidé devenait 0 ; une impasse à 0 donnait la meilleure note. Depuis la correction, un vide reste une absence : le moteur applique la note plancher ou « Dossier incomplet ».");

  // 3 — Le modèle
  s = pres.addSlide(); title(s, "Le modèle en un coup d'œil", `${G.domains.reduce((a, d) => a + d.criteria.length, 0)} critères notés de 1 à 10, ${G.alerts.length} alertes, une décision`);
  G.domains.forEach((d, i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.45, 2.1, 2.2);
    s.addText(`${Math.round(d.weight * 100)} %`, { x, y: 1.55, w: 2.1, h: 0.75, fontFace: HF, fontSize: 36, bold: true, color: NAVY, align: "center", margin: 0, isTextBox: true });
    s.addText(`${d.code} — ${d.name}`, { x: x + 0.12, y: 2.35, w: 1.86, h: 0.75, fontFace: BF, fontSize: 13, bold: true, color: INK, align: "center", valign: "top", margin: 0, isTextBox: true });
    s.addText(`${d.criteria.length} critères`, { x, y: 3.15, w: 2.1, h: 0.3, fontFace: BF, fontSize: 12, color: MUTED, align: "center", margin: 0, isTextBox: true });
  });
  const th = G.thresholds;
  const dec = [["GO", `≥ ${th.go}`, "2E7D32"], ["GO sous conditions", `≥ ${th.goWithConditions}`, "689F38"], ["Watch list", `≥ ${th.watchList}`, "B45F06"], ["NO_GO", `< ${th.watchList}`, "C62828"]];
  dec.forEach(([l, v, c], i) => {
    const x = 0.5 + i * 2.3;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.95, w: 2.1, h: 0.75, fill: { color: c }, line: { color: c }, rectRadius: 0.06 });
    s.addText([{ text: l, options: { bold: true, breakLine: true } }, { text: `score final ${v}` }], { x, y: 3.95, w: 2.1, h: 0.75, fontFace: BF, fontSize: 12, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText("Avant les seuils : contentieux, alerte bloquante, défaut avéré, donnée décisionnelle absente et critère éliminatoire décident en priorité.", { x: 0.5, y: 4.8, w: 9, h: 0.35, fontFace: BF, fontSize: 11, italic: true, color: MUTED, margin: 0, isTextBox: true });
  footer(s, 3);
  s.addNotes("Score économique = moyenne pondérée des quatre domaines, ajusté par segment et zone, diminué des malus d'alertes, multiplié par le coefficient de la classe réglementaire BAM. La décision suit ensuite une hiérarchie de verrous avant les seuils.");

  // 4 — Circuit
  s = pres.addSlide(); title(s, "Votre place dans le circuit", "Le chargé d'affaires monte et soumet ; la contre-étude et la délégation valident");
  const flow = ["Brouillon\n(vous)", "Avis\nDCA", "Contre-\nétude", "Délé-\ngation", "Comité", "Approuvé\nou rejeté"];
  flow.forEach((t, i) => {
    const x = 0.45 + i * 1.53;
    s.addShape(pres.shapes.CHEVRON, { x, y: 1.5, w: 1.5, h: 0.95, fill: { color: i === 0 ? TERRA : NAVY }, line: { color: WHITE } });
    s.addText(t, { x: x + 0.33, y: 1.5, w: 0.92, h: 0.95, fontFace: BF, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, 0.5, 2.8, 4.35, 2.2); card(s, 5.15, 2.8, 4.35, 2.2);
  circleIcon(s, I.check, 0.7, 2.95, 0.45, "2E7D32"); circleIcon(s, I.times, 5.35, 2.95, 0.45, "C62828");
  s.addText("Vous faites", { x: 1.3, y: 2.98, w: 3.4, h: 0.4, fontFace: BF, fontSize: 15, bold: true, color: NAVY, margin: 0, isTextBox: true });
  s.addText("Vous ne faites pas", { x: 5.95, y: 2.98, w: 3.4, h: 0.4, fontFace: BF, fontSize: 15, bold: true, color: NAVY, margin: 0, isTextBox: true });
  const doIt = ["Créer promoteur et projet", "Renseigner le suivi et la saisie", "Synchroniser et calculer le score", "Soumettre ; reprendre un dossier renvoyé", "Exporter le dossier de comité"];
  const dont = ["Valider un score (contre-étude)", "Décider ou approuver (délégation, comité)", "Importer un portefeuille (Risque)", "Modifier le modèle ou les référentiels"];
  s.addText(doIt.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < doIt.length - 1 } })), { x: 0.75, y: 3.5, w: 3.95, h: 1.4, fontFace: BF, fontSize: 12, color: INK, paraSpaceAfter: 3, margin: 0, isTextBox: true });
  s.addText(dont.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < dont.length - 1 } })), { x: 5.4, y: 3.5, w: 3.95, h: 1.4, fontFace: BF, fontSize: 12, color: INK, paraSpaceAfter: 3, margin: 0, isTextBox: true });
  footer(s, 4);
  s.addNotes("Un dossier renvoyé par le directeur de centre ou par la contre-étude revient au statut « Brouillon ». Compléter, recalculer, puis soumettre à nouveau. Chaque transition est tracée avec son auteur.");

  // 5 — Parcours
  s = pres.addSlide(); title(s, "Le parcours en 10 étapes", "De la collecte des pièces à la soumission");
  const et = [["Pièces", "Check-list, annexe A"], ["Promoteur", "Signalétique, groupe"], ["Projet", "Segment, zone, montants"], ["Suivi", "Autorisations, lots, facilités"], ["Saisie", "Wizard 7 étapes, lecture IA"],
    ["Synchroniser", "Données du suivi reportées"], ["Calculer", "Classe, score, provision"], ["Lire", "Encart de lecture du résultat"], ["Compléter", "Pièces, mitigants, conditions"], ["Soumettre", "Avis, contre-étude, décision"]];
  et.forEach(([h, t], i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const x = 0.5 + col * 1.83, y = 1.45 + row * 1.8;
    card(s, x, y, 1.68, 1.55);
    circleNum(s, i + 1, x + 0.59, y + 0.14, 0.5, i === 5 ? TERRA : NAVY);
    s.addText(h, { x: x + 0.08, y: y + 0.72, w: 1.52, h: 0.32, fontFace: BF, fontSize: 13, bold: true, color: NAVY, align: "center", margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.08, y: y + 1.04, w: 1.52, h: 0.42, fontFace: BF, fontSize: 10.5, color: INK, align: "center", valign: "top", margin: 0, isTextBox: true });
  });
  footer(s, 5);
  s.addNotes("L'étape 6, « Synchroniser vers le scoring », est celle que l'on oublie le plus : elle reporte dans la saisie les données calculées à partir du suivi. Sans elle, les critères de la pratique marocaine restent vides et reçoivent la note la plus basse.");

  // 6 — Pièces
  s = pres.addSlide(); title(s, "Les pièces à réunir : six familles", `${PIECES.length} pièces de référence — liste complète et check-list dans le guide Word`);
  const famIcons = { A: I.user, B: I.map, C: I.ruler, D: I.hand, E: I.bank, F: I.warn };
  const keyPieces = { A: "États certifiés 3 ans · références livrées · organigramme du groupe", B: "Certificat de propriété ANCFCC · autorisation de lotir / permis de construire", C: "Business plan · plan de trésorerie MENSUEL · planning · situations visées",
    D: "État des ventes lot par lot · contrats VEFA · financement de chaque acquéreur", E: "Expertise indépendante · garanties · clause de mainlevée (quotité)", F: "Échéancier et impayés · avenants · saisies, jugements" };
  Object.entries(FAMILLES).forEach(([f, lib], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 1.45 + row * 1.85;
    card(s, x, y, 2.9, 1.7);
    circleIcon(s, famIcons[f], x + 0.15, y + 0.15, 0.55, row === 0 && col === 1 ? TERRA : NAVY);
    s.addText(`${f}. ${lib}`, { x: x + 0.8, y: y + 0.12, w: 2.0, h: 0.6, fontFace: BF, fontSize: 12.5, bold: true, color: NAVY, valign: "middle", margin: 0, isTextBox: true });
    s.addText(`${PIECES.filter((p) => p.fam === f).length} pièces`, { x: x + 0.15, y: y + 0.78, w: 2.6, h: 0.25, fontFace: BF, fontSize: 10, color: TERRA, bold: true, margin: 0, isTextBox: true });
    s.addText(keyPieces[f], { x: x + 0.15, y: y + 1.03, w: 2.62, h: 0.6, fontFace: BF, fontSize: 10.5, color: INK, valign: "top", margin: 0, isTextBox: true });
  });
  footer(s, 6);
  s.addNotes("Chaque pièce est datée ; les fraîcheurs recommandées sont dans le guide (par exemple, modèle J de moins de 3 mois, certificat de propriété récent, expertise de moins de 12 mois). La liste est à valider avec la politique de crédit de l'établissement.");

  // 7 — Données décisionnelles
  s = pres.addSlide(); title(s, "Les données décisionnelles", "Sans elles : « Dossier incomplet » — quelle pièce les fournit");
  const allC = G.domains.flatMap((d) => d.criteria);
  G.criticalKeys.forEach((k, i) => {
    const c = allC.find((x) => x.key === k); const a = G.alerts.find((x) => x.key === k);
    const lab = (c ? c.label : a.label).replace(/ \((%|x|jours|mois)\)$/, "");
    const refs = (DONNEES[k]?.pieces ?? []).join(", ");
    const pieceName = PIECES.find((p) => p.id === (DONNEES[k]?.pieces ?? [])[0])?.nom.split(/[:(,]/)[0].trim() ?? "";
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 1.4 + row * 1.2;
    card(s, x, y, 2.9, 1.05);
    s.addText(lab, { x: x + 0.15, y: y + 0.08, w: 2.6, h: 0.42, fontFace: BF, fontSize: 12.5, bold: true, color: NAVY, valign: "middle", margin: 0, isTextBox: true });
    s.addText([{ text: refs + "  ", options: { bold: true, color: TERRA } }, { text: pieceName, options: { color: INK } }], { x: x + 0.15, y: y + 0.52, w: 2.6, h: 0.46, fontFace: BF, fontSize: 10, valign: "top", margin: 0, isTextBox: true });
  });
  s.addText("Impayé, retard de chantier, arrêt : saisir 0 s'il n'y en a pas — vide = dossier incomplet.", { x: 0.5, y: 4.96, w: 8.9, h: 0.28, fontFace: BF, fontSize: 11, italic: true, color: TERRA, margin: 0, isTextBox: true });
  footer(s, 7);
  s.addNotes("Deux de ces données sont aussi des critères éliminatoires : l'apport effectif (jalon signature) et le foncier / autorisations (jalon tirage). Quatre sont des clés d'alerte : couverture de trésorerie, retard de paiement, retard de chantier, arrêt de chantier.");

  // 8 — Pratique marocaine
  s = pres.addSlide(); title(s, "Pratique marocaine : ce qu'apporte la v4", "Autorisations, financement des acquéreurs, désengagement, division des risques");
  card(s, 0.5, 1.4, 4.3, 3.7);
  s.addText("Chaîne d'autorisations", { x: 0.7, y: 1.5, w: 3.9, h: 0.35, fontFace: BF, fontSize: 14, bold: true, color: NAVY, margin: 0, isTextBox: true });
  s.addText(G.auth.map((a, i) => ({ text: a.label + (a.blocksWorks ? "  — bloque les travaux" : ""), options: { bullet: true, breakLine: i < G.auth.length - 1, color: a.blocksWorks ? TERRA : INK, bold: a.blocksWorks } })), { x: 0.7, y: 1.9, w: 3.95, h: 2.6, fontFace: BF, fontSize: 10.5, paraSpaceAfter: 2, valign: "top", margin: 0, isTextBox: true });
  s.addText("Cocher chaque pièce obtenue dans la fiche projet : le pourcentage et le verrou de tirage sont calculés.", { x: 0.7, y: 4.5, w: 3.95, h: 0.5, fontFace: BF, fontSize: 10, italic: true, color: MUTED, margin: 0, isTextBox: true });
  s.addChart(pres.charts.BAR, [{ name: "Facteur", labels: [...G.financing].sort((a, b) => a.factor - b.factor).map((f) => f.label.replace(/ \(.*\)/, "")), values: [...G.financing].sort((a, b) => a.factor - b.factor).map((f) => f.factor) }], {
    x: 5.0, y: 1.35, w: 4.5, h: 3.3, barDir: "bar", chartColors: [TEAL], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: INK, dataLabelFormatCode: "0%",
    showTitle: true, title: "Poids d'une vente selon le financement de l'acquéreur", titleFontSize: 12, titleColor: NAVY, titleFontFace: BF,
    catAxisLabelFontSize: 9.5, catAxisLabelColor: INK, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, valAxisMaxVal: 1.2, valAxisMinVal: 0,
  });
  s.addText("Une réservation non instruite ne vaut que 20 % d'une vente financée.", { x: 5.1, y: 4.7, w: 4.3, h: 0.4, fontFace: BF, fontSize: 11, bold: true, color: TERRA, margin: 0, isTextBox: true });
  footer(s, 8);
  s.addNotes("Nouveaux critères v4 : complétude de la chaîne d'autorisations (D2), ventes sécurisées par le financement de l'acquéreur (D3), quotité de désengagement comparée à l'équilibre (D4). Nouvelles alertes : autorisation de travaux manquante, acquéreurs non financés, mainlevée sous-tarifée, dépassement de la division des risques.");

  // 8 bis — Modèle v5 : programme, tranche, équipements, déblocages
  s = pres.addSlide(); title(s, "Ce qu'apporte la v5", "Région, tranche financée, programme mixte, équipements exigés, déblocages");
  const v5 = [
    [I.map, "Régionalité", "Tension du marché de la région × segment, lue dans le référentiel « Marché régional »."],
    [I.key, "Tranche financée", "Préventes, désistements et encours calculés sur la seule tranche financée ; autonomie vis-à-vis des ouvrages communs."],
    [I.building, "Programme mixte", "Villas, appartements, commerces, bureaux, hôtel : part du CA à écoulement lent ; composante sans preneur."],
    [I.gavel, "Équipements exigés", "Mosquée, école, voirie… : coût non budgété, retard qui bloque la réception."],
    [I.coins, "Déblocages", "Cumul débloqué vs avancement certifié ; plan de tirage vs calendrier."],
    [I.chart, "Trajectoire", "Alerte précoce : −5 pts sur 3 revues ou décision dégradée."],
  ];
  v5.forEach(([img, t, d], i) => {
    const x = 0.5 + (i % 3) * 3.05, y = 1.4 + Math.floor(i / 3) * 1.75;
    card(s, x, y, 2.85, 1.6);
    circleIcon(s, img, x + 0.15, y + 0.15, 0.55, i < 4 ? TEAL : TERRA);
    s.addText(t, { x: x + 0.8, y: y + 0.18, w: 1.95, h: 0.5, fontFace: BF, fontSize: 13, bold: true, color: NAVY, valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: x + 0.15, y: y + 0.78, w: 2.6, h: 0.78, fontFace: BF, fontSize: 10, color: INK, valign: "top", margin: 0, isTextBox: true });
  });
  s.addText("Tout se renseigne dans Suivi › « Programme, tranche financée, équipements » puis « Synchroniser vers le scoring ».", { x: 0.5, y: 4.98, w: 9, h: 0.28, fontFace: BF, fontSize: 11, italic: true, color: TERRA, margin: 0, isTextBox: true });
  footer(s, 9);
  s.addNotes("Nouveaux critères v5 : tension du marché régional, entreprise de travaux, équipements non budgétés, autonomie de la tranche (D2) ; part du CA à écoulement lent, taux de désistement (D3) ; déblocages vs avancement certifié, dépassement du coût à terminaison (D4). Nouvelles alertes : tirages en avance, plan de tirage en retard, équipement en retard conditionnant la réception, composante sans preneur, tranche dépendante d'ouvrages non financés. Une donnée v5 non renseignée est notée au plancher : renseigner avant de re-scorer.");

  // 9 — Où trouver chaque donnée
  s = pres.addSlide(); title(s, "Où trouver chaque donnée : exemples", `Le guide Word couvre les ${allC.length} critères et les ${G.alerts.length} alertes`);
  const ex = ["equity_injected_ratio", "land_permits_status", "pre_sale_rate", "cash_coverage", "gross_margin_pct", "ltv_stressed", "secured_sales_rate", "release_quotity_gap_pts"];
  const rows = [[{ text: "Donnée", options: { bold: true, color: WHITE, fill: { color: NAVY } } }, { text: "Pièces", options: { bold: true, color: WHITE, fill: { color: NAVY } } }, { text: "Comment l'obtenir", options: { bold: true, color: WHITE, fill: { color: NAVY } } }]];
  ex.forEach((k, i) => {
    const c = allC.find((x) => x.key === k);
    const calc = DONNEES[k].calcul.split(". ")[0].replace(/\.$/, "") + ".";
    const fill = { color: i % 2 ? "FFFFFF" : TINT };
    rows.push([{ text: c.label, options: { bold: true, color: NAVY, fill } }, { text: DONNEES[k].pieces.join(", "), options: { color: TERRA, bold: true, fill, align: "center" } }, { text: calc, options: { color: INK, fill } }]);
  });
  s.addTable(rows, { x: 0.5, y: 1.35, w: 9.0, colW: [2.5, 1.1, 5.4], fontFace: BF, fontSize: 10, border: { type: "solid", pt: 0.5, color: "D0D6E2" }, valign: "middle", margin: 0.05 });
  footer(s, 10);
  s.addNotes("Références des pièces : voir la liste P01 à P39 du guide. Exemple : P17 est le plan de trésorerie mensuel du programme ; sans lui, la couverture de trésorerie et l'impasse ne peuvent pas être établies.");

  // 10 — Synchroniser
  s = pres.addSlide(); title(s, "« Synchroniser vers le scoring »", "Un bouton, huit données reportées automatiquement depuis le suivi");
  circleIcon(s, I.sync, 4.25, 1.4, 1.5, TERRA);
  const syn = [[I.chart, "Préventes et ventes", "depuis les lots"], [I.hard, "Avancement vs planning", "depuis les visites"], [I.key, "Chaîne d'autorisations", "pièces cochées"], [I.hand, "Ventes sécurisées", "financement des acquéreurs"],
    [I.coins, "Quotité vs équilibre", "quotité + encours"], [I.bank, "Division des risques", "exposition du groupe"], [I.cal, "Retard de paiement", "échéancier des facilités"], [I.gavel, "Arrêt, litige, saisie…", "journal d'événements"]];
  syn.forEach(([ic, h, t], i) => {
    const left = i < 4; const k = i % 4;
    const x = left ? 0.5 : 6.2, y = 1.35 + k * 0.92;
    circleIcon(s, ic, x, y, 0.55, NAVY);
    s.addText(h, { x: x + 0.7, y: y - 0.02, w: 2.6, h: 0.3, fontFace: BF, fontSize: 12.5, bold: true, color: NAVY, margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.7, y: y + 0.27, w: 2.6, h: 0.28, fontFace: BF, fontSize: 11, color: MUTED, margin: 0, isTextBox: true });
  });
  s.addText("Puis « Enregistrer & calculer ». Une valeur reportée remplace la saisie manuelle.", { x: 3.7, y: 3.15, w: 2.4, h: 1.1, fontFace: BF, fontSize: 11.5, color: INK, align: "center", valign: "top", margin: 0, isTextBox: true });
  footer(s, 11);
  s.addNotes("La synchronisation se lance depuis le suivi du projet. Elle affiche la liste des valeurs reportées et leur justification. Sans fonds propres paramétrés par la Direction des risques, le contrôle de division des risques n'est pas effectué et le message le signale.");

  // 11 — Lire le résultat
  s = pres.addSlide(); title(s, "Lire le résultat", "Fiche projet › Scoring › « Lecture du résultat »");
  const hier = [["1", "Contentieux (CTX)", "NO_GO — score 0"], ["2", "Alerte bloquante : impayé ≥ 90 j, arrêt ≥ 12 mois, contentieux", "NO_GO — souffrance"], ["3", "Classe en défaut", "NO_GO — défaut avéré"], ["4", "Donnée décisionnelle absente", "DOSSIER INCOMPLET"], ["5", "Critère éliminatoire franchi", "NO_GO + condition"], ["6", "Sinon : seuils 75 / 65 / 50", "GO · sous conditions · watch · NO_GO"]];
  hier.forEach(([n, sit, d], i) => {
    const y = 1.4 + i * 0.6;
    circleNum(s, n, 0.5, y + 0.04, 0.42, i < 5 ? NAVY : TEAL, 12);
    s.addText(sit, { x: 1.05, y, w: 3.4, h: 0.5, fontFace: BF, fontSize: 11.5, color: INK, valign: "middle", margin: 0, isTextBox: true });
    s.addText(d, { x: 4.4, y, w: 1.9, h: 0.5, fontFace: BF, fontSize: 10.5, bold: true, color: i === 3 ? MUTED : i === 5 ? TEAL : "C62828", valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, 6.55, 1.4, 2.95, 3.55, NAVY);
  s.addText("L'encart affiche", { x: 6.75, y: 1.5, w: 2.6, h: 0.35, fontFace: BF, fontSize: 14, bold: true, color: "F2B8A6", margin: 0, isTextBox: true });
  const aff = ["Version du modèle (alerte si retirée)", "Classe interne", "Score brut, ajustements, malus, coefficient BAM", "Notes économique et de sûretés", "Données manquantes en clair", "Conditions et jalon de levée", "Retour en comité requis", "PD indicative (non calibrée)"];
  s.addText(aff.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < aff.length - 1 } })), { x: 6.75, y: 1.9, w: 2.6, h: 2.95, fontFace: BF, fontSize: 11, color: WHITE, paraSpaceAfter: 3, valign: "top", margin: 0, isTextBox: true });
  footer(s, 12);
  s.addNotes("La hiérarchie est appliquée dans cet ordre : un contentieux l'emporte sur tout ; un dossier incomplet n'est jamais noté favorablement ; les seuils ne jouent qu'en dernier.");

  // 12 — Que faire
  s = pres.addSlide(); title(s, "Que faire selon le résultat", "Chaque situation appelle une action précise");
  const act = [["Dossier incomplet", "Réunir la pièce, saisir la valeur (0 si « aucun »), synchroniser, recalculer.", I.search],
    ["Condition à lever", "Apport ou foncier : indiquer la pièce attendue et sa date ; aucun tirage avant la levée.", I.key],
    ["Alerte avec malus", "Documenter le mitigant : garantie, apport complémentaire, calendrier.", I.warn],
    ["Retour en comité", "Restructuration, retard ≥ 6 mois, mainlevée sous-tarifée, division des risques : préparer le passage.", I.gavel]];
  act.forEach(([h, t, ic], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6, y = 1.4 + row * 1.85;
    card(s, x, y, 4.4, 1.65);
    circleIcon(s, ic, x + 0.2, y + 0.25, 0.65, i === 0 ? TERRA : NAVY);
    s.addText(h, { x: x + 1.05, y: y + 0.2, w: 3.2, h: 0.4, fontFace: BF, fontSize: 15, bold: true, color: NAVY, margin: 0, isTextBox: true });
    s.addText(t, { x: x + 1.05, y: y + 0.62, w: 3.2, h: 0.95, fontFace: BF, fontSize: 12, color: INK, valign: "top", margin: 0, isTextBox: true });
  });
  footer(s, 13);
  s.addNotes("Score marqué « version retirée » : il a été calculé avec une ancienne version du modèle. Relancer le calcul avant tout passage en comité.");

  // 13 — Suivi
  s = pres.addSlide(); title(s, "Le suivi après octroi", "Revues périodiques et événements");
  const rv = [[G.review.SAIN, "jours", "créance saine"], [G.review.SENSIBLE, "jours", "créance sensible"], [G.review.PRE_DOUTEUX, "jours", "créance en souffrance"]];
  rv.forEach(([v, u, l], i) => {
    const x = 0.5 + i * 3.05;
    card(s, x, 1.4, 2.9, 1.45);
    s.addText(String(v), { x, y: 1.45, w: 2.9, h: 0.8, fontFace: HF, fontSize: 40, bold: true, color: i === 2 ? TERRA : NAVY, align: "center", margin: 0, isTextBox: true });
    s.addText(`${u} — ${l}`, { x, y: 2.25, w: 2.9, h: 0.4, fontFace: BF, fontSize: 12, color: INK, align: "center", margin: 0, isTextBox: true });
  });
  s.addText("Événements imposant un retour en comité (et un nouveau calcul)", { x: 0.5, y: 3.05, w: 9, h: 0.35, fontFace: BF, fontSize: 14, bold: true, color: NAVY, margin: 0, isTextBox: true });
  const evc = G.events.filter((e) => e.committee).map((e) => e.label.replace(/ \(.*\)/, ""));
  evc.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * 3.05, y = 3.5 + row * 0.5;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.9, h: 0.4, fill: { color: "FBE9E5" }, line: { color: "FBE9E5" }, rectRadius: 0.06 });
    s.addText(t, { x: x + 0.1, y, w: 2.7, h: 0.4, fontFace: BF, fontSize: 10.5, color: "8A2E1C", valign: "middle", margin: 0, isTextBox: true });
  });
  footer(s, 14);
  s.addNotes("Chaque tirage travaux s'appuie sur une situation de travaux visée par l'architecte ou le BET. Un verrou d'autorisation ouvert interdit le tirage. La fiche projet indique la fraîcheur du score et la prochaine échéance de revue.");

  // 14 — Excel
  s = pres.addSlide(); title(s, "L'outil Excel, hors application", "Même calcul que l'application — vérifié sur 26 cas de référence");
  const xs = [["Nouveau dossier", "vide la saisie et les calculateurs"], ["Saisie", "cellules jaunes ; vide = absent"], ["Calculateurs", "autorisations, ventes sécurisées, quotité, division des risques, arrêt"], ["Résultat", "décision, données manquantes, conditions"], ["Stress test", "prix, coût, retard, ventes, taux"], ["Export PDF", "à joindre à la note"]];
  xs.forEach(([h, t], i) => {
    const y = 1.4 + i * 0.6;
    circleNum(s, i + 1, 0.5, y + 0.02, 0.44, NAVY, 13);
    s.addText([{ text: h + "  ", options: { bold: true, color: NAVY } }, { text: t, options: { color: INK } }], { x: 1.1, y, w: 5.0, h: 0.48, fontFace: BF, fontSize: 12.5, valign: "middle", margin: 0, isTextBox: true });
  });
  card(s, 6.5, 1.4, 3.0, 3.45, TINT);
  circleIcon(s, I.file, 7.55, 1.6, 0.9, TEAL);
  s.addText("20 / 20", { x: 6.5, y: 2.6, w: 3.0, h: 0.6, fontFace: HF, fontSize: 30, bold: true, color: TEAL, align: "center", margin: 0, isTextBox: true });
  s.addText("cas de référence conformes ; macros exécutées de bout en bout. La décision officielle se prend dans l'application.", { x: 6.7, y: 3.2, w: 2.6, h: 1.5, fontFace: BF, fontSize: 11.5, color: INK, align: "center", valign: "top", margin: 0, isTextBox: true });
  footer(s, 15);
  s.addNotes("Usage : simulation, préparation de comité, travail hors connexion, formation. Au premier usage, importer les macros et installer les boutons (onglet LisezMoi du classeur).");

  // 15 — À faire / à éviter
  s = pres.addSlide(); title(s, "À faire, à éviter", "Les erreurs qui faussent une note");
  const doL = ["Laisser vide une donnée inconnue et réunir la pièce", "Saisir 0 quand il n'y a vraiment ni impayé, ni retard", "Synchroniser juste avant chaque calcul", "Valeur d'expertise indépendante pour la LTV", "Déclarer tous les liens du groupe"];
  const dontL = ["Saisir 0 « pour avancer »", "Compter un apport promis comme injecté", "Segment ou zone hors des listes du modèle", "Appliquer la lecture IA sans vérifier", "Présenter un score « version retirée »"];
  [[doL, "2E7D32", I.check, "À faire"], [dontL, "C62828", I.times, "À éviter"]].forEach(([L, c, ic, h], j) => {
    const x = 0.5 + j * 4.6;
    card(s, x, 1.4, 4.4, 3.6);
    circleIcon(s, ic, x + 0.2, 1.55, 0.5, c);
    s.addText(h, { x: x + 0.85, y: 1.58, w: 3.3, h: 0.45, fontFace: BF, fontSize: 16, bold: true, color: c, margin: 0, isTextBox: true });
    s.addText(L.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < L.length - 1 } })), { x: x + 0.3, y: 2.2, w: 3.9, h: 2.7, fontFace: BF, fontSize: 12.5, color: INK, paraSpaceAfter: 6, valign: "top", margin: 0, isTextBox: true });
  });
  footer(s, 16);
  s.addNotes("Rappel : chaque valeur doit pouvoir être justifiée par une pièce datée lors de la contre-étude.");

  // 16 — Clôture
  s = pres.addSlide(); s.background = { color: NAVY };
  s.addText("Votre check-list", { x: 0.6, y: 1.4, w: 8.8, h: 0.8, fontFace: HF, fontSize: 36, bold: true, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Annexe A du guide Word : les pièces à cocher et à dater, famille par famille.", { x: 0.6, y: 2.25, w: 8.8, h: 0.5, fontFace: BF, fontSize: 16, color: "F2B8A6", margin: 0, isTextBox: true });
  s.addText("Section 5 du guide : pour chaque donnée, l'étape de saisie, la pièce, le calcul, le barème et le point d'attention.", { x: 0.6, y: 2.9, w: 8.8, h: 0.6, fontFace: BF, fontSize: 14, color: WHITE, margin: 0, isTextBox: true });
  s.addText("Questions ?", { x: 0.6, y: 4.2, w: 8.8, h: 0.6, fontFace: HF, fontSize: 26, bold: true, color: ICE, margin: 0, isTextBox: true });
  s.addNotes("Distribuer le guide Word et le classeur Excel. Premier exercice proposé : monter le dossier d'exemple du classeur, lire le résultat, puis lancer le stress test.");

  await pres.writeFile({ fileName: OUT });
  console.log("OK", OUT);
})();
