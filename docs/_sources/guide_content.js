// Contenu métier du guide du chargé d'affaires (source unique du Word et du
// PowerPoint). Les libellés d'écran, étapes, barèmes, alertes et événements
// proviennent du code (guide_data.json, exporté par export_guide_data.ts) ;
// ce fichier porte ce que le code ne sait pas : les pièces justificatives,
// la manière de calculer chaque donnée et les pièges fréquents.
// La liste des pièces est à valider avec la politique de crédit et la
// procédure interne de l'établissement.

const PIECES = [
  // --- A. Promoteur et groupe
  { id: "P01", fam: "A", nom: "Statuts à jour, modèle J du registre de commerce, ICE, IF, affiliation CNSS", emetteur: "Promoteur / tribunal de commerce", fraicheur: "Modèle J de moins de 3 mois", sert: "Fiche promoteur ; gouvernance" },
  { id: "P02", fam: "A", nom: "Procès-verbaux des organes (AG, conseil), liste des dirigeants et pouvoirs", emetteur: "Promoteur", fraicheur: "Dernier exercice", sert: "Gouvernance & structure juridique" },
  { id: "P03", fam: "A", nom: "Organigramme du groupe : participations, sociétés sœurs, cautions croisées", emetteur: "Promoteur", fraicheur: "À jour", sert: "Groupe d'intérêt (effet groupe BAM, division des risques)" },
  { id: "P04", fam: "A", nom: "États de synthèse certifiés des 3 derniers exercices (bilan, CPC, ESG) et rapport du commissaire aux comptes", emetteur: "Promoteur / CAC", fraicheur: "3 derniers exercices clos", sert: "Gearing, fonds propres négatifs, couverture des intérêts, dettes / FP, baisse du CA" },
  { id: "P05", fam: "A", nom: "Références : programmes livrés sur 5 ans avec justificatifs (permis d'habiter, certificats de conformité, PV de réception)", emetteur: "Promoteur ; administration", fraicheur: "5 dernières années", sert: "Projets similaires livrés ; typologie promoteur ; SAV" },
  { id: "P06", fam: "A", nom: "Tableau des engagements bancaires toutes banques (encours, échéances, garanties)", emetteur: "Promoteur ; attestations bancaires", fraicheur: "Moins de 3 mois", sert: "Gearing ; exposition du groupe ; division des risques" },
  { id: "P07", fam: "A", nom: "Consultation du crédit bureau (promoteur, dirigeants, sociétés du groupe)", emetteur: "Banque", fraicheur: "Moins de 1 mois à l'instruction", sert: "Information négative crédit bureau (classification 1/W)" },
  { id: "P08", fam: "A", nom: "Chiffre d'affaires prévisionnel du groupe par programme", emetteur: "Promoteur", fraicheur: "À l'instruction", sert: "Concentration mono-projet" },
  // --- B. Foncier et autorisations
  { id: "P10", fam: "B", nom: "Certificat de propriété du titre foncier, avec inscriptions (hypothèques, saisies, servitudes)", emetteur: "ANCFCC — conservation foncière", fraicheur: "Récent (moins de 3 mois recommandé)", sert: "Foncier & autorisations ; titre purgé ; rang de l'hypothèque" },
  { id: "P11", fam: "B", nom: "Acte d'acquisition du terrain (ou compromis) et justificatifs de paiement", emetteur: "Notaire / adoul ; banque", fraicheur: "—", sert: "Coût foncier / CA ; apport effectif (terrain payé sur fonds propres)" },
  { id: "P12", fam: "B", nom: "Note de renseignements urbanistiques", emetteur: "Agence urbaine", fraicheur: "En cours de validité", sert: "Chaîne d'autorisations (étude)" },
  { id: "P13", fam: "B", nom: "Autorisation de lotir (loi 25-90) et/ou permis de construire (loi 12-90), avec plans autorisés", emetteur: "Commune / agence urbaine", fraicheur: "En cours de validité", sert: "Chaîne d'autorisations ; verrou de tirage des travaux" },
  { id: "P14", fam: "B", nom: "Autorisation de morcellement / éclatement du titre mère", emetteur: "ANCFCC", fraicheur: "Avant la vente des lots", sert: "Chaîne d'autorisations (lotissement)" },
  { id: "P15", fam: "B", nom: "Réception provisoire, permis d'habiter, certificat de conformité, réception définitive", emetteur: "Commune ; maître d'œuvre", fraicheur: "Au fil du programme", sert: "Chaîne d'autorisations (livraison) ; mainlevées" },
  // --- C. Programme, technique et business plan
  { id: "P16", fam: "C", nom: "Business plan du programme (bilan promoteur) : recettes, coût foncier, travaux, frais, marge, planning", emetteur: "Promoteur", fraicheur: "Version datée et signée", sert: "Marge brute, marge stressée, coût foncier / CA, LTC" },
  { id: "P17", fam: "C", nom: "Plan de trésorerie MENSUEL du programme (encaissements, décaissements, tirages, remboursements)", emetteur: "Promoteur", fraicheur: "Mis à jour à chaque revue", sert: "Cash coverage, impasse brute, impasse persistante" },
  { id: "P18", fam: "C", nom: "Étude de marché, grille de prix et références de transactions comparables", emetteur: "Promoteur ; expert ; banque", fraicheur: "Moins de 12 mois", sert: "Marché & positionnement ; sensibilité macro / subvention" },
  { id: "P19", fam: "C", nom: "Dossier technique : plans, CPS, marchés des entreprises (montants, délais, pénalités), note du BET", emetteur: "Promoteur ; architecte ; BET", fraicheur: "—", sert: "Complexité technique" },
  { id: "P20", fam: "C", nom: "Planning contractuel des travaux", emetteur: "Promoteur ; entreprise", fraicheur: "Version en vigueur", sert: "Avancement vs planning ; retard de chantier" },
  { id: "P21", fam: "C", nom: "Situations de travaux visées (architecte / BET) et rapports de visite de chantier", emetteur: "Maître d'œuvre ; banque", fraicheur: "Avant chaque tirage", sert: "Avancement vs planning ; déblocages ; arrêt de chantier" },
  // --- D. Commercialisation et acquéreurs
  { id: "P22", fam: "D", nom: "État des ventes lot par lot : prix, date, statut (réservé, compromis, vendu, livré, désisté), acomptes encaissés", emetteur: "Promoteur", fraicheur: "Mensuel", sert: "Préventes, ventes vs planning, rotation du stock, DSO" },
  { id: "P23", fam: "D", nom: "Contrats de réservation, contrats VEFA (loi 44-00 modifiée par la loi 107-12) et actes de vente", emetteur: "Notaire ; promoteur", fraicheur: "—", sert: "Préventes juridiquement sécurisées" },
  { id: "P24", fam: "D", nom: "Financement de chaque acquéreur : attestation de déblocage, offre ou accord de crédit, dépôt de dossier, justificatif d'autofinancement, dispositif d'aide", emetteur: "Banque de l'acquéreur ; acquéreur", fraicheur: "À chaque revue", sert: "Ventes sécurisées par le financement acquéreur ; alerte acquéreurs non financés" },
  { id: "P25", fam: "D", nom: "État des réclamations clients, désistements et litiges", emetteur: "Promoteur ; avocat", fraicheur: "À chaque revue", sert: "Litiges clients / SAV ; exposition contentieuse" },
  // --- E. Financement et garanties
  { id: "P26", fam: "E", nom: "Demande de crédit : montant, natures de concours, échéancier, plan de tirage", emetteur: "Promoteur ; chargé d'affaires", fraicheur: "—", sert: "LTC ; facilités ; déblocages" },
  { id: "P27", fam: "E", nom: "Rapport d'expertise immobilière indépendant (valeur actuelle, valeur à l'achèvement)", emetteur: "Expert agréé", fraicheur: "Moins de 12 mois", sert: "LTV stressée ; couverture des garanties" },
  { id: "P28", fam: "E", nom: "État des garanties proposées (hypothèque, cautions, nantissements, GFA) et projets d'actes", emetteur: "Promoteur ; notaire", fraicheur: "—", sert: "Couverture des garanties ; rang ; garanties affectées" },
  { id: "P29", fam: "E", nom: "Convention de crédit : clause de mainlevée partielle (quotité de désengagement par lot)", emetteur: "Banque", fraicheur: "Version signée", sert: "Quotité de désengagement ; alerte mainlevée sous-tarifée" },
  // --- F. Situation bancaire et réglementaire (dossier en cours)
  { id: "P31", fam: "F", nom: "Échéancier et état des impayés, dépassements, mouvements du compte", emetteur: "SI bancaire (T24 / Evolan)", fraicheur: "À la date du calcul", sert: "Retard de paiement ; dépassements ; crédit in fine (1/W art.10-12)" },
  { id: "P32", fam: "F", nom: "Avenants, protocoles de restructuration, reprofilage ou consolidation", emetteur: "Banque", fraicheur: "—", sert: "Restructuration (1/W art.17-31) ; retour en comité" },
  { id: "P33", fam: "F", nom: "Notifications de saisie-arrêt / ATD, assignations, jugements (redressement, liquidation)", emetteur: "Tribunal ; administration fiscale", fraicheur: "Dès réception", sert: "Exposition contentieuse ; classification 1/W" },
];

