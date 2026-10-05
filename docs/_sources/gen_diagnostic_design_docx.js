// Génère « Diagnostic design et fonctionnalités » : constats (captures de
// l'application lancée avec les données de démonstration), corrections faites
// avec captures avant / après, feuille de route.
// Usage (racine du dépôt) : node docs/_sources/gen_diagnostic_design_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, PageBreak, TableOfContents, PageNumber, Footer, Header, LevelFormat, ImageRun,
} = require("docx");

const IMG = path.join(__dirname, "img_design");
const OUT = path.join(__dirname, "..", "Diagnostic_Design_Fonctionnalites.docx");
const NAVY = "1F3864", BLUE = "2E5496", LIGHT = "D9E1F2", ZEBRA = "F2F5FB", GREY = "595959", CRIT = "C00000", WARN = "B45F06", OKG = "2E7D32";

const T = (t, o = {}) => new TextRun({ text: t, size: o.size ?? 21, bold: o.bold, italics: o.italics, color: o.color, font: "Calibri" });
const P = (x, o = {}) => new Paragraph({ spacing: { after: o.after ?? 120, before: o.before ?? 0, line: 276 }, alignment: o.align, keepNext: o.keepNext, children: Array.isArray(x) ? x : [T(x, o)] });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: t })] });
const bullet = (r) => new Paragraph({ numbering: { reference: "puces", level: 0 }, spacing: { after: 60, line: 276 }, children: Array.isArray(r) ? r : [T(r)] });
const brk = () => new Paragraph({ children: [new PageBreak()] });
const BORDER = { style: BorderStyle.SINGLE, size: 2, color: "AEB6C6" };
const cell = (c, o) => new TableCell({
  width: { size: o.w, type: WidthType.DXA }, shading: o.bg ? { type: ShadingType.CLEAR, fill: o.bg, color: "auto" } : undefined,
  margins: { top: 40, bottom: 40, left: 80, right: 80 },
  children: (Array.isArray(c) ? c : [c]).map((line) => new Paragraph({ alignment: o.align, spacing: { after: 0, line: 240 },
    children: Array.isArray(line) ? line : [new TextRun({ text: String(line ?? ""), bold: o.bold, color: o.color, size: o.size ?? 18, font: "Calibri" })] })),
});
function grid(head, rows, w, o = {}) {
  const trs = [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, { w: w[i], bg: BLUE, bold: true, color: "FFFFFF" })) })];
  rows.forEach((r, i) => trs.push(new TableRow({ cantSplit: true, children: r.map((x, j) => cell(x, { w: w[j], bg: i % 2 ? ZEBRA : undefined, bold: (o.boldCols ?? [0]).includes(j), align: (o.center ?? []).includes(j) ? AlignmentType.CENTER : undefined, color: o.color?.(i, j, x) })) })));
  return new Table({ columnWidths: w, width: { size: w.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: trs,
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D6E2" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D0D6E2" } } });
}
const box = (titre, texte, color = BLUE, fill = "EEF3FB") => new Table({ columnWidths: [9638], width: { size: 9638, type: WidthType.DXA },
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color }, bottom: { style: BorderStyle.SINGLE, size: 4, color }, left: { style: BorderStyle.SINGLE, size: 4, color }, right: { style: BorderStyle.SINGLE, size: 4, color }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: 9638, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill, color: "auto" }, margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [new Paragraph({ spacing: { after: 40 }, children: [T(titre, { bold: true, color })] }), ...(Array.isArray(texte) ? texte : [texte]).map((t) => new Paragraph({ spacing: { after: 40, line: 276 }, children: [T(t)] }))] })] })] });

// Image PNG insérée à une largeur donnée (points), hauteur proportionnelle.
function png(file, width = 480) {
  const buf = fs.readFileSync(path.join(IMG, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 40 }, keepNext: true,
    children: [new ImageRun({ type: "png", data: buf, transformation: { width, height: Math.round((h * width) / w) }, altText: { title: file, description: file, name: file } })] });
}
const caption = (t) => P(t, { italics: true, size: 18, color: GREY, align: AlignmentType.CENTER, after: 160 });
const sev = (s) => (s === "Critique" ? CRIT : s === "Élevée" ? WARN : s === "Moyenne" ? BLUE : GREY);

