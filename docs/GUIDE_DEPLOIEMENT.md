# Guide de déploiement

## 1. Prérequis
- Node.js ≥ 18 (testé sur Node 22)
- PostgreSQL 14+ ou un projet **Supabase**

## 2. Variables d'environnement (`.env`)
```bash
DATABASE_URL="postgresql://...:5432/db?schema=public&pgbouncer=true"  # runtime (poolé)
DIRECT_URL="postgresql://...:5432/db?schema=public"                   # migrations
AUTH_SECRET="..."        # si authentification branchée
```
Sur Supabase : `DATABASE_URL` = connexion **poolée** (port 6543, `pgbouncer=true`),
`DIRECT_URL` = connexion **directe** (port 5432) pour les migrations Prisma.

## 3. Base de données
```bash
npm run prisma:generate
npx prisma migrate deploy    # rejoue toutes les migrations (base vierge ou existante)
npm run seed                 # référentiels BKAM + modèle publié + démo
```
Le seed est **idempotent** sur les référentiels (upsert / recréation contrôlée).

## 4. Build & exécution
```bash
npm run build
npm run start                # production
```

## 5. Déploiement Vercel
1. Importer le dépôt.
2. Renseigner `DATABASE_URL` et `DIRECT_URL` (Project Settings → Environment Variables).
3. Build command : `prisma generate && next build` (ou ajouter `postinstall: prisma generate`).
4. Lancer `prisma migrate deploy` (à chaque déploiement) et `seed` une fois sur la base cible.

## 6. Qualité avant mise en production
```bash
npm run typecheck          # TypeScript strict
npm run test               # tests unitaires (moteurs, modèle, écrans, thèmes)
npm run build              # build Next.js
```
Sur une base de test (jamais la production) :
```bash
npx prisma migrate deploy && npm run seed && npx tsx scripts/seed-e2e.ts
npm run test:integration   # liste des projets filtrée par la base (PostgreSQL réel)
npm run test:e2e           # parcours navigateur (Playwright, application en mode dev)
```
Les tests de bout en bout utilisent l'identité de test `E2E_AUTH_EMAIL`
(défaut `analyst@bank.ma`) : elle n'est active qu'en mode développement et
ignorée par tout build de production. En local, `PW_CHROMIUM_PATH` désigne un
Chromium déjà installé ; sinon `npx playwright install chromium`. La CI
(GitHub Actions) exécute les deux suites à chaque push.

## 7. Sécurité & conformité
- Brancher l'authentification (NextAuth ou Supabase Auth) et câbler l'utilisateur réel
  comme acteur des runs (remplacer `getDemoActor`).
- Activer Row Level Security côté Supabase si l'accès client direct est utilisé.
- Définir une politique de rétention de `AuditLog`.
- Faire valider les paramètres réglementaires par la Direction des Risques / Comité Modèles.

## 8. Résumé hebdomadaire des alertes par e-mail
- Tâche planifiée déclarée dans `vercel.json` : `/api/cron/alert-digest`, le lundi
  à 7 h UTC (8 h à Casablanca). Chaque chargé d'affaires actif ayant au moins une
  alerte sur ses dossiers reçoit un e-mail (mêmes règles que la page Alertes).
- Variables : `CRON_SECRET` (≥ 16 caractères, obligatoire — Vercel l'envoie dans
  l'en-tête `Authorization`), `RESEND_API_KEY` et `MAIL_FROM` (fournisseur d'e-mail ;
  sans eux, la tâche calcule les résumés sans les envoyer), `APP_URL` (adresse des
  liens, défaut : domaine de production Vercel).
- Contrôle sans envoi : `curl -H "Authorization: Bearer $CRON_SECRET" "https://…/api/cron/alert-digest?apercu=1"`.
  Chaque utilisateur peut aussi voir l'aperçu de son résumé (Alertes → Résumé hebdomadaire).
- Pour un relais SMTP interne à la banque, ajouter un transport dans
  `server/services/mailer.ts` (même signature que l'envoi Resend).

## 9. Sauvegarde / reprise
La doctrine métier par défaut est versionnée dans le code
(`lib/domain/referenceData.ts`) : une base peut être reconstruite via
`prisma migrate deploy` + `seed`. Les **runs** (scoring, classification, provision, audit) sont
les données opérationnelles à sauvegarder.
