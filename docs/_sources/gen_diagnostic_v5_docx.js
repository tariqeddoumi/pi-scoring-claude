// Génère « Diagnostic du modèle v5 » : régionalité, tranche financée, programme
// mixte, équipements exigés, suivi des déblocages, et autres améliorations.
// Les poids, barèmes et alertes sont lus dans les instantanés v4 et v5 ; l'impact
// portefeuille dans impact_v5.json (moteur de l'application sur les données de la base).
// Usage (racine du dépôt) : node docs/_sources/gen_diagnostic_v5_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, PageBreak, TableOfContents, PageNumber, Footer, Header, LevelFormat,
} = require("docx");
const snap = (v) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "prisma", "models", `PI_PROMOTION_${v}.json`), "utf8"));
const V4 = snap("v4.0.0"), V5 = snap("v5.0.0");
const IMPACT = JSON.parse(fs.readFileSync(path.join(__dirname, "impact_v5.json"), "utf8"));
const VEC = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "tools", "excel", "_build", "vectors.json"), "utf8"));
const OUT = path.join(__dirname, "..", "Diagnostic_Modele_v5_Regionalite_Tranches_Equipements_Deblocages.docx");

const NAVY = "1F3864", BLUE = "2E5496", LIGHT = "D9E1F2", ZEBRA = "F2F5FB", GREY = "595959", CRIT = "C00000", WARN = "B45F06", OKG = "2E7D32";
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
  width: { size: o.w, type: WidthType.DXA }, columnSpan: o.span, verticalAlign: o.v,
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
// Tableau simple : lignes de textes, zébrées.
const grid = (head, rows, w, o = {}) => table(head, rows.map((r, i) => r.map((x, j) => cell(x, { w: w[j], bg: i % 2 ? ZEBRA : undefined, bold: (o.boldCols ?? [0]).includes(j), align: (o.center ?? []).includes(j) ? AlignmentType.CENTER : undefined, color: o.color?.(i, j, x) }))), w);
const box = (titre, texte, color = BLUE, fill = "EEF3FB") => new Table({ columnWidths: [9638], width: { size: 9638, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color }, bottom: { style: BorderStyle.SINGLE, size: 4, color }, left: { style: BorderStyle.SINGLE, size: 4, color }, right: { style: BorderStyle.SINGLE, size: 4, color }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: 9638, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill, color: "auto" }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [new Paragraph({ spacing: { after: 40 }, children: [T(titre, { bold: true, color })] }), ...(Array.isArray(texte) ? texte : [texte]).map((t) => new Paragraph({ spacing: { after: 40, line: 276 }, children: [T(t)] }))] })] })] });

// ------------------------------------------------------------ données
const crit = (M) => M.domains.flatMap((d) => d.criteria.map((c) => ({ ...c, dom: d })));
const C4 = crit(V4), C5 = crit(V5);
const NEWC = C5.filter((c) => !C4.some((x) => x.code === c.code));
const NEWF = V5.redFlags.filter((r) => !V4.redFlags.some((x) => x.code === r.code));
const byCode = (code) => C5.find((c) => c.code === code);
const flag = (code) => V5.redFlags.find((r) => r.code === code);
const scaleTxt = (c) => c.type === "QUAL"
  ? [...c.options].sort((a, b) => a.orderIndex - b.orderIndex).map((o) => `${o.label} → ${o.score}`).join(" ; ")
  : [...c.ranges].sort((a, b) => a.orderIndex - b.orderIndex).map((r) => `${r.label.replace(/^\s+|\s+$/g, "")} → ${r.score}`).join(" ; ");
const critLine = (code) => { const c = byCode(code); return [T(`${c.code} — ${c.name}`, { bold: true }), T(` (poids ${pct(c.weight)} du domaine ${c.dom.code}, soit ${pct(c.weight * c.dom.weight)} du score) : `), T(scaleTxt(c), { size: 19 })]; };
const flagLine = (code) => { const r = flag(code); return [T(`${r.code} — ${r.name}`, { bold: true }), T(` : malus ${r.malus} pts${r.requiresCommittee ? ", retour en comité" : ""}. `), T(r.description, { size: 19 })]; };
const DEC = { GO: "GO", GO_WITH_CONDITIONS: "GO sous conditions", WATCH_LIST: "Watch list", NO_GO: "NO_GO", DOSSIER_INCOMPLET: "Dossier incomplet" };

