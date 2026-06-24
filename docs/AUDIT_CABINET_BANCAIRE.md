# Audit indépendant — Outil de scoring de promotion immobilière (BKAM)

> Mission : revue d'aptitude bancaire d'une solution de scoring / classification / provisionnement
> promotion immobilière, conforme aux circulaires Bank Al‑Maghrib 19/G/2002 et 1/W/2025.
> Niveau attendu : direction des risques / cabinet conseil bancaire (Risk Advisory).
> Périmètre : repository complet (front Next.js, back Node/Prisma, moteurs métier, base Supabase/PostgreSQL).
> Date : 2026‑06‑24 · Version auditée : V1.0 (`PI_PROMOTION v1.0.0`).

---

## 0. Synthèse exécutive (Executive Summary)

**Verdict global : 6,2 / 10 — « Outil métier avancé / pré‑risque », pas encore « outil bancaire de production ».**

La solution se distingue par un **noyau métier de très bonne facture** : moteurs de calcul purs, déterministes et testés, entièrement **paramétrés par la donnée** (aucune règle codée en dur), un **modèle de scoring versionné**, et une **couverture réglementaire BKAM dense et correctement référencée** (articles 19/G et 1/W cités, triggers immobiliers, restructuration art.17‑31, effet groupe, garanties et abattements progressifs, créance irrégulière art.4bis). C'est nettement au‑dessus d'un POC : l'ossature d'un véritable moteur de risque est là.

En revanche, la solution **n'est pas déployable en production bancaire en l'état** pour trois raisons bloquantes :

1. **Sécurité non implémentée** — pas d'authentification appliquée (aucun middleware), **RBAC défini mais jamais invoqué**, repli automatique sur un utilisateur démo, RLS désactivé sur les 30 tables (clé anon = accès total). C'est un *no‑go* réglementaire et sécurité.
2. **Modèle non validé statistiquement** — pondérations à dire d'expert, PD proxy non calibré sur historique, **aucun backtesting ni pouvoir discriminant mesuré** (Gini/AUC/KS absents). Un modèle de notation interne non validé n'est pas utilisable pour des décisions de crédit ni pour le provisionnement réglementaire.
3. **Chaînes opérationnelles incomplètes** — workflow comité non câblé (modèle de données seul), import en *stub*, EAD simpliste (= montant du prêt), **GFA / compte séquestre absents** alors qu'ils sont structurants en VEFA.

**Trajectoire recommandée :** la base est suffisamment saine pour viser une **V2 industrialisable en 4–6 mois** (sécurité + workflow + données) puis une **V3 « plateforme risque »** (calibration statistique, IFRS9/ECL, intégration SI bancaire). Le risque de réécriture est faible : on capitalise sur l'existant.

### Scorecard (note /10)

| Axe | Note | Commentaire |
|---|---:|---|
| **Technique / architecture** | **7,5** | Découplage moteurs/persistance exemplaire, code lisible, typé strict. Manque tests d'intégration, CI/CD, observabilité. |
| **Métier (crédit promotion)** | **6,5** | Couverture promoteur/projet/commercial/financement solide. Manque GFA, VEFA, absorption marché, échéancier. |
| **Modèle de risque** | **5,0** | Architecture de scoring saine mais **non calibrée**, pas de backtesting, PD proxy heuristique. |
| **Sécurité** | **2,5** | Auth/RBAC non appliqués, RLS off, routes ouvertes. Conception RBAC correcte mais inerte. |
| **Réglementaire BKAM** | **7,0** | Très bonne fidélité 19/G & 1/W. Manque ECL/IFRS9, échéancier réel, période d'observation forbearance. |
| **Industrialisation** | **4,0** | Pas de CI/CD, migrations Prisma non jouées (DDL SQL manuel), pas de monitoring, import non câblé. |
| **Global pondéré** | **6,2** | Excellent socle, bloquants sécurité + validation modèle à lever avant tout usage réel. |

---

## 1. Audit d'architecture

### 1.1 Structure et séparation des couches

