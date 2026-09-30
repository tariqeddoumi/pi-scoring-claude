# Outil Excel / VBA — Modèle PI_PROMOTION v4.0.0 (outil 4.1)

Classeur qui implémente le modèle de scoring de promotion immobilière publié
(mêmes critères, barèmes, alertes, seuils et invariants de décision que
l'application).

## Contenu

| Fichier | Rôle |
|---|---|
| `PI_Promotion_Modele_v4.xlsx` | Classeur : Saisie (avec un dossier d'exemple), Resultat, Calculateurs, Portefeuille, Stress, Tests, Historique, paramètres `P_*` |
| `vba/*.bas` | 5 modules VBA (outils, scoring, stress, gouvernance du modèle, installation des boutons) — ASCII, sans bibliothèque externe |
| `build_workbook.py` | Régénère le classeur |
| `_build/gen_vectors.ts` | 20 cas de référence calculés par le moteur de production → `vectors.json` |
| `_build/gen_stress.ts` | Stress attendu sur le dossier d'exemple, moteur de l'application → `stress_expected.json` |
| `_build/gen_refs.ts` | Référentiels métier exportés du code de l'application → `referentiels.json` |
| `_build/libreoffice/` | Banc de vérification : recalcul des formules et exécution réelle des macros sous LibreOffice |
| `_build/verify.py` | Vérification alternative des formules (bibliothèque Python `formulas`) |

**Sources uniques** : le modèle est lu dans `prisma/models/PI_PROMOTION_v4.0.0.json`
(instantané exact de la base de production) ; les référentiels et les cas de
référence sont produits par le code de l'application. Aucune donnée n'est
recopiée à la main.

## Architecture

Le moteur est **dans les formules Excel**. Le VBA ne fait qu'orchestrer :
charger un dossier, recalculer, lire le résultat, boucler, journaliser. Il n'y a
donc qu'un seul moteur ; barèmes, poids, seuils et alertes se modifient dans les
onglets `P_*` sans toucher au code.

## Installation (2 minutes)

1. Ouvrir `PI_Promotion_Modele_v4.xlsx` dans Excel (Windows recommandé).
2. `Alt + F11` → *Fichier → Importer un fichier…* → importer les 5 fichiers de `vba/`.
3. *Débogage → Compiler VBAProject* : aucune erreur attendue.
4. `Alt + F8` → exécuter `InstallerBoutons`.
5. *Enregistrer sous…* → **Classeur Excel prenant en charge les macros (.xlsm)**.
6. Exécuter `ExecuterAutotests` : attendu « 20 / 20 cas conformes ».
7. Exécuter `ValiderModele` : attendu 0 erreur.

## Utilisation

- **Nouveau dossier** : le classeur s'ouvre sur un dossier d'exemple. Le bouton
  « Nouveau dossier » (`NouveauDossier`) vide la saisie et les calculateurs ; les
  paramètres de l'établissement (fonds propres, limites) sont conservés.
- **Saisie** : cellules jaunes. Un champ **vide = donnée absente** (jamais 0, jamais
  « Non »). Booléens : « Oui » / « Non ». Une valeur saisie prime sur une valeur calculée.
- **Calculateurs** : A. chaîne d'autorisations · B. ventes sécurisées par le financement
  de l'acquéreur · C. mainlevée / quotité de désengagement · D. division des risques ·
  E. arrêt de chantier. Ils alimentent 8 données dérivées (colonne F de la Saisie).
- **Resultat** : score, décision, classe interne, notes économique et de sûretés,
  **données décisionnelles manquantes en clair**, **conditions à lever avec leur jalon**,
  alertes, retour en comité, détail par critère et par domaine.
- **Portefeuille** : une ligne par dossier → `ScorerPortefeuille` (15 colonnes de résultat,
  dont données manquantes et conditions).
- **Stress** : 7 scénarios → `LancerStress` (mêmes chocs que l'application).
- **P_\*** : paramètres du modèle. Après modification : `ValiderModele`, puis `SnapshotModele`.

## Vérifications (outil 4.1)

| Contrôle | Résultat |
|---|---|
| Formules recalculées par **LibreOffice Calc** sur les 20 cas de référence du moteur de production | 20 / 20 |
| Macros **exécutées** sous LibreOffice (mode de compatibilité VBA) : autotests, dossier, portefeuille, stress, validation, listes, instantané, nouveau dossier, boutons | toutes exécutées sans erreur |
| Autotests lancés par la macro | 20 / 20 |
| Stress VBA comparé au moteur de stress de l'application (7 scénarios) | identique |
| `ValiderModele` | 0 erreur |

Corrections apportées au VBA de l'outil 4.0 grâce à cette exécution réelle :

- `modStress` ne compilait pas sous LibreOffice (instructions `If … Then … Else …`
  sur une seule ligne avec appels de procédure) → réécrites en blocs `If … End If` ;
- la recherche des clés reposait sur `Application.Match`, dont le comportement
  « non trouvé » varie selon le tableur → remplacée par une recherche explicite ;
- la lecture de l'indicateur « dossier incomplet » comparait une cellule à `True`
  (-1) → lecture robuste des valeurs logiques (`EstVrai`) ;
- `SnapshotModele` dépendait de la constante `xlOpenXMLWorkbook` → valeur explicite ;
- l'installation des boutons s'arrêtait au premier échec → chaque bouton est
  tenté et les échecs éventuels sont listés.

**Limite restante** : LibreOffice n'est pas Excel. Les macros ont été exécutées
sous LibreOffice ; la première exécution sous Excel (étapes 3 et 6 de
l'installation) reste la recette de référence.

## Limites d'usage

- Le livrable est un `.xlsx` + des `.bas` : un `.xlsm` ne peut pas être fabriqué de façon fiable hors d'Excel.
- La **classe réglementaire BAM est saisie** ; seule une suggestion fondée sur le retard de paiement est affichée.
- Absents du classeur : trésorerie mensuelle, LGD, IFRS 9, workflow d'approbation, historique multi-utilisateurs.
- La **PD est indicative** (non calibrée).
- Classeur individuel : le journal est un aide-mémoire, pas une piste d'audit opposable. La décision officielle se prend dans l'application.
- À chaque nouvelle version publiée du modèle, régénérer le classeur.

## Régénération

```bash
# depuis la racine du dépôt
npx tsx tools/excel/_build/gen_refs.ts      # référentiels métier
npx tsx tools/excel/_build/gen_vectors.ts   # 20 cas de référence
npx tsx tools/excel/_build/gen_stress.ts    # stress attendu (dossier d'exemple)
python3 tools/excel/build_workbook.py       # écrit tools/excel/PI_Promotion_Modele_v4.xlsx

# vérification sous LibreOffice (paquets libreoffice-calc et python3-uno)
cd tools/excel
python3 _build/libreoffice/verifier_formules.py PI_Promotion_Modele_v4.xlsx _build/vectors.json
cp PI_Promotion_Modele_v4.xlsx /tmp/essai.xlsx   # les macros modifient le fichier chargé
LO_VISIBLE=1 python3 _build/libreoffice/verifier_macros.py /tmp/essai.xlsx vba _build/stress_expected.json
```