// Effet « données v5 absentes » (dossiers dont le score v4 est non nul).
const drops = IMPACT.filter((r) => r.v4.score > 0).map((r) => r.v4.score - r.v5_brut.score);
const dropMin = Math.floor(Math.min(...drops)), dropMax = Math.ceil(Math.max(...drops));
const dropAvg = fr(Math.round((drops.reduce((a, b) => a + b, 0) / drops.length) * 10) / 10);
const nDown = IMPACT.filter((r) => r.v5_brut.decision !== r.v4.decision).length;

// ------------------------------------------------------------ couverture
const cover = [
  new Paragraph({ spacing: { before: 1800 }, alignment: AlignmentType.CENTER, children: [T("DIAGNOSTIC DU MODÈLE DE SCORING", { bold: true, size: 44, color: NAVY })] }),
  new Paragraph({ spacing: { before: 80 }, alignment: AlignmentType.CENTER, children: [T("Promotion immobilière — passage à la version 5.0.0", { bold: true, size: 30, color: BLUE })] }),
  new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 12, color: LIGHT, space: 8 } }, children: [T("", { size: 2 })] }),
  new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, children: [T("Régionalité · financement d'une tranche · programme mixte · équipements exigés · suivi des déblocages selon le calendrier", { italics: true, size: 25, color: GREY })] }),
  new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER, children: [T(`${C5.length} critères (${NEWC.length} nouveaux) · ${V5.redFlags.length} alertes (${NEWF.length} nouvelles) · poids des domaines inchangés`, { bold: true, size: 22, color: NAVY })] }),
  new Paragraph({ spacing: { before: 40 }, alignment: AlignmentType.CENTER, children: [T("1er octobre 2026 — version publiée en base (ver_5), v4 retirée", { size: 20, color: GREY })] }),
  brk(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Sommaire" })] }),
  new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-2" }),
  brk(),
];

// ------------------------------------------------------------ 1. synthèse
const s1 = [H1("1. Synthèse")];
s1.push(P("Le projet ou le programme est re-scoré régulièrement pour suivre le risque. Le diagnostic a vérifié si le modèle v4 tenait compte de cinq réalités du financement de la promotion immobilière au Maroc, et ce qu'il fallait ajouter. Réponse : aucune des cinq n'était intégrée au score ; deux l'étaient partiellement dans les données (tranches, planning des déblocages) sans effet sur la note. La v5 les intègre, avec trois autres améliorations."));
s1.push(grid(["Thème", "Situation en v4", "Ce que fait la v5"], [
  ["1. Régionalité", "Ajustement fixe par zone (β), non daté, sans lien avec le segment. Région du projet saisie de façon hétérogène (libellés et codes).", "Critère D2C9 « Tension du marché régional » lu dans un référentiel daté région × segment. Régions normalisées en base."],
  ["2. Financement d'une tranche", "Tranches suivies, mais tout le score portait sur le programme entier. Facilités non rattachées aux tranches.", "Périmètre financé : préventes, désistements, composition, encours et déblocages calculés sur la tranche financée. Critère D2C12 et alerte RF_TRANCHE_DEPENDANTE."],
  ["3. Programme mixte", "Un seul segment par projet ; pas de type « hôtel » ; liquidité des commerces et de l'hôtel non distinguée.", "Type de lot « Hôtel ». Critère D3C9 « Part du CA à écoulement lent ». Alerte RF_COMPOSANTE_SANS_PRENEUR."],
  ["4. Équipements exigés", "Absents (ni donnée, ni critère).", "Registre des équipements (mosquée, école, voirie…). Critère D2C11 « Équipements non budgétés ». Alerte RF_EQUIPEMENT_RECEPTION."],
  ["5. Déblocages vs calendrier", "Planning des déblocages et situations de travaux saisis, sans effet sur le score.", "Critère D4C8 « Déblocages vs avancement certifié ». Alertes RF_TIRAGE_AVANCE et RF_PLAN_TIRAGE_RETARD. Trajectoire du score avec alerte précoce."],
  ["Autres", "—", "Entreprise de travaux (D2C10), taux de désistement (D3C10), dépassement du coût à terminaison (D4C9)."],
], [2000, 3600, 4038]));
s1.push(P("", { after: 80 }));
s1.push(box("Point d'attention avant tout recalcul du portefeuille", [
  `Une donnée absente est notée au plancher, par construction. Re-scorer un dossier en v5 sans avoir renseigné les nouvelles données lui fait perdre ${dropMin} à ${dropMax} points (${dropAvg} en moyenne) : ${nDown} décisions sur ${IMPACT.length} projets se dégraderaient mécaniquement (section 10).`,
  "Il faut donc renseigner les données v5 de chaque dossier (carte « Programme » du suivi, puis « Synchroniser vers le scoring ») avant de le re-scorer. Le recalcul global du portefeuille n'a pas été lancé.",
], CRIT, "FBE4E1"));