```
app/                 Présentation (Next.js App Router, Server Components)
  page.tsx           Dashboard portefeuille
  projects/          Liste, détail, wizard scoring
  admin/             Model Builder (lecture), Régimes (lecture)
  audit/             Journal d'audit
  imports/           Import (STUB)
  api/export/        Routes export CSV / rapport HTML
components/          UI réutilisable (Tabs, Gauge, Chart, Wizard, boutons)
server/
  actions/           Server Actions (saveProjectInputs, runScoringAction)
  services/          Orchestration (scoringService = 1 transaction), modelLoader
  engines/           Moteurs PURS : scoring, classification, garanties, provision, audit
  queries.ts         Read models pour l'UI
  export.ts          Génération CSV + rapport comité HTML
lib/
  domain/            types.ts, ruleEngine.ts (DSL), referenceData.ts (source de vérité)
  rbac.ts            Rôles/permissions (DÉFINI mais non appliqué)
  validation.ts      Schémas Zod
  prisma.ts          Singleton Prisma
  supabase/          Client/serveur (auth session uniquement)
prisma/              schema.prisma, schema.pi_scoring.sql, seed.ts, generateSeedSql.ts
tests/               4 fichiers unitaires (moteurs)
docs/                Guides utilisateur/admin/déploiement, conformité, comparatif
```

**Appréciation : architecture en couches propre et idiomatique.** Le point fort majeur est le **découplage total des moteurs métier vis‑à‑vis de Prisma** : `scoringEngine`, `regulatoryClassificationEngine`, `guaranteeEligibilityEngine`, `provisioningEngine` ne dépendent que de types purs (`lib/domain/types.ts`) et d'un DSL de règles. Le `modelLoader` traduit la configuration persistée (Prisma) en objets de configuration purs ; les moteurs sont donc **testables sans base** et **rejouables**. C'est un patron « hexagonal léger » bien exécuté.

### 1.2 Modularité, maintenabilité, dette technique

