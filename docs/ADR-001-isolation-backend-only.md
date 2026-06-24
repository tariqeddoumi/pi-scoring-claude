# ADR‑001 — Isolation des données : backend‑only (V1.5, lot C)

- **Statut :** Accepté · appliqué le 2026‑06‑24
- **Contexte :** V1.5 sécurité — décision d'architecture sur l'isolation des données (audit, risque S4 : RLS désactivé / exposition Data API).

## Décision

Le schéma métier **`pi_scoring` est confiné en backend‑only**. L'application accède aux
données **exclusivement via Prisma**, connecté avec le rôle `postgres` (propriétaire des
tables). Les rôles exposés par la Data API Supabase (`anon`, `authenticated`) et
`service_role` ne disposent d'**aucun privilège** sur le schéma.

Le client Supabase navigateur est **réservé à l'authentification** (signIn/signOut/getUser) ;
il ne lit ni n'écrit aucune donnée métier.

## Alternatives considérées

| Option | Décision | Motif |
|---|---|---|
| **Backend‑only (retenue)** | ✅ | Prisma est déjà server‑only ; posture simple, robuste, faible coût (~2,8 j·h). |
| RLS complet (policies par rôle sur 30 tables) | ⏳ Reporté V2 | Pertinent uniquement si la base est exposée au navigateur — non requis aujourd'hui (~+4 j·h). |

## État constaté (avant durcissement)

Le schéma `pi_scoring` ayant été créé dédié et **non ajouté aux « Exposed schemas »**, les rôles
API n'avaient déjà **aucun grant de table ni USAGE de schéma**. L'isolation était donc effective
par construction.

## Mise en œuvre (rendre la posture explicite et permanente)

Migration `prisma/security/backend_only.sql` (appliquée : `pi_scoring_backend_only_hardening`) :
- `REVOKE` de tous les privilèges (tables, séquences, fonctions) et de l'`USAGE` du schéma
  pour `anon`, `authenticated`, `service_role` (idempotent) ;
- `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` : aucune table/séquence/fonction **future**
  créée dans `pi_scoring` ne sera accordée aux rôles API → protection contre la dérive.

Côté code : `lib/supabase/client.ts` documenté comme **auth‑only**.

## Vérification (après application)

| Contrôle | Résultat |
|---|---|
| Grants de table API (`anon`/`authenticated`/`service_role`) | **0** |
| `USAGE` schéma — anon / authenticated / service_role | **false / false / false** |
| `USAGE` schéma — postgres (Prisma) | **true** |
| Lecture données par le propriétaire (`ScoringRun`) | **OK (2 lignes)** |

## Conséquences

- **Exposition Data API fermée** pour la clé anon/authenticated, indépendamment de l'état RLS.
- L'**absence de policies RLS est sans effet pratique** sur l'exposition tant que `pi_scoring`
  n'est pas exposé à l'API. Des policies RLS par rôle ne deviennent nécessaires qu'en cas
  d'exposition future (item V2).
- Toute évolution exposant le schéma à l'API **doit** s'accompagner de policies RLS (revoir cet ADR).
- L'avis Supabase « RLS disabled » peut subsister : il est **mitigé** par l'absence totale de
  privilèges des rôles API (défense par les grants plutôt que par RLS).