// ------------------------------------------------------------------ contenu
const cover = [
  new Paragraph({ spacing: { before: 1800 }, alignment: AlignmentType.CENTER, children: [T("DIAGNOSTIC DESIGN ET FONCTIONNALITÉS", { bold: true, size: 42, color: NAVY })] }),
  new Paragraph({ spacing: { before: 80 }, alignment: AlignmentType.CENTER, children: [T("Application de scoring des projets de promotion immobilière", { bold: true, size: 28, color: BLUE })] }),
  new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 12, color: LIGHT, space: 8 } }, children: [T("", { size: 2 })] }),
  new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, children: [T("Ergonomie · mobile · lisibilité · accessibilité · recherche et filtres · mise en place d'un environnement", { italics: true, size: 24, color: GREY })] }),
  new Paragraph({ spacing: { before: 1400 }, alignment: AlignmentType.CENTER, children: [T("5 octobre 2026 — mis à jour avec la réalisation des priorités 1, 2 et 3", { size: 20, color: GREY })] }),
  brk(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Sommaire" })] }),
  new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-2" }),
  brk(),
];

const s1 = [H1("1. Synthèse")];
s1.push(P("L'application a été lancée en local avec les données de démonstration (12 projets) et parcourue écran par écran, sur grand écran (1 440 px) et sur téléphone (390 px). Ce parcours, complété par une revue du code de l'interface, fait ressortir 14 constats. Les 10 plus utiles ont été corrigés, puis les trois priorités de la feuille de route ont été réalisées (sections 6, 7 et 8)."));
s1.push(grid(["#", "Constat", "Gravité", "État"], [
  ["1", "Aucune navigation sur téléphone : le menu latéral disparaît sans être remplacé.", "Critique", "Corrigé"],
  ["2", "Indicateurs illisibles : montants en pleine longueur (« 866.000.000 MA… » tronqué), page plus large que l'écran sur mobile.", "Élevée", "Corrigé"],
  ["3", "Liste des projets sans recherche, ni filtre, ni tri.", "Élevée", "Corrigé"],
  ["4", "Une base vierge ne peut pas être reconstruite : le jeu de démonstration échoue (groupe GRP_ATLAS jamais créé) et les migrations ne rejouent pas depuis zéro.", "Élevée", "Corrigé"],
  ["5", "Page Suivi de 15 blocs (≈ 4 500 px) sans sommaire ; action « Synchroniser vers le scoring » enfouie au milieu.", "Moyenne", "Corrigé"],
  ["6", "Lien de la page courante non signalé dans le menu ; pas de recherche rapide d'un dossier.", "Moyenne", "Corrigé"],
  ["7", "Accessibilité : aucun attribut ARIA, pas de focus clavier visible, pas de lien d'évitement.", "Moyenne", "Corrigé (bases)"],
  ["8", "Pas d'écran de chargement, d'erreur ni de page introuvable dédiés.", "Moyenne", "Corrigé"],
  ["9", "Couleurs codées en dur : 23 combinaisons différentes pour les mêmes statuts, dans 30 fichiers.", "Moyenne", "Corrigé"],
  ["10", "Formats : point décimal (« 0.9 % ») au lieu de la virgule ; mélange de formats de montants.", "Faible", "Corrigé"],
  ["11", "Fiche projet : 5 boutons dont 2 doublent les onglets ; indicateurs « Étape » et « Fraîcheur » en très gros texte.", "Faible", "Corrigé"],
  ["12", "Graphique « Répartition par classe » vide sans explication ; icône d'onglet absente (erreur 404).", "Faible", "Corrigé"],
  ["13", "Fiche projet : 10 cartes avant les onglets ; formulaires sans composant commun (30 copies du même style de champ), erreurs non affichées par champ.", "Moyenne", "Corrigé"],
  ["14", "Pas de pagination côté serveur, d'export de la liste filtrée, ni de notifications d'échéance.", "Moyenne", "Corrigé (export, notifications : priorité 2 ; pagination : priorité 3)"],
], [500, 6238, 1200, 1700], { center: [0, 2], color: (i, j, x) => (j === 2 ? sev(x) : j === 3 ? (x === "Corrigé" || x.startsWith("Corrigé") ? OKG : x === "Feuille de route" ? GREY : WARN) : undefined) }));
s1.push(P("", { after: 60 }));
s1.push(box("Vérifications", [
  "380 tests automatiques passent (dont 19 nouveaux : formats, recherche et export, erreurs de formulaire, notifications, conventions d'interface), contrôle des types et lint sans erreur, build de production réussi.",
  "Parcours réel dans le navigateur : pages sans erreur, menu mobile opérationnel au clavier (Échap ferme et rend le focus), lien actif signalé, recherche « residence » → 4 dossiers sur 12, tri par score ; erreur de saisie affichée sous le champ et reliée à celui-ci.",
  "Migrations : une base vide reconstruite par les seules migrations est identique, élément par élément, à la production et à schema.prisma (741 éléments, même empreinte).",
], OKG, "E4F2E5"));

