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
- **Migration Next.js 15** (`15.5.19`, App Router) : **lève les CVE applicatives**
  high/critical de la ligne 14 (XSS CSP/RSC, SSRF WebSocket, DoS Image,
  cache poisoning RSC, bypass middleware i18n). React reste en 18.3 (Next 15
  l'autorise) : pas de migration React 19, risque maîtrisé. Surfaces adaptées :
  APIs de requête asynchrones (`params`, `searchParams`, `cookies()` désormais
  `await`), config `serverActions` sortie de `experimental`.
- **Audit production** : de 1 critique + 6 high à **0 critique / 1 high / 2 moderate**.

## Vulnérabilités résiduelles (`npm audit --omit=dev`) et arbitrage

| Paquet | Sévérité | Décision | Justification |
|--------|----------|----------|----------------|
| `xlsx` (Prototype Pollution, ReDoS) | high | **Atténué, à remplacer** | Aucun correctif sur le registre npm. Usage strictement **serveur**, derrière la permission `import.run`, avec plafond de taille par fichier. Remédiation cible : installer SheetJS depuis le CDN officiel (`https://cdn.sheetjs.com/…`) ou isoler le parsing dans un worker, après validation de la contrainte de build (dépendance hors registre). |
| `postcss` (< 8.5.10, **bundlé par `next`**) | moderate | **Suivi amont** | Transitif interne à Next (XSS au stringify de CSS non fiable — hors de notre cas d'usage). Sera résolu par un correctif Next ultérieur ; non maîtrisable côté application. |

> Dépendances **de développement** exclues (non embarquées) : `glob` (chaîne
> `eslint-config-next`, CLI jamais invoquée), etc. — sans impact production.

## Recommandations de suivi

1. **xlsx** : décider du remplacement (CDN SheetJS ou alternative) — dépendance de build à arbitrer.
2. Activer un audit bloquant en CI : `npm audit --omit=dev --audit-level=high`
   (une fois xlsx traité, pour verrouiller la non-régression de production).
3. **Lint** : `next lint` est déprécié (retrait en Next 16) — migrer vers l'ESLint
   CLI (`npx @next/codemod next-lint-to-eslint-cli .`) lors d'un prochain passage.