// ------------------------------------------------------------ 2. méthode
const s2 = [brk(), H1("2. Méthode et principes conservés")];
s2.push(P("Le diagnostic part de la version publiée en base (ver_4), du code de l'application et du schéma de données. Chaque thème est traité de la même façon : constat sur la v4, risque non couvert, réponse retenue, calcul et saisie, limites."));
s2.push(H2("Principes de conception de la v5"));
[
  "Les barèmes, modalités, critères éliminatoires et alertes de la v4 sont inchangés ; un test automatique le vérifie.",
  "Les poids des quatre domaines sont inchangés (D1 25 %, D2 20 %, D3 31 %, D4 24 %). Au sein de chaque domaine, les poids sont rééquilibrés pour faire place aux nouveaux critères (section 9).",
  "Une donnée absente reste notée au plancher, jamais à une valeur neutre.",
  "Les nouvelles données ne sont pas « décisionnelles » : leur absence abaisse la note sans rendre le dossier incomplet. Les alertes v5 utilisent des règles Oui/Non ou d'égalité, pour la même raison.",
  "Aucune donnée de marché n'est inventée : le référentiel régional est vide tant que la Direction des risques ne l'a pas rempli.",
  "Ce qui peut être calculé l'est automatiquement à partir du suivi (lots, tranches, facilités, planning, équipements). Ce qui relève du jugement reste une saisie motivée.",
].forEach((t) => s2.push(bullet(t)));

