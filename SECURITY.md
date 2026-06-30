# Sécurité — dette technique & vulnérabilités résiduelles

État au terme de la phase de stabilisation (dette technique P0 du diagnostic).

## Corrigé

- **Lint opérationnel et non interactif** : configuration ESLint explicite
  (`.eslintrc.json`, `extends: next/core-web-vitals`) + dépendances
  `eslint` / `eslint-config-next` épinglées sur la ligne Next 14.2. `npm run lint`
  passe sans avertissement et tourne en CI.
- **Génération Prisma fiable en CI / serverless** : `binaryTargets`
  (`native` + `debian-openssl-3.0.x`) ajouté au générateur, évitant l'échec
  « query engine not found » entre OS de build et d'exécution.
- **CI complète** : `lint → typecheck → tests → build` (workflow `ci.yml`).
- **Next.js** porté sur le dernier correctif de la ligne 14.2 (`14.2.35`).

## Vulnérabilités résiduelles (`npm audit`) et arbitrage

| Paquet | Sévérité | Décision | Justification |
|--------|----------|----------|----------------|
| `next` (XSS CSP/RSC, DoS image, SSRF WS…) | high/critical | **À planifier** : migration Next 15/16 | Les correctifs ne sont publiés que sur les majeures 15/16. Une montée de version est un chantier à part entière (compat React/App Router/Supabase) à valider hors du périmètre « stabilisation ». La ligne 14.2 est maintenue sur les correctifs disponibles. |
| `xlsx` (Prototype Pollution, ReDoS) | high | **Atténué, à remplacer** | Aucun correctif sur le registre npm. Usage strictement **serveur**, derrière la permission `import.run`, avec plafond de 8 Mo par fichier. Remédiation cible : installer SheetJS depuis le CDN officiel (`https://cdn.sheetjs.com/…`) ou isoler le parsing dans un worker, après validation de la contrainte de build (dépendance hors registre). |
| `postcss` (< 8.5.10, via `next`) | moderate | Résolu avec la majeure Next | Transitif de Next ; suivra la migration. |
| `glob` (CLI command injection, via `eslint-config-next`) | high | **Sans impact** | Dépendance **de développement** uniquement (chaîne `@next/eslint-plugin-next`) ; la CLI `glob -c` n'est jamais invoquée. Non embarqué dans l'application. |

## Recommandations de suivi

1. Planifier la migration **Next.js 15/16** (lève la majorité des CVE applicatives).
2. Décider du remplacement **xlsx** (CDN SheetJS ou alternative) — dépendance de build à arbitrer.
3. Activer un audit régulier en CI (`npm audit --omit=dev --audit-level=high`) une
   fois la migration Next réalisée, pour bloquer les régressions de production.