const FAMILLES = {
  A: "Promoteur et groupe",
  B: "Foncier et autorisations",
  C: "Programme, technique et business plan",
  D: "Commercialisation et acquéreurs",
  E: "Financement et garanties",
  F: "Situation bancaire et réglementaire (dossier en cours)",
};

// Donnée par donnée : pièces, calcul, piège. Clé = clé technique du modèle.
const DONNEES = {
  // ---------------- D1 Sponsor & gouvernance
  promoter_completed_projects: { pieces: ["P05"], calcul: "Nombre de programmes comparables (nature, taille, standing) LIVRÉS par le promoteur ou son équipe dirigeante sur 5 ans, justifiés par permis d'habiter, certificat de conformité ou PV de réception.", piege: "Ne pas compter les programmes en cours ni ceux d'un autre métier (négoce, BTP pour tiers)." },
  promoter_gearing: { pieces: ["P04", "P06"], calcul: "(Dettes financières − trésorerie) / fonds propres × 100, sur le dernier bilan certifié, corrigé des engagements connus depuis la clôture.", piege: "Inclure les comptes courants d'associés remboursables et les dettes des sociétés sœurs si elles sont garanties." },
  governance_quality: { pieces: ["P01", "P02", "P03"], calcul: "Claire : organes réguliers, comptes certifiés, séparation patrimoine / société. Partielle : l'un de ces points manque. Opaque : actionnariat ou comptes non documentés.", piege: "Une société de programme récente se juge sur son actionnaire de référence." },
  mono_project_concentration: { pieces: ["P08"], calcul: "Chiffre d'affaires du programme / chiffre d'affaires total prévisionnel du promoteur (ou du groupe) × 100.", piege: "Une société dédiée au seul programme est à 100 % : c'est l'information attendue, pas une erreur." },
  promoter_type: { pieces: ["P05", "P04"], calcul: "Structuré : équipe, historique et comptes solides, plusieurs programmes. Régional : actif sur une zone, taille moyenne. Opportuniste : premier programme ou activité ponctuelle.", piege: "Se fonder sur les références justifiées, pas sur la notoriété déclarée." },
  equity_injected_ratio: { pieces: ["P11", "P04", "P17"], calcul: "Apport effectivement injecté (terrain payé, fonds versés sur le compte du programme) / apport prévu au plan de financement × 100.", piege: "DONNÉE DÉCISIONNELLE et critère éliminatoire (jalon SIGNATURE) : un apport promis n'est pas un apport injecté. Exiger les justificatifs de paiement." },
  // ---------------- D2 Qualité du projet
  land_permits_status: { pieces: ["P10", "P13"], calcul: "Définitives : titre purgé ET autorisation (lotir / construire) obtenue. Partielles : l'une des deux manque. Absentes : ni titre purgé, ni autorisation.", piege: "DONNÉE DÉCISIONNELLE et critère éliminatoire (jalon TIRAGE) : aucun tirage travaux sans titre purgé et autorisation." },
  market_positioning: { pieces: ["P18", "P27"], calcul: "Comparer la grille de prix aux transactions récentes de la zone et au pouvoir d'achat de la clientèle visée.", piege: "Un prix au-dessus du marché gonfle la marge et les préventes affichées : le signaler ici." },
  technical_complexity: { pieces: ["P19"], calcul: "Standard : bâtiment courant. Moyenne : sous-sols profonds, IGH, terrain difficile. Élevée : ouvrage complexe, nombreux corps d'état, contraintes de site.", piege: "S'appuyer sur la note du BET, pas sur le seul descriptif commercial." },
  progress_vs_plan: { pieces: ["P21", "P20"], calcul: "Avancement constaté (dernière situation visée ou visite) / avancement prévu au planning à la même date × 100. Calculé automatiquement par « Synchroniser vers le scoring » si des rapports de visite existent.", piege: "Utiliser l'avancement physique visé, pas le pourcentage de budget consommé." },
  sav_litigation: { pieces: ["P25", "P05"], calcul: "Faible : réclamations isolées et traitées. Moyen : réclamations récurrentes. Élevé : litiges en cours ou réputation dégradée.", piege: "Interroger aussi les programmes livrés précédents." },
  macro_sensitivity: { pieces: ["P18"], calcul: "Élevée : programme dépendant d'une aide publique ou d'une clientèle très exposée au crédit. Moyenne : dépendance partielle. Faible : clientèle diversifiée et solvable.", piege: "Le logement social et intermédiaire dépend des dispositifs d'aide : vérifier leur durée." },
  land_cost_ratio: { pieces: ["P11", "P16"], calcul: "Coût d'acquisition du terrain (frais inclus) / chiffre d'affaires total prévu × 100.", piege: "Retenir le coût réel d'acquisition, pas la valeur d'apport réévaluée." },
  authorization_completeness_pct: { pieces: ["P10", "P12", "P13", "P14", "P15"], calcul: "Pièces obtenues / pièces exigibles selon la nature du programme × 100. Cocher chaque pièce dans « Foncier, autorisations & désengagement » : le pourcentage est calculé par « Synchroniser vers le scoring ».", piege: "Ne saisir le pourcentage à la main que si l'écran n'est pas utilisable. La nature (lotissement, construction, mixte) change la liste exigible." },
  // ---------------- D3 Commercial & cash-flow
  pre_sale_rate: { pieces: ["P22", "P23"], calcul: "Prix des lots juridiquement engagés (réservés, compromis, vendus), nets des désistements / chiffre d'affaires total × 100. Calculé par la synchronisation depuis les lots.", piege: "DONNÉE DÉCISIONNELLE : si elle manque, le dossier est incomplet. Une réservation sans contrat ne compte pas." },
  sales_vs_plan: { pieces: ["P22", "P16"], calcul: "Ventes fermes à date / ventes prévues à la même date par le business plan × 100.", piege: "Comparer au planning commercial d'origine, pas à un planning révisé sans validation." },
  dso_days: { pieces: ["P22"], calcul: "Délai moyen d'encaissement des sommes dues par les acquéreurs, en jours.", piege: "Les acomptes non appelés ne sont pas des créances." },
  cash_coverage: { pieces: ["P17"], calcul: "Ressources certaines de la période (trésorerie, tirages autorisés, encaissements sécurisés) / sorties de la période. L'écran « Trésorerie mensuelle & impasse » de la fiche le reconstitue.", piege: "DONNÉE DÉCISIONNELLE et clé d'alerte (< 1,0 : malus 25). Sans plan de trésorerie mensuel, ne pas estimer au jugé." },
  funding_gap_pct: { pieces: ["P17"], calcul: "Besoin additionnel maximal non financé / coût restant à financer × 100 (0 si aucune impasse).", piege: "DONNÉE DÉCISIONNELLE. Laisser vide si inconnue : un 0 saisi par défaut donnerait la meilleure note." },
  stock_rotation_months: { pieces: ["P22"], calcul: "Lots invendus / rythme mensuel de ventes nettes observé (en mois).", piege: "Utiliser le rythme net des désistements sur les 6 à 12 derniers mois." },
  stressed_margin_pct: { pieces: ["P16"], calcul: "Marge brute recalculée avec des prix de vente baissés de 10 % (coûts inchangés).", piege: "Recalculer, ne pas soustraire 10 points à la marge." },
  secured_sales_rate: { pieces: ["P24", "P22"], calcul: "Σ (prix du lot × facteur de sécurisation du financement de l'acquéreur) / valeur commercialisable totale × 100. Renseigner le statut de financement de chaque lot dans le suivi : calcul automatique à la synchronisation.", piege: "Une réservation dont le crédit n'est pas instruit ne vaut que 20 % ; un crédit refusé vaut 0." },
  // ---------------- D4 Structuration financière & LGD
  gross_margin_pct: { pieces: ["P16"], calcul: "(Recettes nettes − coût complet) / recettes nettes × 100, coût complet = foncier + travaux + honoraires + frais financiers + commercialisation.", piege: "DONNÉE DÉCISIONNELLE. Exclure les produits non liés au programme." },
  ltc: { pieces: ["P26", "P16"], calcul: "Crédit total (tous concours du programme) / coût total du programme × 100.", piege: "Inclure les concours par signature qui financent le programme." },
  ltv_stressed: { pieces: ["P27", "P26"], calcul: "Crédit / (valeur d'expertise × 0,90) × 100.", piege: "Utiliser la valeur d'expertise indépendante, pas la valeur commerciale du promoteur." },
  guarantee_coverage: { pieces: ["P27", "P28"], calcul: "Valeur réalisable des garanties retenues / engagement × 100.", piege: "Une caution personnelle sans patrimoine vérifié ne se compte pas en valeur réalisable." },
  first_rank: { pieces: ["P10", "P28"], calcul: "Oui si l'hypothèque de la banque est (ou sera, par acte) en premier rang sur le titre.", piege: "Clé d'alerte : « Non » déclenche un malus de 25 points." },
  interest_coverage: { pieces: ["P04", "P16"], calcul: "Résultat d'exploitation avant amortissements / charges financières.", piege: "Utiliser le périmètre du promoteur qui supporte la dette." },
  release_quotity_gap_pts: { pieces: ["P29", "P22", "P31"], calcul: "Quotité de désengagement convenue − (encours / valeur commercialisable totale), en points. Saisir la quotité sur la fiche projet : calcul automatique à la synchronisation.", piege: "Négatif = chaque mainlevée rembourse moins que la part de dette du lot : la dette résiduelle se concentre sur les derniers lots." },
  // ---------------- Clés d'alertes et de classification
  dpd_days: { pieces: ["P31"], calcul: "Jours de retard de la plus ancienne échéance impayée. Dérivé de l'échéancier des facilités par la synchronisation.", piege: "DONNÉE DÉCISIONNELLE : saisir 0 s'il n'y a aucun impayé (et non laisser vide). ≥ 90 jours : souffrance automatique." },
  construction_delay_months: { pieces: ["P20", "P21"], calcul: "Retard de la date d'achèvement prévue par rapport au planning contractuel, en mois.", piege: "DONNÉE DÉCISIONNELLE et clé d'alerte (≥ 6 mois : malus 15 et retour en comité). Saisir 0 si aucun retard — vide rend le dossier incomplet." },
  project_stopped_months: { pieces: ["P21"], calcul: "Durée de l'arrêt de chantier en cours, en mois. Dérivée du journal (événement « Arrêt de chantier » ouvert) par la synchronisation.", piege: "DONNÉE DÉCISIONNELLE et alerte bloquante (≥ 12 mois : souffrance automatique). Saisir 0 si le chantier n'est pas arrêté — vide rend le dossier incomplet." },
  restructured: { pieces: ["P32"], calcul: "Oui si la créance a fait l'objet d'une restructuration (avenant modifiant échéances ou conditions en raison de difficultés).", piege: "Toute restructuration impose un retour en comité ; enregistrer aussi l'événement au journal." },
  legal_exposure: { pieces: ["P33", "P25"], calcul: "Contentieux : action en justice engagée. Surveillance : menace ou mise en demeure. Sain : aucune.", piege: "Contentieux = alerte bloquante." },
  equity_negative: { pieces: ["P04"], calcul: "Oui si les capitaux propres du dernier bilan sont négatifs.", piege: "Malus de 25 points ; vérifier les capitaux propres consolidés si le groupe soutient la société." },
  funding_gap_persistent: { pieces: ["P17"], calcul: "Oui si le plan de trésorerie montre une rupture sur au moins deux mois consécutifs.", piege: "Malus de 20 points." },
  works_authorization_blocked: { pieces: ["P10", "P13"], calcul: "Calculé par la synchronisation : une pièce indispensable aux travaux financés manque dans la chaîne d'autorisations.", piege: "Verrou de tirage : aucun déblocage travaux tant que la pièce n'est pas levée." },
  buyers_financing_at_risk: { pieces: ["P24"], calcul: "Calculé par la synchronisation : au moins 40 % des lots renseignés reposent sur un financement non instruit, en cours ou refusé.", piege: "Relancer l'instruction des crédits acquéreurs avant d'autoriser de nouveaux tirages." },
  release_underpriced: { pieces: ["P29"], calcul: "Calculé par la synchronisation : quotité convenue inférieure à la quotité d'équilibre.", piege: "Retour en comité : proposer le relèvement de la quotité." },
  division_limit_breach: { pieces: ["P03", "P06"], calcul: "Calculé par la synchronisation sur l'exposition du groupe d'intérêt, rapportée aux fonds propres paramétrés par la Direction des risques.", piege: "Aucun malus : dépassement = décision au niveau de délégation requis (retour en comité). Déclarer tous les liens du groupe." },
};

