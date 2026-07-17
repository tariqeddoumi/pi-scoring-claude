# Diagnostic — code vs spécifications fonctionnelles (juillet 2026)

Spécification de référence : outil de **scoring des projets de promotion immobilière**
dont le cœur est le **suivi détaillé des projets (tous les événements, tous types
d'actifs)** et le **scoring régulier** piloté par l'avancement et les événements,
en alignement avec la **circulaire 1/W/2025** (classification & provisionnement),
les **normes IFRS 9**, la **réglementation BAM** et le dispositif **prudentiel en
méthode standard**.

## 1. Couverture constatée (avant optimisation)

| Domaine de la spec | État | Implémentation |
|---|---|---|
| Scoring multicritère promotion (D1–D5, gates, red flags, segments/zones) | ✅ Complet | `scoringEngine.ts`, modèle v2 (échelle 1–10), Model Builder éditable |
| Scoring actifs d'exploitation (hôtels, bureaux loués) | ✅ Complet | `exploitationModel.ts` v2 (même échelle) |
| Classification 1/W/2025 : sensibles art.5 (dont triggers promotion), souffrance art.10–12 (DPD, in fine, dépassements, comptes débiteurs), compromis promotion art.12.6/12.7, CTX art.12.8 | ✅ Complet | `referenceData.ts` (REGIME_1W_2025), `regulatoryClassificationEngine.ts` |
| Restructurations art.17–31 (planchers, période d'observation, récidive) | ✅ Complet | `restructuringFloor()` |
| Effet groupe art.50 + contagion contrepartie | ✅ Complet | `classify()` + `getCounterpartyExposure` |
| Provisionnement 1/W (quotités garanties, abattements, agios réservés, dérogations comité) | ✅ Complet | `provisioningEngine.ts`, `guaranteeEligibilityEngine.ts`, `OverridePanel` |
| Suivi commercialisation (tranches, lots, BP v0 vs courant, dérive, mainlevées) | ✅ Complet | `Tranche`/`Unit`, `commercialisation.ts`, `businessPlan.ts` |
| Visites de chantier (+ extraction IA) | ✅ Complet | `VisitReport`, `visitReports.ts`, extracteur Claude |
| Pont suivi → inputs de scoring | ✅ Partiel → étendu | `scoringSignals.ts` (commercialisation/avancement seulement) |
| **Journal unifié de TOUS les événements du projet** | ❌ Manquant | — |
| **Scoring régulier (périodicité par classe, déclenchement sur événement)** | ❌ Manquant | — |
| Suivi pour tous types de projet | ⚠️ Limité | bouton suivi réservé aux projets PROMOTION |
| IFRS 9 : staging (classe BKAM → stage), ECL 12 m / lifetime, double cadre BKAM/IFRS | ✅ Complet | `riskMetrics.ts`, `ifrs9.ts`, calibrage éditable |
| Prudentiel : slotting Bâle + RWA | ⚠️ IRB indicatif seulement | `riskMetrics.ts` (slotting) — **pas de méthode standard** alors que c'est l'approche retenue |
| Stress test, matrice de migration, backtesting PD, audit trail, workflow, RBAC | ✅ Complet | modules dédiés |

## 2. Écarts identifiés et corrections apportées

### 2.1 Journal d'événements projet (cœur de la spec) — AJOUTÉ
- Nouveau modèle **`ProjectEvent`** : type (référentiel de 21 types — déblocage,
  incident de paiement, arrêt/reprise de chantier, problème administratif,
  autorisation, réception, litige, saisie/ATD, redressement judiciaire,
  restructuration, avenant, garantie, mainlevée, commercialisation,
  actionnariat…), sévérité, dates début/fin, montant, note, **matérialité
  scoring** (`affectsScoring`), clôture, auteur — le tout audité.
- **Timeline chronologique unifiée** sur la page suivi : événements + visites +
  révisions BP + étapes du circuit + scorings.
- Disponible pour **tous les types de projet** (promotion et exploitation).

### 2.2 Événements → classification 1/W — AJOUTÉ
`eventSignals.ts` (pur, testé) dérive des événements OUVERTS les inputs 1/W :
arrêt de chantier > 1 an → art.12.7 (compromis) ; problème administratif > 1 an
→ art.5.3 (sensible) ; saisie/ATD → art.5.1 ; redressement judiciaire →
art.11.6 ; litige → art.12.8 (CTX) ; info négative Crédit Bureau → art.5.2 ;
restructuration → régime art.17–31. Intégré à la synchronisation
suivi → inputs (qui fonctionne désormais aussi sans lots, pour l'exploitation).

### 2.3 Scoring régulier — AJOUTÉ
`reviewPolicy.ts` (pur, testé) : périodicité de revue par classe (**sain 365 j,
sensible 90 j, souffrance 30 j** — paramétrable), statuts
`FRESH / DUE_SOON / OVERDUE / EVENT_TRIGGERED / NEVER_SCORED`. Un événement
matériel postérieur au dernier calcul déclenche le re-scoring immédiat.
Intégré : bannière sur la fiche projet, compteur + file « Scorings à
rafraîchir » sur les tableaux de bord (front et risque).

### 2.4 Prudentiel méthode standard — AJOUTÉ
`standardApproach.ts` (pur, testé) : pondérations méthode standard pour les
expositions immobilières (promotion/ADC **150 %**, réduite à 100 % si critères
prudentiels — pré-ventes ≥ 50 % et fonds propres ≥ 20 %, paramétrables ;
immobilier de rapport 100 % ; **défaut 150 %/100 % selon provisionnement ≥ 20 %**),
RWA sur **EAD nette des provisions spécifiques**, exigence de fonds propres au
**ratio de solvabilité BAM 12 %**. Affiché sur la fiche projet comme approche
retenue ; le slotting IRB devient une lecture interne indicative.

## 2bis. Finalisation ergonomie (comparaison aux bonnes pratiques)

Cible « bonnes pratiques » d'un outil de scoring + suivi rapproché : un dossier
= une vue à 360° (synthèse en 10 secondes), trois espaces stables (fiche /
saisie-scoring / suivi-événements), un guidage « que faire maintenant ? » par
profil, et une jauge de complétude avant soumission. Réalisé :

- **Sous-navigation unifiée** `Fiche du dossier | Saisie & scoring | Suivi &
  événements` sur les trois pages du dossier (`ProjectSubnav`).
- **Synthèse du dossier** en tête de fiche : score/décision, classe BKAM,
  provision, étape du circuit, fraîcheur du score.
- **Jauge de complétude** de la saisie (globale + étapes incomplètes + champs
  critiques manquants) — `completeness.ts` (pur, testé).
- **Guide « prochaine action »** selon rôle × étape × fraîcheur × complétude —
  `nextAction.ts` (pur, testé) : le CA est guidé vers la saisie puis la
  soumission, le DCA vers son avis, la contre-étude vers le re-scoring puis la
  validation, le décideur vers la décision, et après approbation vers le suivi
  rapproché ; les non-acteurs voient une mention d'attente claire.

## 3. Écarts restants (backlog priorisé)

1. **DPD automatique depuis l'échéancier** : `Installment` existe mais
   `dpd_days` reste saisi ; dériver le retard réel (jours depuis la plus
   ancienne échéance impayée) sécuriserait les bascules art.10–12.
2. **Déblocages vs avancement** : rapprocher les tirages (`Facility.drawnAmount`
   / événements `deblocage`) de l'avancement constaté pour détecter les
   décaissements en avance de phase.
3. **SICR IFRS 9 enrichi** : le staging suit la classe BKAM ; ajouter des
   critères SICR complémentaires (dégradation de score relative, +30 j d'arriérés)
   pour les cas où la classe ne bouge pas encore.
4. **Rattachement organisationnel** : DCA limité à son centre d'affaires, DR à
   sa région (scoping des files et tableaux de bord).
5. **Alertes/notifications** : notifier le CA et la contre-étude quand un score
   passe « à rafraîchir » (aujourd'hui visible aux tableaux de bord seulement).
6. **Pondérations standard paramétrables en base** (comme le calibrage IRB),
   avec justification LTV documentée par dossier.