const s2 = [brk(), H1("2. Constats design et corrections")];
s2.push(H2("2.1 Téléphone : navigation absente, pages qui débordent"));
s2.push(P("Sur téléphone, le menu latéral était masqué sans solution de remplacement : impossible d'aller d'un écran à l'autre autrement que par les liens internes. Les montants en pleine longueur élargissaient la page au-delà de l'écran (459 px et 517 px de large pour 390 px disponibles)."));
s2.push(P("Correction : barre supérieure avec bouton de menu ; tiroir de navigation accessible (fermeture par Échap ou clic extérieur, focus géré). Les pages font désormais exactement la largeur de l'écran."));
s2.push(png("mobile.png", 470));
s2.push(caption("Tableau de bord sur téléphone : avant (sans menu, débordement) · après · tiroir de navigation ouvert"));
s2.push(H2("2.2 Indicateurs lisibles et formats français"));
s2.push(P("Les indicateurs affichaient les montants en entier (« 866.000.000 MAD », coupé à l'écran) et les décimales avec un point. Ils sont désormais abrégés (« 866 M MAD », « 7,6 M MAD »), avec le montant exact au survol, et toutes les décimales suivent l'usage français (« 0,9 % »). Une fonction commune applique ces formats dans 41 indicateurs et 21 affichages de décimales."));
s2.push(png("kpi_before.png", 470), caption("Avant"), png("kpi_after.png", 470), caption("Après : montants abrégés, virgule décimale, menu avec icônes et lien actif"));
s2.push(H2("2.3 Couleurs : un jeu de tons sémantiques"));
s2.push(P("Les statuts (décision, classe BKAM, étape du circuit, alertes) étaient colorés par 23 combinaisons Tailwind recopiées dans 30 fichiers. Un fichier unique, lib/tones.ts, définit désormais huit tons (neutre, information, succès, succès atténué, vigilance, alerte, danger, accent) ; 130 occurrences y renvoient. Changer une teinte se fait en un seul endroit, et un futur mode sombre devient possible."));
s2.push(H2("2.4 Fiche projet"));
s2.push(P("Les boutons « Suivi » et « Wizard de scoring » doublaient les onglets situés juste en dessous ; ils sont retirés. Les exports du dossier de comité restent. Les indicateurs à texte long (étape du circuit, fraîcheur du score) passent en taille normale, et le score s'affiche « 85,8 / 100 »."));
s2.push(png("fiche_before.png", 470), caption("Avant"), png("fiche_after.png", 470), caption("Après"));
s2.push(H2("2.5 Accessibilité et états de page"));
[
  "Lien « Aller au contenu » au premier appui sur Tab ; focus clavier visible sur tous les éléments ; animations réduites si le système le demande.",
  "Menus et sous-navigation balisés (nav, aria-current) ; colonnes triables annoncées (aria-sort) ; champs de filtre avec libellés pour lecteur d'écran.",
  "Écran de chargement (squelette), écran d'erreur avec référence et bouton « Réessayer », page « dossier introuvable » avec retours utiles.",
  "Graphique vide remplacé par une explication ; icône d'onglet ajoutée (supprime une erreur 404 à chaque page).",
].forEach((t) => s2.push(bullet(t)));

const s3 = [brk(), H1("3. Fonctionnalités ajoutées")];
s3.push(H2("3.1 Recherche, filtres et tri de la liste des projets"));
[
  "Recherche sur la référence, le nom, le promoteur et la ville, insensible aux majuscules et aux accents, sur tous les mots saisis.",
  "Filtres : segment, décision, classe BKAM, étape du circuit, dossiers scorés ou jamais scorés. Tri par référence, projet, promoteur, crédit, score ou date de mise à jour (les valeurs absentes restent en fin de liste).",
  "Compteur « 4 dossier(s) sur 12 » et exposition de la sélection. Bouton « Effacer ».",
  "L'état est dans l'adresse de la page : une liste filtrée se partage par lien et fonctionne même sans JavaScript.",
  "Sur téléphone, une carte par dossier (score, étape, décision, classe, crédit) au lieu d'un tableau illisible.",
].forEach((t) => s3.push(bullet(t)));
s3.push(png("list_before.png", 470), caption("Avant : liste brute"), png("list_after.png", 470), caption("Après : recherche « residence », tri par score, étape du circuit visible"));
s3.push(H2("3.2 Recherche rapide depuis le menu"));
s3.push(P("Un champ « Rechercher un dossier… » en tête du menu, sur tous les écrans, ouvre la liste des projets filtrée."));
s3.push(H2("3.3 Sommaire de la page Suivi"));
s3.push(P("La page Suivi regroupe chantier, déblocages, trésorerie, acquéreurs, journal, programme et équipements, commercialisation, business plan, mainlevées et lots. Un sommaire collant donne un accès direct à chaque bloc (seuls les blocs présents sont proposés). L'action « Synchroniser vers le scoring », la plus importante de la page, est remontée en en-tête."));
s3.push(png("suivi_after.png", 470), caption("Page Suivi : action de synchronisation en en-tête et sommaire collant"));

