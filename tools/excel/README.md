# Outil Excel / VBA — Modèle PI_PROMOTION v5.0.0 (outil 5.1)

Classeur qui calcule le score, la décision et la classe interne d'un dossier de
promotion immobilière avec le modèle publié : mêmes critères, barèmes, alertes,
seuils et règles de décision que l'application (26 cas de référence identiques).

## Fichiers

| Fichier | Rôle |
|---|---|
| `PI_Promotion_Modele_v5.xlsm` | **Outil prêt à l'emploi** : macros intégrées et onglet de ruban « Scoring PI ». Rien à installer. |
| `PI_Promotion_Modele_v5.xlsx` | Même classeur sans macros : le calcul (saisie, fiche, résultat) fonctionne. |
| `vba/*.bas` | Sources des 7 modules VBA (ASCII), intégrés au `.xlsm` ; à importer à la main seulement dans le `.xlsx`. |
| `fabriquer_outil.py` | Fabrique les deux classeurs (voir « Fabrication »). |
| `build_workbook.py` | Génère le classeur (feuilles, formules, mises en forme). |
| `_build/` | Cas de référence, référentiels, ruban (`ruban/customUI14.xml`), banc de vérification LibreOffice. |

## Prise en main (2 minutes)

1. Ouvrir `PI_Promotion_Modele_v5.xlsm`. S'il a été reçu par e-mail ou téléchargé et qu'Excel
   bloque les macros : fermer le fichier, clic droit › Propriétés › cocher **Débloquer** › OK,
   rouvrir, puis **Activer le contenu**.
2. Onglet de ruban **Scoring PI** › **Nouveau dossier** (le classeur s'ouvre sur un dossier d'exemple).
3. Onglet **Saisie** : cellules jaunes, listes déroulantes en clair. Le résultat se met à jour en
   direct en haut à droite ; la colonne **État** signale les données manquantes.
4. Onglet **Fiche** : la synthèse à imprimer (une page) ou ruban › **Fiche en PDF**.
5. Ruban › **Enregistrer le dossier** : il est rangé dans le Portefeuille ; **Ouvrir un dossier** le recharge.

## Ce qui change dans l'outil 5.1

**Plus simple à utiliser**

- `.xlsm` livré avec les macros et un **onglet de ruban « Scoring PI »** (Dossier · Aller à · Analyse · Outil) :
  plus d'import de modules ni d'installation de boutons.
- **Accueil** : dossier en cours (score, décision en couleur, complétude) et mode d'emploi avec liens.
- **Saisie en clair** : modalités, segment et zone choisis par leur libellé (« Titre purgé + autorisations
  définitives », « Casablanca — centre »…) ; le code technique est déduit. Colonnes techniques masquées,
  unité affichée pour chaque donnée, colonne **État** (✔ renseigné · ⚠ manquant — décisionnel · ○ non renseigné ·
  ⚠ valeur à vérifier), **résultat en direct** en haut de la feuille.
- **Fiche de résultat** en français, colorée et imprimable sur une page A4 : décision, notes économique et de
  sûretés, données manquantes, conditions à lever, alertes (libellés), comité, scores par domaine (barres),
  **les 5 notes les plus basses** à travailler.
- **Dossiers enregistrés dans le Portefeuille** (valeurs utilisées et résultat) et rouverts en un clic.
- Feuilles de travail **protégées** (sans mot de passe) : seules les cellules jaunes sont modifiables.
- Paramètres du modèle et cas de référence **masqués** (ruban › Paramètres pour les afficher).
- Décisions affichées en clair partout (« Favorable sous conditions » plutôt que `GO_WITH_CONDITIONS`), messages des macros en français.

**Corrections**

- **Fuite des calculateurs** : le scoring du portefeuille et les autotests utilisaient, pour toute donnée
  dérivée absente d'une ligne, la valeur calculée par les calculateurs du dossier ouvert (ex. une ligne sans
  « dépassement du coût » passait de 96,88 à 99,04 parce que le dossier ouvert affichait 0 % de dépassement).
  Les calculateurs sont désormais neutralisés pendant ces traitements (nom `Calc_Actif`).
