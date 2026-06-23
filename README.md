# PI Scoring BKAM — Scoring de Promotion Immobilière

Application web professionnelle de **scoring de projets de promotion immobilière**, avec
**classification** et **provisionnement** conformes à **Bank Al-Maghrib** :
circulaires **19/G/2002** et **1/W/2025**.

Stack : **Next.js (App Router) · TypeScript strict · Prisma · PostgreSQL/Supabase ·
Zod · React Hook Form · Recharts · Tailwind/Radix**. RBAC, piste d'audit systématique,
référentiels administrables, moteurs métier purs et testés.

---

## 1. Ce que fait l'outil

| Capacité | Détail |
|---|---|
| **Scoring V1.0** | Modèle expert-paramétrique D1..D4 pondérés + pilier **D5** de malus (vulnérabilité BAM), échelle KPI 0..5, ajustements **segment × zone** (α/β), **PD proxy** logistique. |
| **Classification BKAM** | Moteur paramétrable par régime : 19/G/2002 (saine / pré-douteux / douteux / compromis) et 1/W/2025 (+ **Sensible**), **triggers immobiliers** (commercialisation, retard chantier, arrêt projet), **restructuration** (art.17-31), **effet groupe** (art.33/50). |
| **Provisionnement** | EAD − agios réservés − garanties éligibles → base × taux. Taux 1/W : Sensible 10% · Pré-douteux 20% · Douteux 50% · Compromis 100%. Créance **irrégulière** (couverture 100%). |
| **Garanties** | Quotités réglementaires **100% / 80% / 50%**, **abattements progressifs** (art.41/21), seuil d'évaluation hypothécaire (1 M / 5 M MAD), exigence de 1er rang. |
| **Règle bloquante** | **CTX ⇒ NO_GO et score final = 0**. Souffrance automatique (impayé ≥ 90 j, projet arrêté ≥ 12 mois) hors score. |
| **Gouvernance** | RBAC (Admin, Risk Analyst, Relationship Manager, Manager, Auditor), **AuditLog** avant/après sur tout calcul et changement, runs en **transaction Prisma**. |

> Le détail de la conformité article par article est dans
> [`docs/CONFORMITE_BKAM.md`](docs/CONFORMITE_BKAM.md) et le comparatif des deux
> circulaires dans [`docs/COMPARATIF_19G_1W.md`](docs/COMPARATIF_19G_1W.md).

---

## 2. Architecture

```
app/                       Pages App Router (dashboard, projets, admin, audit, imports)
  projects/[id]/           Détail projet (12 onglets) + wizard de scoring
components/                UI (Radix/shadcn-like), wizard, jauge, graphes Recharts
lib/
  domain/                  Types purs, évaluateur de règles, données de référence
  validation.ts            Schémas Zod (validation serveur)
  rbac.ts                  Rôles & permissions
server/
  engines/                 Moteurs métier PURS et testés
    scoringEngine.ts                    scores, gates, red flags, décision, PD proxy
    regulatoryClassificationEngine.ts   classe BKAM (régime + restructuration + groupe)
    provisioningEngine.ts               provision brute/nette
    guaranteeEligibilityEngine.ts       garanties admises + abattements
    auditService.ts                     journalisation avant/après
  services/                Orchestration transactionnelle + chargement config DB
  actions/                 Server actions (save brouillon, run scoring)
  queries.ts               Read models pour l'UI
prisma/
  schema.prisma            30+ entités
  seed.ts                  RBAC + modèle + régimes + garanties + démo
tests/                     Tests unitaires Vitest (44) sur les 4 moteurs
docs/                      Guides admin / utilisateur / déploiement / conformité
```

**Principe clé** : les moteurs (`server/engines`) sont des **fonctions pures** qui
consomment une **configuration** (`ScoringModelConfig`, `RegulatoryRegimeConfig`) — ils
ne lisent pas la base. Toute la doctrine métier vit dans `lib/domain/referenceData.ts`
puis en base (administrable), **jamais codée en dur dans les moteurs**.

---

## 3. Démarrage

```bash
npm install
cp .env.example .env              # renseigner DATABASE_URL et DIRECT_URL (Supabase/Postgres)

npm run prisma:generate           # générer le client Prisma
npm run prisma:push               # créer le schéma en base
npm run seed                      # référentiels BKAM + modèle V1.0 + 2 projets démo

npm run dev                       # http://localhost:3000
```

Sans base de données, l'application démarre quand même : chaque écran affiche une notice
de configuration. Les **moteurs et leurs tests** ne nécessitent aucune base.

### Scripts

| Script | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | 44 tests unitaires (Vitest) sur les moteurs |
| `npm run typecheck` | TypeScript strict, `--noEmit` |
| `npm run prisma:push` / `prisma:migrate` | Schéma |
| `npm run seed` | Données de référence + démo |

---

## 4. Chaîne de calcul du score

```
ScoreCrit (0..5)  →  ScoreDomaine (0..100)  →  S_eco = Σ poids·domaine
        →  S_adj = S_eco × (1 + α_Seg + β_Zone)
        →  S_afterPenalties = S_adj − Σ malus(D5)
        →  S_final = S_afterPenalties × CoeffBAM(classe)
        →  Décision : ≥75 GO · 65-74 conditions · 50-64 watch · <50 NO_GO
        →  CTX / souffrance auto ⇒ NO_GO (CTX ⇒ score 0)
```

La classification BKAM est calculée **en parallèle** et réinjectée dans le scoring
(CoeffBAM, règle bloquante), puis sert de base au provisionnement. L'ensemble s'exécute
dans **une transaction Prisma** avec **trois entrées d'audit** (CALCULATE / CLASSIFY / PROVISION).

---

## 5. Comptes de démonstration (seed)

| Rôle | Email |
|---|---|
| Administrateur | admin@bank.ma |
| Analyste Risque | analyst@bank.ma |
| Chargé d'affaires | rm@bank.ma |
| Manager / Comité | manager@bank.ma |
| Auditeur | auditor@bank.ma |

*(L'authentification est laissée à brancher — NextAuth ou Supabase Auth — selon le
déploiement ; le RBAC et les permissions sont déjà modélisés et seedés.)*

---

## 6. Documentation

- [`docs/GUIDE_UTILISATEUR.md`](docs/GUIDE_UTILISATEUR.md)
- [`docs/GUIDE_ADMIN.md`](docs/GUIDE_ADMIN.md)
- [`docs/GUIDE_DEPLOIEMENT.md`](docs/GUIDE_DEPLOIEMENT.md)
- [`docs/CONFORMITE_BKAM.md`](docs/CONFORMITE_BKAM.md)
- [`docs/COMPARATIF_19G_1W.md`](docs/COMPARATIF_19G_1W.md)

---

## 7. Avertissement

Les paramètres réglementaires (taux, seuils, quotités, abattements, déclencheurs)
reproduisent les **normes minimales** des circulaires 19/G/2002 et 1/W/2025 et sont
**entièrement administrables**. Ils doivent être validés par la Direction des Risques et
le Comité Modèles avant tout usage en production, et calibrés sur l'historique interne.