// ------------------------------------------------------------ 3..7 thèmes
const theme = (n, titre, constat, risque, reponse, calcul, limites) => {
  const out = [brk(), H1(`${n}. ${titre}`), H2("Constat sur la v4")];
  constat.forEach((t) => out.push(bullet(t)));
  out.push(H2("Risque non couvert"), P(risque), H2("Réponse v5"));
  reponse.forEach((r) => out.push(bullet(r)));
  out.push(H2("Calcul et saisie"));
  calcul.forEach((t) => out.push(bullet(t)));
  out.push(H2("Limites"));
  limites.forEach((t) => out.push(bullet(t)));
  return out;
};
const z = V5.zoneAdjustments;
const s3 = theme(3, "Régionalité",
  [`Le modèle applique un ajustement fixe par zone (β) au score économique : ${Object.entries(z).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${fr(Math.round(v * 100))} %`).join(", ")}.`,
    "Cet ajustement n'est ni daté, ni différencié par segment : Marrakech est pénalisée de 7 % qu'il s'agisse de logement social ou de villas, en 2024 comme en 2026.",
    "La région administrative du projet était saisie tantôt en libellé (« Casablanca-Settat »), tantôt en code (« casablanca_settat ») : 8 des 12 projets en base portaient un libellé. Les valeurs ont été normalisées en codes."],
  "Un même programme ne s'écoule pas au même rythme selon la région et le segment, et la tension d'un marché évolue. Un ajustement figé ne capte ni le surstock d'un segment dans une région, ni son retournement.",
  [critLine("D2C9"), [T("Référentiel « Marché régional » (Administration › Référentiels) : pour chaque région, une tension par segment, une valeur par défaut et la date de l'appréciation.")]],
  ["La synchronisation lit la région du projet (libellé ou code, avec ou sans accents), puis la tension de son segment, sinon la valeur par défaut de la région.",
    "Une appréciation de plus de 12 mois est signalée « périmée » dans la carte Programme.",
    "Région absente du référentiel ou non reconnue : donnée absente, note plancher. Le chargé d'affaires peut aussi saisir la tension au vu d'une étude de marché régionale."],
  ["Le référentiel est vide à la publication : tant qu'il n'est pas rempli, ce critère est au plancher pour tous les dossiers (voir section 11).",
    "L'ajustement β par zone est conservé : les deux mesures coexistent. Une révision de β est à envisager une fois le référentiel régional alimenté, pour éviter de compter deux fois le même effet."]);

const s4 = theme(4, "Financement d'une tranche et non du programme entier",
  ["Les tranches existaient (code, avancement, budget, lots), mais toutes les données du score — préventes, ventes, encours — portaient sur le programme entier.",
    "Une facilité n'était rattachée à aucune tranche : impossible de savoir quelle partie du programme la banque finance.",
    "Rien n'appréciait la dépendance d'une tranche aux ouvrages communs (accès, VRD, raccordements) réalisés dans d'autres tranches."],
  "Quand la banque ne finance que la tranche 2, les préventes de la tranche 1 déjà livrée gonflent artificiellement le taux de prévente. Et une tranche « bien vendue » peut rester invendable si la voirie qui la dessert relève d'une tranche non financée.",
  [critLine("D2C12"), flagLine("RF_TRANCHE_DEPENDANTE")],
  ["Dans la carte « Programme » du suivi : cocher les tranches financées et rattacher chaque facilité à sa tranche. Sans indication, le programme entier est considéré financé (comportement v4).",
    "Le périmètre financé = tranches cochées + tranches portées par une facilité. La synchronisation y restreint le taux de prévente, les désistements, la composition, l'encours et le contrôle des déblocages.",
    "Programme entier financé : l'autonomie est renseignée automatiquement (« programme entier », note 10). Tranche financée : le chargé d'affaires choisit la modalité."],
  ["L'autonomie de la tranche reste un jugement, appuyé sur le plan de masse et le plan de financement des ouvrages communs.",
    "Les lots non rattachés à une tranche ne peuvent pas être affectés au périmètre : il faut les rattacher."]);

const s5 = theme(5, "Programme mixte : villas, appartements, commerces, hôtel…",
  ["Un projet n'a qu'un segment (social, intermédiaire, moyen-haut, villas, bureaux, commerces, touristique) et l'ajustement α s'applique à tout le programme.",
    "Les lots connaissaient les types appartement, villa, commerce, bureau, terrain, autre ; pas d'hôtel.",
    "Rien ne distinguait la vitesse d'écoulement des composantes."],
  "Dans un programme mixte, les commerces, les bureaux et surtout l'hôtel se vendent plus lentement que les logements, souvent en bloc et à un acquéreur unique. Un programme à 40 % de chiffre d'affaires hôtelier sans opérateur engagé n'a pas le même risque de sortie qu'un programme résidentiel.",
  [critLine("D3C9"), flagLine("RF_COMPOSANTE_SANS_PRENEUR"), [T("Nouveau type de lot « Hôtel » (composante hôtelière cédée en bloc ou exploitée).")]],
  ["La part à écoulement lent = prix des commerces, bureaux et composantes hôtelières / prix de tous les lots du périmètre financé (prix de vente, sinon prix catalogue, sinon prix prévisionnel).",
    "La carte Programme affiche la composition par classe (résidentiel, commercial, hôtelier).",
    "L'alerte « composante sans preneur » est une saisie du chargé d'affaires, au vu des engagements écrits (lettre d'un opérateur, d'un investisseur ou de preneurs)."],
  ["Le segment reste unique par projet : l'ajustement α ne se pondère pas par composante. Une pondération par composante est une évolution possible (v5.1).",
    "Le seuil de 20 % / 40 % est un choix d'expert à valider."]);

const s6 = theme(6, "Équipements exigés : mosquée, école, voirie…",
  ["Aucune donnée ni aucun critère ne portait sur les équipements que la commune, le cahier des charges du lotissement ou l'autorisation imposent au promoteur.",
    "La chaîne d'autorisations (v4) suit la réception et le permis d'habiter, mais pas les ouvrages qui les conditionnent."],
  "Une mosquée ou une école exigée et non budgétée consomme la marge ; si elle conditionne la réception, son retard bloque le permis d'habiter, donc les actes de vente, les encaissements et les mainlevées.",
  [critLine("D2C11"), flagLine("RF_EQUIPEMENT_RECEPTION"), [T("Registre des équipements par projet : type, libellé, origine de l'obligation, coût estimé, financeur, budgété ou non, tranche, échéance, avancement, conditionne la réception, remis à la commune.")]],
  ["Déclaration en trois états : non déclarée (donnée absente, note plancher), « aucun équipement exigé » (0 %, favorable), ou liste. Saisir un équipement vaut déclaration.",
    "% non budgété = coût des équipements non budgétés et à la charge du programme / coût total du programme. Un équipement financé par la commune ou l'État est exclu. Un coût manquant laisse la donnée absente.",
    "Retard : un équipement qui conditionne la réception, non remis, dont l'échéance est passée avant achèvement, ou dont l'avancement accuse plus de 30 points de retard sur le programme."],
  ["Le seuil de 30 points d'écart d'avancement est une règle de vigilance simple, à affiner avec l'expérience.",
    "Le coût du programme est celui de la fiche projet ; s'il manque, le pourcentage n'est pas calculé."]);

const s7 = theme(7, "Suivi de l'avancement des déblocages selon le calendrier",
  ["Le planning des déblocages du business plan, le rapprochement avec les déblocages réels et les situations de travaux visées existaient depuis la v3, ainsi que le verrou d'autorisation au tirage.",
    "Mais aucun de ces éléments n'alimentait le score : un dossier dont la banque a débloqué 80 % pour 40 % de travaux gardait la même note.",
    "L'historique des scores était affiché sans lecture de tendance."],
  "Un tirage en avance sur les travaux réduit la valeur de la garantie par rapport à l'encours : c'est l'un des premiers signaux d'un détournement de fonds ou d'un chantier en difficulté. À l'inverse, un plan de tirage en retard signale un chantier qui patine. Comme le dossier est re-scoré à chaque revue, ces écarts doivent se voir dans la note et dans sa trajectoire.",
  [critLine("D4C8"), flagLine("RF_TIRAGE_AVANCE"), flagLine("RF_PLAN_TIRAGE_RETARD"),
    [T("Trajectoire du score : ", { bold: true }), T("alerte précoce si le score perd 5 points ou plus sur les 3 derniers calculs ou si la décision se dégrade ; vigilance en cas de baisses consécutives ou d'approche d'un seuil. Un écart dû à un changement de version du modèle est neutralisé.")]],
  ["Déblocages vs avancement = cumul débloqué sur les crédits de travaux / (montant autorisé × avancement certifié) × 100, sur le périmètre financé.",
    "Avancement de référence, dans cet ordre : dernière situation de travaux visée ; avancement des tranches financées (pondéré par leur budget) ; dernière visite de chantier.",
    "Plan de tirage : au moins 25 % du montant prévu à date (jalons échus) non débloqué → alerte.",
    "La carte « Évolution du score » affiche la version du modèle de chaque calcul et le niveau de trajectoire (stable, vigilance, alerte précoce)."],
  ["Le ratio suppose un déblocage proportionnel à l'avancement ; un plan de tirage contractuel non linéaire (avance de démarrage, par exemple) peut justifier un écart : le motiver au comité.",
    "Les seuils de 115 % et 25 % sont des choix de politique de crédit à valider."]);

// ------------------------------------------------------------ 8. autres
const s8 = [brk(), H1("8. Autres améliorations intégrées")];
s8.push(P("Trois risques fréquents dans le financement de la promotion n'étaient pas couverts :"));
s8.push(bullet(critLine("D2C10")));
s8.push(P("Le risque d'achèvement repose sur l'entreprise qui construit : qualification, nature du marché, garanties contractuelles.", { size: 19, italics: true }));
s8.push(bullet(critLine("D3C10")));
s8.push(P("Une prévente qui se désiste n'en était pas une : un taux de désistement qui monte entre deux revues signale des préventes fragiles, même si le taux de prévente reste stable. Calculé automatiquement sur le périmètre financé.", { size: 19, italics: true }));
s8.push(bullet(critLine("D4C9")));
s8.push(P("Un dépassement de coût consomme la marge et l'apport, et crée une impasse de financement.", { size: 19, italics: true }));
s8.push(H2("Corrections faites pendant le diagnostic"));
s8.push(bullet("Sécurité : la mise à jour du financement des acquéreurs pouvait modifier un lot d'un autre projet si son identifiant était fourni ; elle est désormais limitée aux lots du projet."));
s8.push(bullet("Données : régions des projets normalisées en codes (8 projets corrigés)."));

// ------------------------------------------------------------ 9. poids
const s9 = [brk(), H1("9. Le modèle v5 en chiffres")];
s9.push(P(`v4 : ${C4.length} critères, ${V4.redFlags.length} alertes. v5 : ${C5.length} critères, ${V5.redFlags.length} alertes. Poids des domaines inchangés ; poids des critères au sein de chaque domaine :`));
V5.domains.forEach((d) => {
  s9.push(H2(`${d.code} — ${d.name} (${pct(d.weight)} du score)`));
  const rows = d.criteria.map((c) => {
    const old = C4.find((x) => x.code === c.code);
    const delta = old ? Math.round((c.weight - old.weight) * 1000) / 10 : null;
    return [`${c.code} — ${c.name}`, old ? pct(old.weight) : "nouveau", pct(c.weight), delta === null ? "+" + pct(c.weight) : delta === 0 ? "=" : (delta > 0 ? "+" : "") + fr(delta) + " pt"];
  });
  s9.push(grid(["Critère", "Poids v4", "Poids v5", "Écart"], rows, [5638, 1300, 1300, 1400], { center: [1, 2, 3], color: (i, j, x) => (j === 1 && x === "nouveau" ? OKG : undefined) }));
});
s9.push(H2("Alertes ajoutées"));
s9.push(grid(["Alerte", "Déclenchement", "Malus", "Comité"], NEWF.map((r) => [r.name, r.description, String(r.malus), r.requiresCommittee ? "Oui" : "—"]), [2800, 4838, 900, 1100], { center: [2, 3] }));
s9.push(P(`Vérification : le moteur de l'application et l'outil Excel reproduisent les ${VEC.length} cas de référence, dont 6 nouveaux cas v5 (tranche dépendante, tirages en avance, mosquée en retard, programme mixte, marché en surstock avec désistements et plan de tirage en retard, données v5 absentes).`, { before: 100, italics: true, size: 19 }));

// ------------------------------------------------------------ 10. impact
const s10 = [brk(), H1("10. Impact simulé sur le portefeuille")];
s10.push(P(`Les ${IMPACT.length} projets de promotion de la base ont été recalculés hors ligne, avec le moteur de l'application, sur leurs données actuelles et leur classe réglementaire : en v4 ; en v5 sans les nouvelles données (situation au lendemain de la publication) ; en v5 avec des données v5 « saines » (programme entier, marché équilibré, entreprise qualifiée, aucun équipement exigé, tirages en phase, désistements 5 %, dépassement 2 %). Aucun score n'a été enregistré.`));
const col = (d) => (d === "GO" ? OKG : d === "GO_WITH_CONDITIONS" ? "5F8D2B" : d === "WATCH_LIST" ? WARN : CRIT);
s10.push(table(["Projet", "Classe", "v4", "v5 sans données v5", "v5 données saines"], IMPACT.map((r, i) => {
  const bg = i % 2 ? ZEBRA : undefined;
  const sc = (x) => [[T(fr(x.score), { bold: true, size: 18 }), T("  " + DEC[x.decision], { size: 16, color: col(x.decision) })]];
  return [cell([[T(r.ref, { bold: true, size: 17 })], [T(r.name, { size: 16, color: GREY })]], { w: 2900, bg }), cell(r.cls, { w: 1300, bg, size: 16 }),
    cell(sc(r.v4), { w: 1800, bg }), cell(sc(r.v5_brut), { w: 1838, bg }), cell(sc(r.v5_renseigne), { w: 1800, bg })];
}), [2900, 1300, 1800, 1838, 1800]));
const live = IMPACT.filter((r) => r.v4.score > 0);
const avg = (f) => Math.round((live.reduce((s, r) => s + f(r), 0) / live.length) * 10) / 10;
const downg = IMPACT.filter((r) => r.v5_brut.decision !== r.v4.decision).length;
const upg = IMPACT.filter((r) => r.v5_renseigne.decision !== r.v4.decision);
s10.push(P("", { after: 60 }));
s10.push(H2("Lecture"));
s10.push(bullet(`Sans les données v5, les scores perdent en moyenne ${fr(Math.abs(avg((r) => r.v5_brut.score - r.v4.score)))} points (hors dossiers à 0) et ${downg} décisions se dégradent. Ce n'est pas un risque nouveau, c'est l'effet voulu de la règle « donnée absente = note plancher ».`));
s10.push(bullet(`Avec des données v5 saines, les scores varient de ${fr(avg((r) => r.v5_renseigne.score - r.v4.score))} point en moyenne ; ${upg.length} décision(s) change(nt) (${upg.map((r) => `${r.ref} : ${DEC[r.v4.decision]} → ${DEC[r.v5_renseigne.decision]}`).join(" ; ")}), sous l'effet du rééquilibrage des poids au sein des domaines.`));
s10.push(bullet("Les dossiers en contentieux ou en défaut avéré restent à NO_GO : les verrous de décision sont inchangés."));
s10.push(bullet("Les dossiers de démonstration partagent les mêmes données de base ; l'impact sur un portefeuille réel dépendra des données v5 effectivement saisies."));