// Données de classification BAM (1/W) : saisies dans les étapes « Crédit &
// dépassements » et « Vulnérabilité réglementaire BAM ».
const CLASSIFICATION = [
  ["Saisie-arrêt / ATD", "P33", "Notification reçue"],
  ["États comptables non reçus (7 mois)", "P04", "Date de réception des états de synthèse"],
  ["Situation financière non évaluable", "P04", "États absents ou inexploitables"],
  ["Information négative crédit bureau", "P07", "Rapport de consultation"],
  ["Commercialisation < 50 % à 1 an", "P22", "État des ventes"],
  ["Problèmes administratifs > 1 an / Retard de construction > 1 an", "P13, P20", "Autorisations ; planning"],
  ["Décalage significatif vs business plan", "P16, P22", "Business plan ; état des ventes"],
  ["Baisse du CA sur 1 an ; dettes financières / FP", "P04", "États de synthèse"],
  ["Redressement judiciaire ; projet à l'arrêt > 1 an ; achevé ≥ 2 ans sans ventes", "P33, P21, P22", "Jugement ; visites ; ventes"],
  ["Restructuration : nombre, viabilité, différé, 2e restructuration, impayé sur créance restructurée", "P32, P31", "Avenants ; échéancier"],
  ["Crédit in fine, dépassements, compte débiteur sans mouvement créditeur", "P31", "SI bancaire"],
  ["Information d'avancement ou de commercialisation non fiable", "P21, P22", "Appréciation du chargé d'affaires"],
];

