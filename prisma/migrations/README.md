# Migrations Prisma — source de vérité du schéma (V1.5 lot E)

À partir de la V1.5, **les migrations Prisma sont la source de vérité** du schéma
`pi_scoring`. Le fichier historique `prisma/schema.pi_scoring.sql` (DDL appliqué
manuellement lors du provisionnement initial) est conservé pour référence mais
**ne doit plus être édité** : toute évolution passe par `prisma migrate`.

## Baseline

`00000000000000_init/` est la **migration de référence** générée depuis
`schema.prisma` (hors connexion) :

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/00000000000000_init/migration.sql
```

## Adopter la baseline sur la base existante (déjà provisionnée)

La base contient déjà les tables (créées à la main). Pour éviter que Prisma ne
tente de les recréer, **marquer la baseline comme déjà appliquée** une seule fois :

```bash
# .env renseigné (DATABASE_URL / DIRECT_URL avec ?schema=pi_scoring)
npx prisma migrate resolve --applied 00000000000000_init
```

Ensuite, le cycle normal s'applique :

```bash
npx prisma migrate dev     # créer une nouvelle migration en développement
npx prisma migrate deploy  # appliquer en CI/CD / production
```

## Note schéma

Le schéma cible `pi_scoring` est porté par le paramètre `?schema=pi_scoring` des
URLs de connexion (mode mono-schéma). La baseline ne qualifie donc pas les objets
par le schéma : ils sont créés dans le `search_path` courant.

## Rejouabilité sur base vierge (octobre 2026)

Entre juin et septembre 2026, des objets ont été créés en production par
`prisma db push` sans migration (événements de projet, planning des déblocages,
liens entre promoteurs, champs des fiches promoteur et projet, rôles réseau).
Une base vierge ne pouvait donc pas être reconstruite par `migrate deploy`.

- `20260901000000_rattrapage_db_push` recrée ces objets (SQL idempotent) avant la
  migration v3 qui les suppose ; elle est inscrite comme appliquée en production
  sans exécution (les objets y existent déjà).
- `20261004000000_alignement_structure` aligne les derniers écarts (règles des
  clés étrangères des dérogations, clé étrangère des autorisations, valeurs par
  défaut de `updatedAt`) ; appliquée en production.

Contrôle effectué : la base obtenue par `migrate deploy` sur une base vide, la
production et `schema.prisma` ont la même structure (colonnes, valeurs par
défaut, contraintes, index, énumérations : 741 éléments, empreinte identique).
La CI le vérifie à chaque push (job `migrations` : `migrate deploy`, puis
`migrate diff --exit-code`, puis `npm run seed`).

**Règle** : toute évolution du schéma passe par une migration. `db push` est
réservé aux bases jetables de développement.