const s4 = [brk(), H1("4. Mise en place d'un environnement")];
s4.push(P("Pour ce diagnostic, une base vierge a été construite. Deux défauts ont été rencontrés :"));
s4.push(bullet([T("Jeu de démonstration (npm run seed) : ", { bold: true }), T("il rattachait le premier projet au groupe GRP_ATLAS sans le créer, ce qui faisait échouer l'installation. Corrigé : le groupe est créé avant le projet ; les régions sont écrites en codes, comme en production.")]));
s4.push(bullet([T("Migrations (prisma migrate deploy) : ", { bold: true }), T("l'historique ne rejouait pas sur une base vide (la table ProjectEvent n'était créée par aucune migration : des objets avaient été créés en production par « db push »). Corrigé — voir section 6.1.")]));

const s5 = [brk(), H1("5. Feuille de route")];
s5.push(P("Les trois niveaux de priorité ont été réalisés (sections 6, 7 et 8) :"));
s5.push(grid(["Priorité", "Amélioration", "Section"], [
  ["1", "Migrations rejouables sur base vierge ; composants de formulaire communs ; fiche projet regroupée.", "6"],
  ["2", "Indicateurs cliquables ; export de la liste filtrée ; alertes & échéances ; confirmations intégrées ; champs harmonisés.", "7"],
  ["3", "Pagination et filtres côté base ; mode sombre ; résumé hebdomadaire des alertes par e-mail ; tests de bout en bout.", "8"],
], [1000, 7438, 1200], { center: [0, 2] }));
s5.push(P("Suites possibles, non engagées : préférence individuelle d'abonnement au résumé (nécessite une colonne en base), relais SMTP interne si la banque n'utilise pas de fournisseur d'e-mail externe, index composites (projet, date) sur les runs au-delà de quelques milliers de dossiers.", { before: 120 }));

const s5b = [brk(), H1("6. Priorité 1 réalisée")];
s5b.push(H2("6.1 Migrations rejouables sur une base vierge"));
s5b.push(P("Constat : entre juin et septembre 2026, trois tables (journal des événements, planning des déblocages, liens entre promoteurs), 23 colonnes, 3 valeurs d'énumération et leurs index et clés étrangères avaient été créés en production par « db push », sans migration. La migration de septembre (v3) les supposait présents : « prisma migrate deploy » échouait sur une base vide."));
[
  "Migration 20260901000000_rattrapage_db_push : recrée ces objets, en SQL idempotent, avant la migration v3. Son contenu est obtenu par comparaison automatique entre l'état produit par les migrations antérieures et le schéma de l'époque. En production, elle est inscrite comme appliquée sans être exécutée (les objets existent).",
  "Comparaison de la structure (colonnes, types, valeurs par défaut, contraintes, index, énumérations) entre la base reconstruite et la production : 741 éléments, 7 écarts, tous sur les dérogations comité et les autorisations du projet.",
  "Migration 20261004000000_alignement_structure : aligne ces 7 écarts (règles des clés étrangères des dérogations, clé étrangère manquante des autorisations, valeurs par défaut de updatedAt) ; appliquée en production.",
  "Résultat : base reconstruite par les migrations = production = schema.prisma (même empreinte sur les 741 éléments ; « prisma migrate diff » vide). Le jeu de démonstration et les jeux SQL s'installent sans erreur sur cette base.",
  "Garde-fou : un job de CI rejoue les migrations sur une base PostgreSQL vide, vérifie l'absence d'écart avec schema.prisma et installe le jeu de démonstration, à chaque push. README, guide de déploiement et notice des migrations mis à jour (« migrate deploy » remplace « db push »).",
].forEach((t) => s5b.push(bullet(t)));
s5b.push(H2("6.2 Composants de formulaire communs"));
[
  "components/form.tsx : champ (libellé, aide, erreur reliés au contrôle par for/id, aria-describedby, aria-invalid), zone de texte, liste, case à cocher, groupe de champs (fieldset), message global annoncé aux lecteurs d'écran.",
  "Les erreurs de validation renvoyées par le serveur s'affichent désormais sous chaque champ concerné, au lieu d'un message unique « Champs invalides ».",
  "Formulaires migrés : projet, promoteur, rapport de visite, décision de comité, équipements exigés (v5) et saisie du scoring.",
  "Défaut corrigé au passage : dans les formulaires projet et promoteur, les listes déroulantes étaient recréées à chaque frappe (composants définis dans le rendu) et perdaient le focus clavier. Vérifié dans le navigateur : la liste reste le même élément après saisie et choix.",
  "Saisie du scoring : chaque pastille d'étape indique le nombre de champs renseignés (« 5/7 »), passe en vert quand l'étape est complète, et est entourée de rouge en cas d'erreur ; l'enregistrement conduit directement à la première étape à corriger.",
].forEach((t) => s5b.push(bullet(t)));
s5b.push(png("p1_form_error.png", 470), caption("Erreur de validation affichée sous le champ concerné, avec message global"));
s5b.push(png("p1_wizard.png", 470), caption("Saisie du scoring : progression par étape"));
s5b.push(H2("6.3 Fiche projet regroupée"));
[
  "Avant les onglets ne restent que la synthèse (score, classe, provision, étape, fraîcheur, saisie, prochaine action, rappel de la dernière décision de comité) et les deux actions : calcul du score et circuit de décision, côte à côte.",
  "Déplacés dans les onglets : décision de comité et historique du circuit (nouvel onglet « Circuit & comité », qui remplace « Audit » ; l'historique y était en double), GFA / VEFA et facilités (« Financement »), pièces jointes (« Identification »), indicateurs PD / LGD / perte attendue (« Risque & provision »).",
  "Lien direct vers un onglet (?onglet=circuit, financement, risque…), utilisé par le rappel de la décision de comité.",
  "Hauteur de la fiche : 2 067 px → 1 469 px sur grand écran (−29 %), 3 544 px → 2 914 px sur téléphone (−18 %).",
].forEach((t) => s5b.push(bullet(t)));
s5b.push(png("p1_fiche.png", 470), caption("Fiche projet : synthèse, actions côte à côte, puis onglets"));