const ETAPES = [
  ["Réunir les pièces", "Liste de la section 4 (check-list en annexe A) : chaque pièce datée, lisible, rattachée au bon programme."],
  ["Créer ou mettre à jour le promoteur", "Promoteurs › Nouveau promoteur : signalétique, groupe d'intérêt, liens avec les autres sociétés."],
  ["Créer le projet", "Projets › Nouveau projet : identification, segment et zone du modèle, foncier, calendrier, montants, mode de vente."],
  ["Renseigner le suivi", "Fiche projet › Suivi : chaîne d'autorisations, nature du programme, quotité de désengagement, lots et financement des acquéreurs, facilités, événements, visites."],
  ["Saisir les critères", "Wizard de scoring (7 étapes). Option : « Lecture IA des documents » pré-remplit, vous vérifiez chaque valeur."],
  ["Synchroniser vers le scoring", "Reporte automatiquement préventes, ventes, avancement, autorisations, ventes sécurisées, désengagement, division des risques, impayés, arrêt de chantier."],
  ["Calculer le score", "« Enregistrer & calculer » : classification BAM, score, provision."],
  ["Lire le résultat", "Fiche projet › Scoring › « Lecture du résultat » : données manquantes, conditions, alertes, retour en comité."],
  ["Compléter ou argumenter", "Dossier incomplet → compléter ; alertes → mitigants ; conditions → calendrier de levée."],
  ["Soumettre", "Circuit : avis du directeur de centre d'affaires, contre-étude Risque, décision ou comité."],
];

module.exports = { PIECES, FAMILLES, DONNEES, CLASSIFICATION, ETAPES };