// ------------------------------------------------------------ 11. mise en oeuvre
const s11 = [brk(), H1("11. Mise en œuvre")];
s11.push(H2("Réalisé"));
[
  "Base de données : migration v5 appliquée (tranche financée, facilité rattachée à une tranche, registre des équipements, type de lot « Hôtel », déclaration des équipements), inscrite dans l'historique des migrations.",
  "Modèle : version v5.0.0 publiée (ver_5), contrôlée identique à l'instantané du dépôt ; v4 retirée. Les calculs v4 existants conservent leur version.",
  "Écrans : carte « Programme, tranche financée, équipements et déblocages » dans le suivi ; onglet « Programme » de la fiche projet ; étape « Programme » de la saisie ; colonnes d'import ; référentiel « Marché régional » ; trajectoire du score.",
  "Synchronisation : les données v5 sont calculées depuis le suivi, sur le périmètre financé ; ce qui est affiché dans la carte est exactement ce qui est reporté dans le score.",
  "Contrôles : 361 tests automatiques, dont l'alignement modèle ↔ saisie ↔ validation ↔ import et les 26 cas de référence.",
  "Livrables : grilles de scoring v5 (Word), guide du chargé d'affaires et support de formation mis à jour, outil Excel/VBA 5.0 (vérifié sous LibreOffice : formules 26/26, calculateurs v5 10/10, macros et stress conformes).",
].forEach((t) => s11.push(bullet(t)));
s11.push(H2("À faire par la banque, dans cet ordre"));
s11.push(grid(["#", "Action", "Responsable"], [
  ["1", "Remplir le référentiel « Marché régional » (12 régions × segments, date d'appréciation) et le revoir au moins une fois par an.", "Direction des risques"],
  ["2", "Pour chaque dossier : cocher la tranche financée et rattacher les facilités ; déclarer les équipements exigés (ou « aucun ») ; renseigner l'entreprise de travaux, le coût à terminaison et, le cas échéant, l'autonomie de la tranche et les composantes sans preneur.", "Chargés d'affaires"],
  ["3", "« Synchroniser vers le scoring », vérifier la carte Programme, puis re-scorer le dossier.", "Chargés d'affaires"],
  ["4", "Une fois les dossiers renseignés : recalculer le portefeuille (Administration › Modèle).", "Direction des risques"],
  ["5", "Faire valider par le comité des risques les poids et seuils v5 (choix d'expert), puis suivre leur pouvoir de discrimination dans le temps.", "Comité des risques"],
  ["6", "Recette de l'outil Excel 5.0 sous Excel (import des macros, autotests 26/26).", "Direction des risques"],
], [500, 7338, 1800], { center: [0] }));
s11.push(H2("Limites générales"));
[
  "Les poids et seuils v5 sont des choix d'expert : aucune calibration statistique n'est possible sans historique de défauts.",
  "La PD reste indicative.",
  "Le segment reste unique par projet ; la pondération par composante d'un programme mixte est une évolution possible.",
].forEach((t) => s11.push(bullet(t)));