const s7 = [brk(), H1("7. Priorité 2 réalisée")];
s7.push(H2("7.1 Indicateurs du tableau de bord cliquables"));
[
  "Chaque indicateur ouvre la liste correspondante : projets suivis → liste ; exposition → liste triée par crédit ; scorings à rafraîchir → liste filtrée « À rafraîchir » (nouveau filtre) ; provisions et couverture → vue risque ; côté réseau, mes dossiers et dossiers en attente → file de travail.",
  "Les lignes « Décisions de scoring » ouvrent la liste filtrée par décision ; les barres du graphique par classe BKAM, et des pastilles accessibles au clavier, ouvrent la liste filtrée par classe.",
].forEach((t) => s7.push(bullet(t)));
s7.push(H2("7.2 Export de la liste filtrée"));
[
  "Boutons « Exporter · Excel » et « CSV » sur la liste des projets (profil autorisé à exporter) : le fichier reprend exactement les lignes affichées, avec les mêmes filtres et le même tri (la page et l'export partagent le même chargement).",
  "Excel : filtre automatique, formats numériques (montants, scores) ; CSV : séparateur « ; » et encodage lisible par Excel. Chaque export est journalisé.",
  "Vérifié : liste « À rafraîchir » de 10 dossiers → CSV de 10 lignes.",
].forEach((t) => s7.push(bullet(t)));
s7.push(png("p2_export.png", 470), caption("Liste filtrée « À rafraîchir » et boutons d'export"));
s7.push(H2("7.3 Alertes & échéances"));
[
  "Nouvelle page « Alertes & échéances » (menu) et encart sur les tableaux de bord : revues périodiques dépassées ou proches, dossiers jamais scorés, événements survenus depuis le dernier score, décisions de comité expirées ou expirant sous 30 jours (tant que le crédit n'est pas mis en place), alertes déclenchées par le dernier score (dont les alertes v5), événements critiques non résolus, équipements exigés conditionnant la réception à échéance proche ou dépassée.",
  "Trois niveaux (à traiter en priorité, vigilance, à prévoir), filtres par niveau et par type, et pour chaque alerte un lien « Traiter » vers l'endroit où agir (saisie, journal, onglet du comité, carte Programme).",
  "Périmètre : un chargé d'affaires voit ses dossiers ; les autres profils voient tout le portefeuille. Règles écrites en fonctions pures, couvertes par 6 tests.",
  "Sur la base de démonstration : 19 alertes sur 11 dossiers, dont 6 prioritaires (2 événements critiques non résolus, 4 alertes du dernier score).",
].forEach((t) => s7.push(bullet(t)));
s7.push(png("p2_dashboard.png", 470), caption("Tableau de bord : indicateurs cliquables et encart des alertes"));
s7.push(png("p2_alerts.png", 470), caption("Page « Alertes & échéances »"));
s7.push(H2("7.4 Fenêtres de confirmation intégrées"));
[
  "Composant ConfirmButton : fenêtre intégrée et accessible (rôle alertdialog, focus sur « Annuler » par sécurité, fermeture par Échap), à la place des confirmations du navigateur.",
  "Appliqué : publication et suppression du brouillon de modèle, suppression de domaine, critère, modalité, tranche de barème et alerte (ces quatre dernières se faisaient sans aucune confirmation) ; suppression d'un équipement exigé, d'un jalon de déblocage, d'un lien entre promoteurs ; rejet d'un dossier dans le circuit (le motif saisi est rappelé) ; recalcul du portefeuille (avec l'avertissement sur les données non renseignées).",
  "Vérifié : la fenêtre s'ouvre avec le focus sur « Annuler », Échap annule sans supprimer, la confirmation supprime.",
].forEach((t) => s7.push(bullet(t)));
s7.push(png("p2_confirm.png", 440), caption("Confirmation de suppression d'un équipement exigé"));
s7.push(H2("7.5 Champs de formulaire harmonisés partout"));
[
  "Style de champ centralisé (lib/formStyles.ts) appliqué aux écrans d'administration (constructeur de modèle, référentiels, calibrage, réglages), aux panneaux secondaires (événements, déblocages, révision du business plan, GFA, autorisations, financement des acquéreurs, liens promoteurs, dérogations, analyse IA, import), au stress test et à la connexion.",
  "Libellé accessible ajouté aux 18 champs qui n'en avaient pas (tableaux d'autorisations et de financement des acquéreurs, planning des déblocages, liens promoteurs, dérogation, commentaire du circuit, documents à analyser, fichier d'import…).",
  "Garde-fou automatique : un test échoue si une confirmation du navigateur ou un style de champ recopié réapparaît.",
].forEach((t) => s7.push(bullet(t)));