- **Modularité : bonne.** Un fichier = une responsabilité. Le `scoringService` orchestre une **transaction unique** (atomicité scoring→classification→provision→audit), ce qui est exactement ce qu'attend une DSI risque.
- **Configuration centralisée :** `referenceData.ts` est l'unique source de vérité, réutilisée par le seed Prisma **et** par le générateur SQL (`generateSeedSql.ts`) — cohérence garantie entre code et données.
- **Dette technique identifiée :**
  - **Double schéma de base** : `schema.prisma` (ORM) **et** `schema.pi_scoring.sql` (DDL appliqué à la main). Risque de dérive : les migrations Prisma ne sont pas la source de vérité du déploiement. À unifier (Prisma multiSchema ou migration générée).
  - **Incohérence d'échelle de notation** : les commentaires/types annoncent des scores critères « 0..10 » alors que la donnée et le `scoreScale` valent 5. Sans impact calcul (clamp sur `scale`), mais source de confusion.
  - **Nommage D1..D5** : 4 domaines pondérés (D1‑D4) + une couche « D5 » qui n'est pas un domaine mais un ensemble de red flags. Le test `produces 5 domain outcomes D1..D5` vérifie en réalité 4 codes — libellé trompeur.
  - **Repli silencieux sur acteur démo** (`getCurrentAppUser`) : pratique en démo, **dangereux en prod** (fausse identité d'audit).

### 1.3 Code mort / duplication / anti‑patterns / dépendances

- **Code mort fonctionnel :** `lib/rbac.ts::assertPermission`/`hasPermission` ne sont **jamais appelés** (références uniquement dans la doc). `getDemoActor` redondant avec le repli de `getCurrentAppUser`.
- **Duplication maîtrisée :** la logique de seed est dupliquée entre `seed.ts` (Prisma) et `generateSeedSql.ts` (SQL) — acceptable car même source `referenceData`, mais deux chemins à maintenir.
- **Anti‑patterns :** repli d'authentification ; absence de couche d'autorisation sur les Server Actions et les routes API.
- **Dépendances :** stack cohérente (Next 14, Prisma 5, Zod, Recharts, Radix, Supabase SSR). Pas de dépendance superflue notable. `@supabase/supabase-js` peu exploité (auth seulement).

### 1.4 Diagramme logique (actuel)

```
[Navigateur] ──► [Next.js App Router / Server Components]
                      │ (Server Actions)
                      ▼
                 [server/actions] ──► [scoringService (TX unique)]
                      │                     │
                      │           ┌─────────┼───────────────┐
                      │           ▼         ▼               ▼
                      │     [classify] [runScoring] [guarantees+provision]
                      │           └─────────┴───────────────┘
                      │                     │ (modelLoader: DB→config pure)
                      ▼                     ▼
                 [Prisma Client] ──────► [PostgreSQL / Supabase  schéma pi_scoring]
                      ▲
                 [Supabase Auth (session)]  ← non relié à l'autorisation applicative
```

### 1.5 Architecture cible V2

```
                         ┌────────────────────────────────────────┐
                         │  IdP bancaire (Azure AD / SSO OIDC)     │
                         └───────────────┬────────────────────────┘
                                         │ JWT/OIDC
[Navigateur SPA]──►[Edge middleware: authN + RBAC + rate‑limit + CSRF]
        │                                 │
        ▼                                 ▼
 [API Gateway / BFF]──►[Couche application (use‑cases, autorisation par permission)]
        │                                 │
        │              ┌──────────────────┼─────────────────────┐
        ▼              ▼                  ▼                     ▼
 [Moteurs purs]  [Workflow engine]  [Calibration/PD service]  [Reporting/ECL]
        │              │                  │                     │
        └──────────────┴───────┬──────────┴─────────────────────┘
                               ▼
                    [PostgreSQL : domaine + audit immuable (append‑only)]
                               │
                  [Bus d'événements / journalisation SIEM]──►[Observabilité]
```

Principes V2 : middleware d'auth/RBAC obligatoire ; couche use‑case portant l'autorisation ; service de calibration/PD séparé ; workflow comme machine à états explicite ; audit append‑only ; observabilité (logs structurés, métriques, traces) ; CI/CD avec migrations Prisma comme seule source de vérité du schéma.

---

## 2. Audit front‑end

**Écrans présents :** Dashboard portefeuille, Liste projets, Détail projet, Wizard de scoring (5 étapes alignées D1‑D5), Model Builder (lecture seule), Régimes (lecture seule), Journal d'audit, Import (stub), exports CSV/HTML.

**Points forts :** Server Components (rendu serveur, bon TTFB), `force-dynamic` adapté à des données fraîches, garde `DbSetupNotice`/`safe()` élégante pour environnement non configuré, UI cohérente (Radix + Tailwind), wizard structuré par domaine de risque, rapport comité HTML imprimable en PDF.

**Faiblesses UX bancaires :**
- **Pas de dashboard risque véritable** : KPI agrégés simples (exposition, provisions, couverture) mais **pas de heatmap classe×décision, pas de matrice de migration, pas d'analyse de concentration** (par promoteur, groupe, zone, segment), pas de vintage, pas de top expositions.
- **Model Builder & Régimes en lecture seule** : l'argumentaire « administrable » n'est pas tenu côté UI (édition non implémentée).
- **Gestion d'état minimale** : pas de state client complexe (acceptable), mais pas de feedback optimiste ni de gestion d'erreurs fine côté wizard au‑delà de Zod.
- **Accessibilité / responsive** : Tailwind responsive de base ; pas d'audit a11y (contrастes, ARIA, navigation clavier des tableaux).
- **Écran « Import » non fonctionnel** (parseur non câblé) — à retirer ou implémenter.

**Écrans manquants (cible risque) :** Heatmap portefeuille · Matrice de migration des notes · Fiche comité interactive (vs HTML statique) · Radar scoring par domaine · File d'attente workflow (mes dossiers à traiter) · Stress testing / scénarios · Suivi des garanties et revalorisations · Comparateur de versions de modèle.

---

## 3. Audit back‑end

**API / services :** Server Actions (`saveProjectInputs`, `runScoringAction`) + routes API export. Orchestration via `scoringService.runFullScoring` dans **une transaction Prisma unique** — atomicité correcte. `modelLoader` isole le mapping DB→config.

**Moteurs métier :** purs, déterministes, sans effet de bord, bien commentés (références aux articles BKAM). `ruleEngine` (DSL all/any/clause) propre et réutilisé par red flags et triggers. Arrondis cohérents (`round2`), clamps systématiques.

**Validation :** Zod côté serveur sur toutes les entrées de scoring (`scoringInputsSchema`), alignée sur les `inputKey` de `referenceData`. Bon point.

**Faiblesses :**
- **Gestion d'erreurs hétérogène** : `runScoringAction` renvoie `{ok:false}` ; les routes API renvoient 503 ; pas de taxonomie d'erreurs ni de codes métier, pas de logs structurés.
- **Couplage** : les Server Actions appellent `getCurrentAppUser` qui **importe Prisma dynamiquement** et **mélange auth Supabase + table User** ; frontière auth/identité floue.
- **Performances** : `getPortfolioStats` agrège en mémoire après un `findMany` avec includes (N+1 maîtrisé via include, mais pas de pagination ni d'agrégation SQL) — ne passera pas l'échelle portefeuille (>10⁴ dossiers).
- **EAD simpliste** : `ead = loanAmount` par défaut, agios saisis à la main — éloigné d'un calcul d'exposition réel (encours + engagements hors‑bilan).
- **Testabilité** : excellente pour les moteurs (purs) ; faible pour services/actions (aucun test d'intégration, dépendance Prisma non mockée).

---

## 4. Audit base de données

**Modèle Prisma (30 tables, schéma isolé `pi_scoring`).** Entités : RBAC (Role, Permission, RolePermission, User), Promoteur/Projet/Inputs, Modèle versionné (ScoringModel→Version→Domain→Criterion→Option/Range, RedFlagRule), Runs (ScoringRun, CriterionResult, DomainResult), Réglementaire (RegulatoryRegime, Class, Trigger, ProvisionRate, GuaranteeType, Guarantee), Runs réglementaires (ClassificationRun, ProvisionRun), Collaboration/Audit/Import (WorkflowStep, Comment, Attachment, AuditLog, ImportBatch).

**Points forts :**
- **Versioning du modèle** (ScoringModelVersion) et **du régime** (RegulatoryRegime.effectiveFrom/To) — essentiel pour la reproductibilité réglementaire.
- **Immuabilité d'audit** : `ScoringRun.inputSnapshot`, `ClassificationRun.inputSnapshot`, `AuditLog.before/after` capturent l'état au moment du calcul.
- **Normalisation correcte**, clés étrangères et `onDelete: Cascade` cohérents, contraintes d'unicité métier (`@@unique`), index sur les `projectId`, `entity/entityId`, `createdAt`.

**Faiblesses / tables manquantes :**
- **`groupId` est une chaîne libre** : pas d'entité Groupe/Contrepartie → l'effet groupe (art.33/50) repose sur un champ texte non contraint. **Manque : table `Counterparty`/`Group`.**
- **Pas d'échéancier ni d'historique d'impayés** : `dpd_days` est une valeur d'entrée ponctuelle, pas un échéancier (`RepaymentSchedule`, `ArrearsEvent`). Or la classification BKAM repose sur l'ancienneté réelle des impayés.
- **Pas de facilité / tranche / tirage** (`Facility`, `Drawdown`) : l'exposition n'est pas modélisée finement (EAD).
- **Garanties : pas d'historique de revalorisation** (`CollateralValuation` daté) ni de **GFA / compte séquestre** (voir §7).
- **Pas de décision de comité structurée** (`CommitteeDecision`, quorum, votes) ni de **période d'observation forbearance** (art.21‑25).
- **Pas d'échelle de notation / mapping notch→PD** persistée (`RatingScale`).
- **RLS désactivé** sur les 30 tables (cf. §5).

**Modèle cible V2 (ajouts) :** `Counterparty`/`Group`, `Facility`/`Drawdown`, `RepaymentSchedule`/`ArrearsEvent`, `CollateralValuation`, `GFA`/`EscrowAccount`, `CommitteeDecision`, `ForbearanceObservation`, `RatingScale`, `EclStaging` (IFRS9), `DataLineage` (imports), audit **append‑only** (révocation des UPDATE/DELETE).

---

## 5. Audit sécurité

**Constat central : la sécurité applicative est conçue mais non implémentée.**

| # | Risque | Gravité | Constat | Solution |
|---|---|---|---|---|
| S1 | **Aucune authentification appliquée** | 🔴 Critique | Pas de `middleware.ts` ; les pages et Server Actions sont accessibles sans session. | Middleware Next.js obligatoire : vérif session OIDC, redirection login, protection de toutes les routes. |
| S2 | **RBAC inerte** | 🔴 Critique | `assertPermission`/`hasPermission` jamais appelés ; aucune autorisation sur actions/exports. | Appeler `assertPermission` dans chaque use‑case ; centraliser l'autorisation dans la couche application. |
| S3 | **Repli sur acteur démo** | 🔴 Critique | `getCurrentAppUser` retourne l'analyste par défaut si auth absente → identité d'audit falsifiable. | Supprimer le repli en prod ; échouer fermé (deny‑by‑default). |
| S4 | **RLS désactivé (30 tables)** | 🔴 Critique | Clé `anon` Supabase = lecture/écriture totale sur `pi_scoring`. | Activer RLS + policies par rôle, ou n'exposer la base qu'au backend (clé service, jamais anon côté client). |
| S5 | **Routes d'export non protégées** | 🟠 Élevé | `/api/export/portfolio` et `/api/export/project/[id]` sans contrôle. | Exiger session + permission `export.run`. |
| S6 | **Pas de SSO / fédération** | 🟠 Élevé | Auth Supabase email seule, pas d'intégration annuaire bancaire. | Azure AD / OIDC, MFA, provisioning SCIM. |
| S7 | **Pas de journalisation sécurité** | 🟠 Élevé | AuditLog métier présent mais pas d'événements LOGIN/échecs/accès. | Journaliser authN/authZ, export vers SIEM. |
| S8 | **Pas de rate‑limiting / anti‑CSRF explicite** | 🟡 Moyen | Server Actions exposées sans throttling. | Rate‑limit edge, double‑submit/CSRF, en‑têtes sécurité (CSP, HSTS). |
| S9 | **Secrets dans `.env.example`** | 🟡 Moyen | Clé anon publique présente (par nature publique) — vérifier qu'aucun secret service n'est versionné. | Gestion via coffre (Key Vault), rotation. |
| S10 | **Injection** | 🟢 Faible | Accès via Prisma paramétré + Zod ; SQL brut limité au seed. | Maintenir l'usage exclusif de l'ORM ; revue des requêtes brutes. |

**Recommandations :** SSO Azure AD + MFA ; deny‑by‑default ; RLS ou backend‑only ; audit sécurité vers SIEM ; en‑têtes de sécurité ; revue OWASP ASVS niveau 2 minimum pour un outil bancaire interne.

---

## 6. Audit du modèle de scoring

**Architecture du modèle (saine) :** 4 domaines pondérés — D1 Sponsor & Gouvernance (0,22), D2 Qualité projet (0,18), D3 Commercial & Cash‑flow (0,28), D4 Structuration & LGD (0,22) — KPI notés 0..5 par options/barèmes, normalisés 0..100 ; ajustement segment/zone `S_adj = S_eco × (1 + α + β)` ; couche D5 (red flags) en malus + déclencheurs de souffrance ; modulateur réglementaire `CoeffBAM` par classe ; règles bloquantes (gate apport, CTX, souffrance) ; PD proxy logistique.

**Points forts :** logique transparente, traçable, déterministe et testée ; séparation nette entre score économique, ajustement macro‑local, pénalités réglementaires et coefficient prudentiel ; gates métier pertinents (apport effectif, foncier/autorisations).

**Faiblesses méthodologiques (déterminantes) :**
- **Calibration absente** : pondérations et bornes de barèmes sont à dire d'expert, non estimées sur données. Aucune justification statistique.
- **PD proxy heuristique** : la calibration `logit(PD)=2,223−0,0802·S` est avouée comme reconstruite à partir d'une table de référence, **non estimée sur défauts observés**. Inutilisable pour de l'ECL réglementaire.
- **Aucun pouvoir discriminant mesuré** : pas de Gini/AUC/KS, pas de courbe ROC, pas de matrice de confusion ni de taux de défaut par classe.
- **Pas de backtesting ni de migration des notes** : impossible de prouver la stabilité (PSI) ou la performance dans le temps.
- **Double comptage potentiel** : certains signaux alimentent à la fois un critère D3/D4 et un red flag D5 (ex. cash coverage, 1er rang) → la pénalité peut être comptée deux fois. À arbitrer explicitement.
- **Sensibilité non documentée** : pas d'analyse de sensibilité des seuils ni de stress des hypothèses.

**Recommandations (V2/V3) :** constituer une base de défauts (définition Bâle/BKAM) ; estimer un modèle logistique multivarié (sélection de variables, traitement colinéarité) ; mesurer Gini/AUC/KS ; calibrer une **PD par classe** et une **échelle de notation** (masterscale) ; backtesting annuel + suivi PSI ; gouvernance de modèle (validation indépendante, documentation, comité modèles) conforme aux attentes de saine gestion des modèles.

---

## 7. Audit promotion immobilière

| Dimension | Couverture | Détail |
|---|---|---|
| **Promoteur — expérience** | ✅ | `promoter_completed_projects`, `yearsExperience`, typologie (opportuniste/régional/structuré). |
| **Promoteur — solidité** | ✅ | Gearing, concentration mono‑projet, apport effectif (gate). |
| **Promoteur — gouvernance** | ✅ | Qualité gouvernance/structure juridique. |
| **Projet — foncier/autorisations** | ✅ | Gate bloquant (titre purgé + autorisations). |
| **Projet — pré‑commercialisation** | ✅ | `pre_sale_rate` (préventes encaissées), `sales_vs_plan`. |
| **Projet — écoulement / absorption** | 🟠 Partiel | `stock_rotation_months` proxy ; **pas de taux d'absorption vs offre locale**. |
| **Projet — avancement** | ✅ | `progress_vs_plan`, retards chantier (red flags). |
| **Marché — localisation** | ✅ | Ajustement `zone` (β). |
| **Marché — concurrence/sur‑offre** | 🟠 Partiel | `market_positioning` qualitatif ; pas de données marché objectives. |
| **Financement — fonds propres** | ✅ | `own_equity`, `equity_injected_ratio`, LTC. |
| **Financement — couverture** | ✅ | Cash coverage, impasse, interest coverage, marge stressée. |
| **Garanties — hypothèque** | ✅ | Rang 1, quotités, abattements, évaluation récente. |
| **Garanties — caution / banque** | ✅ | Garantie bancaire 1er ordre, caution perso (non admise). |
| **Garanties — GFA (achèvement)** | ❌ **Absent** | **Pas de garantie financière d'achèvement** — pourtant structurante en VEFA. |

**Risques non couverts (à intégrer) :**
- **VEFA / GFA / compte séquestre** : mécanique de vente en l'état futur d'achèvement absente (garantie d'achèvement, déblocages sur appels de fonds, séquestre des encaissements).
- **Absorption marché** : taux d'écoulement rapporté à l'offre/demande locale, prix au m² vs marché.
- **Phasage / tranches** : projets multi‑tranches non modélisés (chaque tranche a son risque).
- **Suivi technique indépendant** : rapports BET/huissier d'avancement non tracés.
- **Risque de contrepartie acheteurs** : qualité du carnet de préventes (financement acquéreurs, taux de désistement).

---

## 8. Audit réglementaire BKAM

| Exigence BKAM | Présente | Partielle | Absente | Recommandation |
|---|:--:|:--:|:--:|---|
| Classification créances 19/G (saine, pré‑douteux 90j, douteux 180j, compromis 360j, CTX) | ✅ | | | RAS — bien modélisé via triggers DPD. |
| Classe SENSIBLE 1/W + triggers immobiliers (art.5/12) | ✅ | | | Très bonne couverture (commercialisation <50%, retard >1 an, projet à l'arrêt…). |
| Watch‑list / surveillance | ✅ | | | `isWatchList` porté par la classe SENSIBLE. |
| Restructuration (art.17‑31) | | 🟠 | | Règles de plancher présentes ; **manque la période d'observation et son suivi temporel**. |
| Effet groupe / contagion (art.33/50) | | 🟠 | | Logique présente mais **`groupId` non structuré** (table groupe manquante). |
| Provisionnement par taux (sensible 10%, pré‑douteux 20%, douteux 50%, compromis 100%) | ✅ | | | Taux corrects 19/G & 1/W. |
| Garanties admises : quotités 100/80/50 + abattement progressif (art.41/21) | ✅ | | | Implémentation fidèle (profils hypothécaire/titres/véhicules). |
| Évaluation récente hypothèque (art.19/39, seuils 1M/5M) | ✅ | | | Géré (`hypEvaluationThreshold`, `recentlyEvaluated`). |
| Créance irrégulière (19/G art.4bis) | ✅ | | | Statut couvert 100% → provision nulle. |
| Base provisionnable = EAD − agios − garanties | | 🟠 | | Formule correcte mais **EAD = montant prêt** (simpliste) et agios manuels. |
| Échéancier / ancienneté réelle des impayés | | | ❌ | Modéliser `RepaymentSchedule`/`ArrearsEvent` (DPD calculé, pas saisi). |
| Provisionnement IFRS9 / ECL (staging, forward‑looking) | | | ❌ | Hors périmètre actuel ; requis pour cohérence comptable. |
| Engagements hors‑bilan (GFA, cautions données) | | | ❌ | À intégrer pour l'exposition réelle. |
| Reporting prudentiel (états BAM) | | | ❌ | Générer les états réglementaires de classification/provision. |

**Synthèse :** **fidélité réglementaire remarquable sur la classification et le provisionnement** des deux circulaires. Les manques portent sur l'**ancrage opérationnel** (échéancier réel, EAD, période d'observation forbearance, hors‑bilan) et sur l'**articulation comptable IFRS9/ECL**.

---

## 9. Audit workflow crédit

**Cible bancaire :** Chargé d'affaires → Analyse risques → Responsable risques → Comité crédit → Décision → Suivi.

**État réel :** la table `WorkflowStep` (états DRAFT→SUBMITTED→ANALYST_REVIEW→MANAGER_VALIDATION→COMMITTEE→APPROVED/REJECTED) **existe en base mais n'est câblée nulle part** : aucune action de transition, aucune UI de file d'attente, aucun contrôle de séparation des tâches (SoD). Le RBAC porte bien `scoring.validate` (Manager) mais sans point d'application.

**Étapes manquantes :** soumission par le CA, affectation à un analyste, revue risque, validation responsable, **passage en comité avec décision structurée (quorum/votes/conditions)**, notification, et **suivi post‑décision** (covenants, revues périodiques, watch‑list).

**Recommandation :** implémenter une **machine à états** explicite (transitions autorisées par permission, SoD entre initiateur et validateur), une **fiche comité** liée à `CommitteeDecision`, et des **revues périodiques** déclenchant reclassification.

---

## 10. Audit reporting

**Présent :** export CSV portefeuille (BOM Excel), rapport comité HTML imprimable en PDF (scores par domaine, classification, provisionnement, red flags). Propre et sans dépendance lourde.

**Manquant (cible risque) :**
- **Fiche comité interactive** (vs HTML statique) avec historique des décisions.
- **Radar scoring** par domaine (visuel comité).
- **Vue portefeuille analytique** : heatmap, concentration, top expositions, par segment/zone/promoteur.
- **Matrice de migration des notes** (entrées/sorties par classe sur période).
- **États réglementaires BAM** (classification/provision) et **rapprochement comptable**.
- **Exports xlsx natifs** (vs CSV) et **PDF serveur** (vs impression navigateur).

---

## 11. Audit des tests

**Présent :** 4 fichiers unitaires Vitest sur les moteurs (`scoringEngine`, `classificationEngine`, `provisioningEngine`, `guaranteeEligibilityEngine`). Tests pertinents et déterministes (GO/NO‑GO, gates, souffrance, CoeffBAM, PD monotone, abattements, irrégularité).

**Manquant :**
- **Tests d'intégration** services/actions (transaction `runFullScoring`) avec base éphémère.
- **Tests d'autorisation/RBAC** (aujourd'hui non testables car non appliqués).
- **Tests de validation Zod** (limites, rejets).
- **Tests API** (routes export, codes d'erreur).
- **Tests E2E** (Playwright) sur le wizard et le parcours comité.
- **Tests de non‑régression du modèle** (golden master sur portefeuille de référence) et **property‑based** sur les bornes.
- **Couverture mesurée** (aucun seuil de couverture, pas de CI).

**Robustesse avant production : insuffisante.** Le cœur de calcul est bien testé ; tout le reste (sécurité, persistance, workflow, API) ne l'est pas.

---

## 12. Industrialisation — positionnement

| Niveau | Atteint ? |
|---|:--:|
| Prototype | ✅ dépassé |
| POC | ✅ dépassé |
| **Outil métier** | ✅ **atteint** |
| Outil risque (décision/provisionnement réel) | 🟠 partiel (modèle non validé, workflow absent) |
| Outil bancaire (sécurité, SI, gouvernance) | ❌ non |
| Outil de production | ❌ non |

**Manques d'industrialisation :** pas de CI/CD, **migrations Prisma non utilisées** (DDL SQL appliqué à la main → risque de dérive schéma), pas de monitoring/observabilité, pas de gestion d'environnements, import non câblé, pas de stratégie de sauvegarde/restauration documentée côté applicatif, pas de gouvernance de modèle.

---

## 13. Backlog V2 (priorisé)

### 🔴 Critique (bloquants production)
| Item | Justification | Complexité | Gain métier | Impact risque |
|---|---|:--:|:--:|:--:|
| Middleware authN + RBAC appliqué (deny‑by‑default) | Sans cela, aucun usage bancaire | Moyenne | Élevé | Critique |
| SSO Azure AD / OIDC + MFA | Intégration SI bancaire, traçabilité identité | Moyenne | Élevé | Critique |
| Activer RLS ou backend‑only (retirer anon côté client) | Exposition totale des données | Moyenne | Élevé | Critique |
| Validation statistique du modèle + PD calibrée + backtesting | Modèle interne non validé = non utilisable | Élevée | Élevé | Critique |
| Workflow comité câblé (machine à états + SoD) | Décision de crédit auditable | Élevée | Élevé | Élevé |

### 🟠 Haute
| Item | Justification | Complexité | Gain | Risque |
|---|---|:--:|:--:|:--:|
| Modèle données : Counterparty/Group, Facility, RepaymentSchedule/Arrears | EAD & ancienneté réels, effet groupe robuste | Élevée | Élevé | Élevé |
| GFA / compte séquestre / VEFA | Cœur du risque promotion | Moyenne | Élevé | Élevé |
| Audit append‑only + journalisation sécurité → SIEM | Exigence audit/conformité | Moyenne | Moyen | Élevé |
| CI/CD + migrations Prisma source de vérité + tests intégration | Industrialisation | Moyenne | Moyen | Moyen |
| Dashboard risque (heatmap, migration, concentration) | Pilotage portefeuille | Moyenne | Élevé | Moyen |

### 🟡 Moyenne
| Item | Justification | Complexité | Gain | Risque |
|---|---|:--:|:--:|:--:|
| Import xlsx câblé (SheetJS) + DataLineage | Industrialiser l'alimentation | Moyenne | Moyen | Faible |
| Édition Model Builder / Régimes (admin réel) | Tenir la promesse « administrable » | Moyenne | Moyen | Faible |
| ECL / IFRS9 staging | Cohérence comptable | Élevée | Moyen | Moyen |
| Exports xlsx/PDF serveur, états BAM | Reporting réglementaire | Moyenne | Moyen | Faible |

### 🟢 Faible
| Item | Justification | Complexité | Gain | Risque |
|---|---|:--:|:--:|:--:|
| Lever incohérences 0..10/0..5 et libellé D5 | Lisibilité/maintenance | Faible | Faible | Faible |
| Accessibilité (a11y) et i18n | Qualité produit | Faible | Faible | Faible |
| Observabilité fine (traces, métriques modèle) | Exploitation | Moyenne | Faible | Faible |

---

## 14. Roadmap

### V1.5 — Corrections immédiates (4–6 semaines)
- Middleware authN + appliquer RBAC sur actions/exports ; supprimer le repli démo (deny‑by‑default).
- Activer RLS (ou backend‑only) ; retirer toute exposition de la clé anon côté client.
- Protéger les routes d'export ; journaliser authN/authZ.
- CI (lint + typecheck + tests) ; migrations Prisma comme source de vérité ; retirer/cacher l'import stub.
- Corriger incohérences cosmétiques (échelle, libellé D5).

### V2 — Industrialisation (4–6 mois)
- SSO Azure AD/MFA ; couche use‑case portant l'autorisation ; audit append‑only → SIEM.
- Workflow comité (machine à états, SoD, fiche comité, `CommitteeDecision`).
- Modèle données étendu (Counterparty/Group, Facility/Drawdown, RepaymentSchedule/Arrears, CollateralValuation, GFA/Escrow, ForbearanceObservation, RatingScale).
- Dashboard risque (heatmap, migration, concentration) ; exports xlsx/PDF serveur + états BAM.
- Tests d'intégration/E2E + couverture cible ; observabilité.

### V3 — Plateforme risque bancaire (6–12 mois)
- **Validation et gouvernance de modèle** : calibration statistique, PD/LGD/EAD, backtesting, PSI, comité modèles, validation indépendante.
- **IFRS9 / ECL** : staging, forward‑looking, rapprochement comptable.
- Intégration SI bancaire (core banking, référentiel tiers, moteur de garanties groupe).
- Reporting prudentiel automatisé ; data lineage et qualité de données ; stress testing portefeuille.

---

## Avis professionnel final

**Note finale : 6,2 / 10.**

Cet outil est un **socle métier de grande qualité** : l'ingénierie logicielle du moteur de risque (découplage, déterminisme, paramétrage par la donnée, versioning, fidélité réglementaire BKAM) est au niveau attendu d'un éditeur sérieux, et nettement au‑dessus des prototypes habituellement rencontrés. La couverture des circulaires 19/G et 1/W est dense, correctement référencée et bien architecturée.

**En l'état, il ne peut pas être utilisé en production par une banque** : la sécurité applicative n'est pas implémentée (auth/RBAC inertes, RLS désactivé), et surtout **le modèle de notation interne n'est pas validé statistiquement** — deux prérequis non négociables pour des décisions de crédit et un provisionnement réglementaire. Le workflow décisionnel et l'ancrage opérationnel (EAD, échéancier, GFA/VEFA) restent à construire.

**Recommandation :** **investir sur cette base plutôt que repartir de zéro.** Avec une V1.5 sécurité (4–6 semaines) puis une V2 d'industrialisation (4–6 mois) et une V3 de validation/gouvernance de modèle, la solution peut légitimement devenir un **véritable outil de gestion des risques de promotion immobilière** déployable en établissement de crédit. Le potentiel est réel ; ce sont la sécurité, la validation du modèle et l'industrialisation — non l'architecture — qui conditionnent le passage à l'échelle.