// ------------------------------------------------------------ annexe
const SRC = {
  regional_market_tension: ["Référentiel « Marché régional »", "Auto (synchronisation) ou saisie"],
  contractor_quality: ["Marché de travaux", "Saisie"],
  equipment_unbudgeted_pct: ["Registre des équipements", "Auto"],
  tranche_dependency: ["Plan de masse, tranches", "Auto si programme entier, sinon saisie"],
  slow_liquidity_share_pct: ["Lots (type, prix)", "Auto"],
  cancellation_rate_pct: ["Lots (statut)", "Auto"],
  drawdown_vs_progress_pct: ["Facilités, situations visées", "Auto"],
  cost_overrun_pct: ["Coût à terminaison", "Saisie"],
  drawdown_ahead_of_works: ["Facilités, situations visées", "Auto"],
  drawdown_schedule_late: ["Planning des déblocages", "Auto"],
  equipment_delivery_at_risk: ["Registre des équipements", "Auto"],
  component_exit_unsecured: ["Engagements d'opérateurs / preneurs", "Saisie"],
};
const annex = [brk(), H1("Annexe — Les 12 nouvelles données")];
annex.push(grid(["Clé technique", "Donnée", "Source", "Alimentation"], Object.entries(SRC).map(([k, [src, how]]) => {
  const c = C5.find((x) => x.inputKey === k); const r = V5.redFlags.find((x) => x.rule.clause.key === k);
  return [k, c ? `${c.code} — ${c.name}` : `${r.code} — ${r.name}`, src, how];
}), [2600, 3438, 2000, 1600], { boldCols: [] }));
annex.push(P("Toutes ces données sont saisissables dans l'étape « Programme » de la saisie et importables (colonnes du modèle d'import). Une valeur saisie prime sur la valeur calculée.", { before: 100, italics: true, size: 19 }));

const doc = new Document({
  creator: "Outil de scoring PI", title: "Diagnostic du modèle de scoring — v5.0.0", features: { updateFields: true },
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
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT, space: 4 } }, children: [T("Diagnostic du modèle de scoring — PI_PROMOTION v5.0.0", { size: 15, color: GREY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [T("Page ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: "Calibri" }), T(" / ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY, font: "Calibri" })] })] }) },
    children: [...cover, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9, ...s10, ...s11, ...annex],
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log("OK", OUT, b.length); });
