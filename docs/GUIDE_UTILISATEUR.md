# Guide utilisateur — Analyste / Chargé d'affaires

## 1. Tableau de bord
Vue portefeuille : nombre de projets, exposition totale, provisions BKAM, taux de
couverture, répartition par classe BKAM et par décision, projets récents.

## 2. Créer / ouvrir un projet
**Projets** liste tous les dossiers. Cliquez sur une référence pour ouvrir le détail.
Le détail comporte 12 onglets : Identification, Promoteur, Foncier, Autorisations,
Commercialisation, Financement, Cash-flow, Garanties, Classification BKAM,
Provisionnement, Scoring, Audit.

## 3. Saisir les données (wizard de scoring)
Depuis le détail projet → **Wizard de scoring**. Le wizard est multi-étapes :

1. **Promoteur & Gouvernance** (D1)
2. **Qualité du projet** — Foncier / Autorisations (D2)
3. **Commercialisation & Cash-flow** (D3)
4. **Structuration financière & LGD** (D4)
5. **Vulnérabilité réglementaire BAM** (D5 + déclencheurs de classification)

> Privilégiez le **cash réel** : préventes encaissées, cash coverage, impasse. Les
> réservations non encaissées ne doivent pas être saisies comme du cash sécurisé.

- **Enregistrer brouillon** : sauvegarde sans calculer (validation Zod).
- **Enregistrer & calculer** : sauvegarde puis lance le scoring complet.

## 4. Lire le résultat
Onglet **Scoring** :
- Jauge de **score final 0..100** et **décision** (GO / sous conditions / watch / NO_GO).
- **Scores par domaine** D1..D4 et contributions.
- **Red flags D5** déclenchés (malus ou souffrance automatique).

Onglet **Classification BKAM** : classe retenue, watch list, contagion groupe,
déclencheurs (avec l'article applicable), note de restructuration.

Onglet **Provisionnement** : EAD, agios réservés, garanties éligibles (avec quotité de
base et quotité effective après abattement), base provisionnable, taux et provision.

## 5. Règles bloquantes à connaître
- **Contentieux (CTX)** ⇒ décision **NO_GO** et **score final = 0**.
- **Impayé ≥ 90 jours** ou **projet à l'arrêt ≥ 12 mois** ⇒ souffrance automatique
  (hors score), décision NO_GO.
- Un **gate** non satisfait (ex. apport effectif < 80 %, foncier/autorisations absents)
  force le NO_GO.

## 6. Audit
Toute exécution est tracée (onglet Audit du projet et page **Audit** globale) avec
l'acteur, l'horodatage et les valeurs calculées.