- **Aperçu à zéro** : le classeur ne contenait aucun résultat pré-calculé ; ouvert en mode protégé, en aperçu de
  messagerie ou sur téléphone, il affichait « 0,00 — DOSSIER_INCOMPLET ». Les résultats sont maintenant enregistrés
  dans le fichier (Excel recalcule de toute façon à l'ouverture).
- **Pourcentages** : « 62 % » saisi au clavier devient 0,62 pour Excel et dégradait la note sans avertissement ;
  la colonne État le signale.
- **PD indicative** affichée (90 %) pour un dossier vide : elle n'est plus affichée quand le dossier est incomplet.
- **Impression** : l'impression du classeur produisait 115 pages ; la fiche s'imprime sur une page.
- Macros : recherche de la dernière ligne sans `End(xlUp)` (dépendait de l'affichage), plus aucune feuille créée
  par macro (rapport de validation fourni), listes déroulantes reconstruites en libellés, protection gérée.

## Architecture

Le moteur est **dans les formules** (onglet Resultat, inchangé) ; les macros orchestrent (dossier, portefeuille,
stress, autotests, journal, PDF). Barèmes, poids, seuils, alertes et libellés se modifient dans les onglets `P_*`
sans toucher au code. Les dossiers rouverts et le portefeuille utilisent les codes ; la saisie accepte codes et libellés.

## Fabrication

```bash
# depuis la racine du dépôt (sources : prisma/models/PI_PROMOTION_v5.0.0.json et code de l'application)
npx tsx tools/excel/_build/gen_refs.ts      # référentiels métier
npx tsx tools/excel/_build/gen_vectors.ts   # 26 cas de référence
npx tsx tools/excel/_build/gen_stress.ts    # stress attendu (dossier d'exemple)
cd tools/excel && python3 fabriquer_outil.py   # → .xlsm et .xlsx (LibreOffice et python3-uno requis)
```

`fabriquer_outil.py` : classeur de base (`build_workbook.py`) → LibreOffice recalcule (valeurs mises en cache) et
exporte le projet VBA des `.bas` → classeur final par xlsxwriter avec `vbaProject.bin` → ajout du ruban.

## Vérifications (outil 5.1)

```bash
cd tools/excel
python3 _build/libreoffice/verifier_formules.py PI_Promotion_Modele_v5.xlsm _build/vectors.json            # codes
python3 _build/libreoffice/verifier_formules.py PI_Promotion_Modele_v5.xlsm _build/vectors.json libelles   # saisie en clair
python3 _build/libreoffice/verifier_calculateurs_v5.py PI_Promotion_Modele_v5.xlsm
cp PI_Promotion_Modele_v5.xlsm /tmp/essai.xlsm     # les macros modifient le fichier chargé
python3 _build/libreoffice/verifier_macros.py /tmp/essai.xlsm integre _build/stress_expected.json _build/vectors.json
```

| Contrôle (LibreOffice Calc, `.xlsm` et `.xlsx`) | Résultat |
|---|---|
| Formules sur les 26 cas de référence du moteur de production — saisie par codes | 26 / 26 |
| Idem, saisie par libellés en clair (modalités, segment, zone) | 26 / 26 |
| Calculateurs v5 comparés aux fonctions de l'application ; calculateur vide = aucune valeur injectée | 10 / 10 |
| Projet VBA intégré au `.xlsm` relu (7 modules) et macros exécutées | conforme |
| Stress (7 scénarios) comparé au moteur de l'application | identique |
| Autotests et portefeuille **avec un calculateur rempli** sur le dossier courant | 26 / 26 ; 3 / 3 |
| Enregistrer puis rouvrir un dossier : même score, même décision, libellés en clair | conforme |
| Paramètres (afficher / masquer), listes, ruban, instantané, nouveau dossier, boutons, validation du modèle | conforme, 0 erreur |
| Dossier vide : aucune erreur de formule ; données décisionnelles signalées ; « Dossier incomplet » | conforme |
| Fiche : impression | 1 page A4 |

**Limite** : ces contrôles s'exécutent sous LibreOffice (pas d'Excel dans l'environnement de fabrication). Le projet
VBA du `.xlsm` est relu par `olevba` comme par Excel, mais la première ouverture sous Excel (ruban, macros, export PDF —
`ExportAsFixedFormat` n'existe pas sous LibreOffice) reste la recette de référence. En cas de difficulté avec le `.xlsm`,
utiliser le `.xlsx` et importer les modules (`Alt+F11` › Fichier › Importer, puis `InstallerBoutons`).

## Limites d'usage

- La **classe réglementaire BAM est saisie** ; seule une suggestion fondée sur le retard de paiement est affichée.
- Absents du classeur : trésorerie mensuelle, LGD, IFRS 9, workflow d'approbation, historique multi-utilisateurs.
- La **PD est indicative** (non calibrée).
- Le Portefeuille garde les valeurs utilisées, pas le détail des calculateurs ni la phase (challenger).
- Classeur individuel : le journal est un aide-mémoire, pas une piste d'audit opposable. La décision officielle se prend dans l'application.
- À chaque nouvelle version publiée du modèle, refabriquer l'outil.