const s8 = [brk(), H1("8. Priorité 3 réalisée")];
s8.push(H2("8.1 Pagination et filtres exécutés par la base"));
[
  "La liste des projets n'est plus chargée entièrement puis filtrée en mémoire : recherche, filtres, tri et pagination sont exécutés par PostgreSQL, en une requête paramétrée (dernier score, dernière classe et étape du circuit obtenus par jointure latérale).",
  "Recherche insensible aux accents et à la casse, sans extension de base (repli des accents par translate) ; caractères spéciaux de la recherche neutralisés.",
  "Filtre « À rafraîchir » calculé en SQL avec les règles de la politique de revue : jamais scoré, périodicité de la classe atteinte (365 j sain, 90 j sensible, 30 j au-delà), ou événement matériel / imposant un comité postérieur au dernier score.",
  "25, 50 ou 100 dossiers par page ; navigation précédente / suivante et numéros de page (liens : fonctionne sans JavaScript) ; une page au-delà de la dernière affiche la dernière. Le nombre de dossiers et l'exposition portent sur tout le filtre.",
  "L'export Excel / CSV utilise la même requête, sans pagination : il contient toute la liste filtrée.",
  "Contrôle : 4 tests d'intégration sur une base PostgreSQL réelle vérifient, sur 30 combinaisons de filtres et de tris, que la base renvoie exactement la liste de la définition de référence, que l'indicateur « à rafraîchir » coïncide avec la file de re-scoring, et que les pages enchaînées redonnent la liste complète, sans perte ni doublon. Ils passent sur la base de test (32 dossiers) et sur la base de démonstration.",
].forEach((t) => s8.push(bullet(t)));
s8.push(png("p3_pagination.png", 470), caption("Liste des projets, page 2 sur 2 : pagination et choix du nombre de dossiers par page"));
s8.push(H2("8.2 Mode sombre"));
[
  "Toutes les couleurs passent par des variables CSS : les jetons de l'interface (fond, texte, bordure, primaire, danger) et la palette des tons (badges, bandeaux, graphiques). En sombre, l'échelle de chaque teinte est inversée — les fonds clairs deviennent foncés, les textes foncés deviennent clairs — sans modifier les composants.",
  "Choix « Système / Clair / Sombre » en bas de la barre latérale ; par défaut, l'application suit le réglage de l'appareil. Le choix est conservé (cookie) et rendu directement par le serveur : pas de flash clair au chargement.",
  "Contrastes vérifiés par test, dans les deux thèmes : texte principal ≥ 7:1, texte secondaire, liens, boutons et tous les tons sémantiques ≥ 4,5:1 (norme WCAG AA). Le texte secondaire du thème clair a été légèrement foncé à cette occasion (4,3:1 → 5,9:1 sur fond gris).",
  "Graphiques (graduations, axes, infobulles) et bouton « danger » adaptés ; le thème clair est inchangé par ailleurs.",
].forEach((t) => s8.push(bullet(t)));
s8.push(png("p3_dark_dashboard.png", 470), caption("Tableau de bord en mode sombre"));
s8.push(png("p3_dark_fiche.png", 470), caption("Fiche projet en mode sombre"));
s8.push(png("p3_theme_toggle.png", 200), caption("Sélecteur de thème (barre latérale)"));
s8.push(png("p3_dark_mobile.png", 220), caption("Liste des projets sur téléphone, en mode sombre"));
s8.push(H2("8.3 Résumé hebdomadaire des alertes par e-mail"));
[
  "Chaque lundi à 8 h (heure de Casablanca), chaque chargé d'affaires actif ayant au moins une alerte sur ses dossiers reçoit un e-mail : alertes classées par gravité, avec pour chacune le dossier, le motif et un lien direct vers l'endroit où agir, puis un bouton vers la page des alertes. Aucun e-mail quand il n'y a rien à signaler ; 40 alertes détaillées au plus, le reste dans l'application.",
  "Mêmes règles que la page « Alertes & échéances » (une seule source). Contenu en texte brut et HTML, compatible avec les messageries ; tout le contenu saisi est échappé.",
  "Tâche planifiée Vercel (vercel.json) protégée par un secret (CRON_SECRET, comparaison à temps constant ; sans secret, la tâche est refusée). Envoi par l'API Resend quand RESEND_API_KEY et MAIL_FROM sont renseignés ; sinon, la tâche calcule les résumés sans rien envoyer. Un appel « ?apercu=1 » renvoie le contenu sans envoi. Chaque exécution laisse une trace d'exploitation (nombre de destinataires, d'envois, d'erreurs).",
  "Page « Résumé hebdomadaire par e-mail » (depuis Alertes) : aperçu exact de l'e-mail de l'utilisateur, et état de la configuration de l'envoi.",
  "Sur la base de test : 1 chargé d'affaires, 14 alertes sur 10 dossiers. 8 tests couvrent le contenu, l'échappement, la limite, l'appel au fournisseur (succès, refus, panne réseau) et le contrôle du secret.",
].forEach((t) => s8.push(bullet(t)));
s8.push(png("p3_digest.png", 380), caption("Aperçu du résumé hebdomadaire d'un chargé d'affaires"));
s8.push(box("À faire pour activer l'envoi en production", [
  "Sur Vercel (Project Settings → Environment Variables) : CRON_SECRET (au moins 16 caractères), RESEND_API_KEY, MAIL_FROM (adresse d'un domaine vérifié chez le fournisseur) et, si le domaine diffère du domaine Vercel, APP_URL.",
  "Sans ces variables, rien n'est envoyé ; la tâche planifiée est refusée tant que CRON_SECRET manque.",
], WARN, "FFF4E5"));
s8.push(H2("8.4 Tests de bout en bout"));
[
  "13 parcours Playwright dans un navigateur réel, sur grand écran et sur téléphone : pagination et taille de page ; recherche sans accents ; filtre « à rafraîchir » et tri par montant ; export CSV de la liste filtrée (toutes pages) ; création d'un projet avec erreurs sous les champs puis enregistrement ; onglets de la fiche par lien direct ; confirmation du rejet (focus sur « Annuler », Échap annule) ; alertes par gravité ; vue d'un chargé d'affaires et aperçu de son résumé ; tâche planifiée refusée sans secret ; bascule clair / sombre conservée ; menu en tiroir et cartes sur mobile.",
  "Jeu de test reproductible (scripts/seed-e2e.ts) : 30 dossiers couvrant les segments, villes, décisions, classes, étapes, scores anciens et récents, événements, comités proches de l'expiration et équipements à échéance.",
  "Connexion de test : identité fixée par E2E_AUTH_EMAIL, changeable par un cookie pour tester un autre profil. Elle n'existe qu'en mode développement : vérifié qu'un build de production lancé avec cette variable renvoie toujours vers la page de connexion.",
  "Intégration continue : à chaque push, un job rejoue migrations, jeu de démonstration et jeu de test puis lance les tests d'intégration ; un second job lance les 13 parcours et conserve le rapport en cas d'échec.",
  "Amélioration trouvée par ces tests : l'onglet choisi sur la fiche projet est désormais reporté dans l'adresse (?onglet=…) — le lien copié et le rechargement ouvrent le même onglet.",
].forEach((t) => s8.push(bullet(t)));
s8.push(grid(["Suite", "Nombre", "Résultat"], [
  ["Tests unitaires (vitest)", "405 (+25)", "Tous réussis"],
  ["Tests d'intégration (PostgreSQL réel)", "4", "Tous réussis"],
  ["Tests de bout en bout (Playwright)", "13", "Tous réussis"],
  ["Typage, lint, build de production", "—", "Sans erreur"],
], [4638, 2000, 3000], { center: [1, 2] }));

