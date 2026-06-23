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
npm run prisma:push          # ou prisma:migrate en environnement versionné
npm run seed                 # référentiels BKAM + modèle V1.0 + démo
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
4. Lancer `prisma db push` + `seed` une fois sur la base cible (job ou localement).

## 6. Qualité avant mise en production
```bash
npm run typecheck    # TypeScript strict
npm run test         # 44 tests unitaires des moteurs
npm run build        # build Next.js
```

## 7. Sécurité & conformité
- Brancher l'authentification (NextAuth ou Supabase Auth) et câbler l'utilisateur réel
  comme acteur des runs (remplacer `getDemoActor`).
- Activer Row Level Security côté Supabase si l'accès client direct est utilisé.
- Définir une politique de rétention de `AuditLog`.
- Faire valider les paramètres réglementaires par la Direction des Risques / Comité Modèles.

## 8. Sauvegarde / reprise
La doctrine métier par défaut est versionnée dans le code
(`lib/domain/referenceData.ts`) : une base peut être reconstruite via
`prisma:push` + `seed`. Les **runs** (scoring, classification, provision, audit) sont
les données opérationnelles à sauvegarder.
