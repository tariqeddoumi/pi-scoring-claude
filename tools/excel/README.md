# Outil Excel / VBA — Modèle PI_PROMOTION v4.0.0

Classeur qui implémente le modèle de scoring de promotion immobilière v4.0.0 (mêmes
critères, barèmes, alertes, seuils et invariants de décision que l'application).

## Contenu

| Fichier | Rôle |
|---|---|
| `PI_Promotion_Modele_v4.xlsx` | Classeur : Saisie, Resultat, Calculateurs, Portefeuille, Stress, Tests, Historique, paramètres `P_*` |
| `vba/*.bas` | 5 modules VBA (outils, scoring, stress, validation du modèle, installation des boutons) |
| `build_workbook.py` | Régénère le classeur depuis les JSON de `_build/` |
| `_build/*.json` | Modèle v4 extrait de la base (`meta`, `criteres`, `baremes`, `alertes`) et 20 cas de référence (`vectors.json`) issus du moteur de production |
| `_build/gen_vectors.ts` | Génère `vectors.json` avec le moteur TypeScript de production |
| `_build/verify.py`, `verify_calc.py` | Recalculent le classeur avec la bibliothèque Python `formulas` et le comparent aux cas de référence |

## Architecture

Le moteur est **dans les formules Excel** (SUMPRODUCT, noms définis). Le VBA ne fait
qu'orchestrer : charger un dossier, recalculer, lire le résultat, boucler, journaliser.
Il n'y a donc qu'un seul moteur, et barèmes, poids, seuils et alertes se modifient dans
les onglets `P_*` sans toucher au code.

## Installation (2 minutes)

1. Ouvrir `PI_Promotion_Modele_v4.xlsx` dans Excel (Windows recommandé).
2. `Alt + F11` → *Fichier → Importer un fichier…* → importer les 5 fichiers de `vba/`.
3. *Débogage → Compiler VBAProject* : aucune erreur attendue.
4. `Alt + F8` → exécuter `InstallerBoutons`.
5. *Enregistrer sous…* → **Classeur Excel prenant en charge les macros (.xlsm)**.
6. Exécuter `ExecuterAutotests` : attendu « 20 / 20 cas conformes ».
7. Exécuter `ValiderModele` : attendu 0 erreur.

## Utilisation

- **Saisie** : cellules jaunes (colonne E). Booléens : « Oui » / « Non ». Une valeur saisie prime sur une valeur calculée.
- **Calculateurs** : autorisations, ventes sécurisées par financement acquéreur, mainlevée vs équilibre, division des risques. Ils alimentent 7 clés dérivées (colonne F de Saisie).
- **Resultat** : score, décision, classe interne, PD indicative, détail par domaine, critère et alerte.
- **Portefeuille** : une ligne par dossier → `ScorerPortefeuille`.
- **Stress** : 7 scénarios modifiables → `LancerStress`.
- **P_\*** : paramètres du modèle (bleus). Après modification : `ValiderModele`, puis `SnapshotModele`.

## Vérifications réalisées

- 20 cas de référence issus du moteur de production recalculés par un moteur de formules indépendant : **20/20 identiques** (score, décision, classe, malus, dossier incomplet, scores de domaine, notes économique et sûretés ; tolérance 0,02).
- Calculateurs vérifiés sur un scénario de valeurs connues.
- Contrôles de `ValiderModele` rejoués : 0 erreur.
- Code VBA : analyse statique (noms, feuilles, clés, blocs, boutons).

## Limites — à lire

- **Les macros VBA n'ont pas été exécutées dans Excel** (pas d'Excel dans l'environnement de construction). Si la compilation VBA signale une erreur, corriger d'abord ce point ; les autotests sont la première étape de recette.
- Le livrable est un `.xlsx` + des `.bas` : un `.xlsm` ne peut pas être fabriqué de façon fiable hors d'Excel.
- La **classe réglementaire BAM est saisie** ; seule une suggestion fondée sur le retard de paiement (90 / 180 / 360 j) est affichée. Déclencheurs qualitatifs de la circulaire 1/W, restructuration et contagion de groupe : hors classeur.
- Absents du classeur : trésorerie mensuelle, LGD par waterfall, IFRS 9, workflow d'approbation, historique multi-utilisateurs.
- La **PD est indicative** (non calibrée) : ne pas l'utiliser pour des pertes attendues ni du capital.
- Un classeur est individuel : le journal est un aide-mémoire, pas une piste d'audit opposable.
- **Divergence** : à chaque nouvelle version publiée du modèle, régénérer le classeur ; l'application reste la source de vérité.

## Régénération

```bash
cd tools/excel
# 1. (re)générer les 20 cas de référence avec le moteur de production, depuis la racine du dépôt
npx tsx tools/excel/_build/gen_vectors.ts
# 2. reconstruire le classeur (écrit dans _build/)
python3 build_workbook.py
# 3. vérifier (nécessite : pip install formulas openpyxl xlsxwriter)
python3 _build/verify.py
cp _build/PI_Promotion_Modele_v4.xlsx PI_Promotion_Modele_v4.xlsx
```