const s6 = [brk(), H1("Annexe — Fichiers modifiés")];
s6.push(grid(["Fichier", "Changement"], [
  ["app/layout.tsx, components/AppNav.tsx", "Navigation responsive (barre latérale / tiroir mobile), icônes, lien actif, recherche rapide, lien d'évitement."],
  ["app/loading.tsx, app/error.tsx, app/not-found.tsx, app/icon.svg", "États de chargement, d'erreur, de page introuvable ; icône d'onglet."],
  ["app/globals.css", "Focus clavier visible, chiffres tabulaires, mouvements réduits."],
  ["lib/utils.ts, components/ui.tsx", "Formats français (formatDecimal, formatMADCompact) ; indicateurs sans débordement avec valeur exacte au survol."],
  ["lib/tones.ts, lib/labels.ts", "Tons sémantiques ; couleurs des étapes du circuit centralisées."],
  ["lib/projectFilters.ts, app/projects/page.tsx", "Recherche, filtres, tri ; cartes sur mobile."],
  ["components/SectionNav.tsx, app/projects/[id]/suivi/page.tsx", "Sommaire collant ; synchronisation en en-tête."],
  ["app/projects/[id]/page.tsx, components/ProjectSubnav.tsx", "Actions dédoublonnées ; indicateurs compacts ; sous-navigation défilante."],
  ["components/PortfolioChart.tsx", "Graphique vide expliqué."],
  ["prisma/seed.ts", "Groupe créé avant rattachement ; régions en codes."],
  ["tests/formatters.test.ts, tests/projectFilters.test.ts", "6 tests."],
  ["prisma/migrations/20260901000000_rattrapage_db_push, 20261004000000_alignement_structure, prisma/schema.prisma, .github/workflows/ci.yml", "Migrations rejouables, structure alignée, contrôle en CI."],
  ["components/form.tsx, tests/formErrors.test.ts", "Composants de formulaire communs ; 3 tests."],
  ["components/ProjectForm, PromoterForm, VisitReportForm, CommitteeDecisionForm, ProgrammeV5Card, ScoringWizard", "Formulaires migrés, erreurs par champ, progression de la saisie."],
  ["app/projects/[id]/page.tsx", "Fiche regroupée en onglets ; lien direct vers un onglet."],
  ["components/ui.tsx (Stat href, Button ref), app/page.tsx, components/PortfolioChart.tsx", "Indicateurs et graphique cliquables ; encart des alertes."],
  ["server/services/projectList.ts, app/api/export/projects, lib/projectFilters.ts", "Liste et export partagés ; filtre « À rafraîchir »."],
  ["lib/domain/notifications.ts, server/services/notifications.ts, app/alerts, components/AlertsSummary.tsx", "Alertes & échéances ; 6 tests."],
  ["components/ConfirmButton.tsx", "Confirmations intégrées : 12 actions dans 6 composants."],
  ["lib/formStyles.ts, tests/uiConventions.test.ts", "Style de champ unique ; garde-fous."],
  ["server/services/projectList.ts, lib/projectFilters.ts, app/projects/page.tsx, app/api/export/projects", "Liste filtrée, triée et paginée par la base ; export sur la même requête."],
  ["tests/integration, vitest.integration.config.ts, scripts/seed-e2e.ts", "Tests d'intégration sur base réelle ; jeu de test de 30 dossiers."],
  ["lib/themePalette.ts, lib/theme.ts, components/ThemeToggle.tsx, tailwind.config.ts, app/globals.css, app/layout.tsx, tests/theme.test.ts", "Mode sombre, choix du thème, contrôle des contrastes."],
  ["lib/domain/alertDigest.ts, server/services/alertDigest.ts, server/services/mailer.ts, lib/cronAuth.ts, app/api/cron/alert-digest, app/alerts/resume, vercel.json, tests/alertDigest.test.ts", "Résumé hebdomadaire des alertes par e-mail."],
  ["playwright.config.ts, tests/e2e, lib/testAuth.ts, middleware.ts, .github/workflows/ci.yml", "Tests de bout en bout, identité de test hors production, jobs CI."],
  ["components/Tabs.tsx (UrlTabs)", "Onglet de la fiche reporté dans l'adresse."],
], [3800, 5838], { boldCols: [] }));

const doc = new Document({
  creator: "Outil de scoring PI", title: "Diagnostic design et fonctionnalités", features: { updateFields: true },
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
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT, space: 4 } }, children: [T("Diagnostic design et fonctionnalités", { size: 15, color: GREY })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [T("Page ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY, font: "Calibri" }), T(" / ", { size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY, font: "Calibri" })] })] }) },
    children: [...cover, ...s1, ...s2, ...s3, ...s4, ...s5, ...s5b, ...s7, ...s8, ...s6],
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log("OK", OUT, b.length); });
