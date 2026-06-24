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
