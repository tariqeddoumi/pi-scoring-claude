# Chiffrage V1.5 — Durcissement sécurité

> Périmètre : lot « V1.5 sécurité » de la roadmap (corrections immédiates, bloquants production).
> Objectif : rendre l'application **authentifiée, autorisée et auditable**, sans exposition de données.
> Hypothèse d'équipe : 1 dev full‑stack senior (Next/Prisma) + appui ponctuel sécurité/risque (0,5).
> Unité : **j·h** = jour‑homme (1 j·h = 1 journée de travail effective).
> Convention d'estimation : `O` optimiste · `R` réaliste · `P` pessimiste → **estimation = (O + 4R + P) / 6** (PERT).

---

## 1. Périmètre et exclusions

**Inclus (V1.5) :** authentification appliquée, RBAC réellement invoqué, suppression du repli démo, protection des routes/exports, isolation des données (RLS ou backend‑only), journalisation sécurité, socle CI, corrections de cohérence schéma.

**Exclus (renvoyés en V2) :** SSO Azure AD/MFA complet (V1.5 pose le socle OIDC mais l'intégration annuaire bancaire = V2), workflow comité, refonte du modèle de données, calibration du modèle, ECL/IFRS9, dashboard risque.

---

## 2. Décomposition par épopée (epics)

### EPIC A — Authentification appliquée
| ID | Tâche | O | R | P | **Est. (j·h)** | Dépend. | Critère d'acceptation |
|---|---|--:|--:|--:|--:|---|---|
| A1 | Middleware Next.js : vérif session sur toutes les routes (sauf login/health), redirection login | 1,5 | 2,5 | 4 | **2,6** | — | Accès anonyme à toute page protégée → 302 vers login. |
| A2 | Page/flux de connexion Supabase Auth (email + mot de passe) + déconnexion | 1 | 2 | 3 | **2,0** | A1 | Login/logout fonctionnels, session persistée via cookies SSR. |
| A3 | Suppression du repli démo `getCurrentAppUser` → **deny‑by‑default** (échec fermé) | 0,5 | 1 | 2 | **1,1** | A2 | Aucune action sans utilisateur authentifié réel ; plus d'identité « analyste » par défaut. |
| A4 | Liaison robuste session Supabase ↔ table `User` (gestion utilisateur inconnu/inactif) | 1 | 1,5 | 3 | **1,7** | A2 | Email non rattaché ou `active=false` → accès refusé proprement. |
| **Sous‑total A** | | | | | **7,4** | | |

### EPIC B — Autorisation / RBAC appliqué
| ID | Tâche | O | R | P | **Est.** | Dépend. | Critère |
|---|---|--:|--:|--:|--:|---|---|
| B1 | Couche d'autorisation centralisée (helper `authorize(permission)` côté serveur) | 1 | 2 | 3,5 | **2,1** | A3 | Point unique d'appel ; deny‑by‑default. |
| B2 | Appliquer `assertPermission` sur **toutes** les Server Actions (`saveProjectInputs`, `runScoringAction`) | 1 | 1,5 | 3 | **1,7** | B1 | Chaque action vérifie la permission attendue (`project.write`, `scoring.run`). |
| B3 | Protéger les routes API export (`/api/export/*`) par session + `export.run` | 0,5 | 1 | 2 | **1,1** | B1 | Export sans permission → 403. |
| B4 | Garde de navigation UI (masquer/désactiver selon permissions) | 1 | 1,5 | 3 | **1,7** | B1 | Liens/admin invisibles pour rôles non autorisés. |
| B5 | Cohérence rôles ↔ permissions (revue du mapping `ROLE_PERMISSIONS`) | 0,5 | 0,5 | 1 | **0,6** | — | Mapping validé métier (CA/Analyste/Manager/Auditeur/Admin). |
| **Sous‑total B** | | | | | **7,2** | | |

### EPIC C — Isolation des données (RLS / backend‑only)
| ID | Tâche | O | R | P | **Est.** | Dépend. | Critère |
|---|---|--:|--:|--:|--:|---|---|
| C1 | Décision d'architecture : RLS par rôle **ou** backend‑only (clé service, jamais anon côté client) | 0,5 | 1 | 2 | **1,1** | — | ADR validé ; recommandation : **backend‑only** (plus simple, Prisma déjà server‑only). |
| C2 | Retirer toute exposition de la clé anon côté client ; confiner l'accès DB au backend | 0,5 | 1 | 2 | **1,1** | C1 | Aucun accès DB direct depuis le navigateur. |
| C3 | (Si RLS retenu) Activer RLS + policies par rôle sur les 30 tables `pi_scoring` | 2 | 3,5 | 6 | **3,7** | C1 | Tests d'accès : anon = 0 ligne, rôles = périmètre attendu. |
| C4 | Vérification advisors Supabase (sécurité) après changement | 0,5 | 0,5 | 1 | **0,6** | C2/C3 | 0 alerte critique RLS/exposition. |
| **Sous‑total C** | | | | | **2,8 → 6,5** | | *2,8 backend‑only · 6,5 si RLS complet* |

> Recommandation : **backend‑only** pour la V1.5 (chiffrage retenu : **2,8 j·h**, RLS reporté en V2 si exposition client devient nécessaire).

### EPIC D — Journalisation & traçabilité sécurité
| ID | Tâche | O | R | P | **Est.** | Dépend. | Critère |
|---|---|--:|--:|--:|--:|---|---|
| D1 | Journaliser événements authN/authZ (LOGIN, échec, accès refusé) dans `AuditLog` | 1 | 1,5 | 3 | **1,7** | A2,B1 | Connexions/refus tracés avec acteur, IP, horodatage. |
| D2 | Logs applicatifs structurés (JSON) + masquage des données sensibles | 0,5 | 1 | 2 | **1,1** | — | Logs exploitables, pas de secret en clair. |
| D3 | En‑têtes de sécurité (CSP, HSTS, X‑Frame‑Options) + base anti‑CSRF | 1 | 1,5 | 3 | **1,7** | A1 | En‑têtes présents ; scan sécurité basique OK. |
| **Sous‑total D** | | | | | **4,5** | | |

### EPIC E — Industrialisation minimale & cohérence
| ID | Tâche | O | R | P | **Est.** | Dépend. | Critère |
|---|---|--:|--:|--:|--:|---|---|
| E1 | CI (lint + typecheck + tests) sur la branche | 0,5 | 1 | 2 | **1,1** | — | Pipeline rouge bloque le merge. |
| E2 | Migrations Prisma = source de vérité (aligner `schema.prisma` ↔ DDL appliqué) | 1,5 | 2,5 | 5 | **2,8** | — | `prisma migrate` reproductible ; fin du DDL manuel. |
| E3 | Tests d'autorisation (RBAC) + tests d'accès données | 1 | 2 | 4 | **2,2** | B2,C2 | Chaque permission testée (autorisé/refusé). |
| E4 | Retirer/cacher l'écran Import (stub) ; corriger cohérences (échelle 0..5, libellé D5) | 0,5 | 1 | 1,5 | **1,0** | — | Plus d'écran non fonctionnel exposé. |
| **Sous‑total E** | | | | | **7,1** | | |

---

## 3. Récapitulatif

| Épopée | Estimation (j·h) |
|---|--:|
| A — Authentification appliquée | 7,4 |
| B — Autorisation / RBAC | 7,2 |
| C — Isolation données (backend‑only) | 2,8 |
| D — Journalisation sécurité | 4,5 |
| E — Industrialisation minimale | 7,1 |
| **Sous‑total développement** | **29,0** |
| Tests d'intégration / recette sécurité (15 %) | 4,4 |
| Revue de code + revue sécurité (10 %) | 2,9 |
| Gestion / coordination / documentation (10 %) | 2,9 |
| **TOTAL V1.5 (backend‑only)** | **≈ 39 j·h** |
| *Variante avec RLS complet (au lieu de backend‑only)* | *≈ 43 j·h* |

**Conversion planning (1 dev senior à temps plein) :** ≈ **8 semaines** (4 sprints de 2 semaines), appui sécurité/risque ≈ 0,5 j/semaine.

---

## 4. Planning indicatif (4 sprints)

| Sprint | Contenu | Livrable |
|---|---|---|
| **S1** | A1‑A4 (auth) + C1‑C2 (backend‑only) | Application authentifiée, base non exposée. |
| **S2** | B1‑B5 (RBAC appliqué) | Autorisation deny‑by‑default sur actions/exports/UI. |
| **S3** | D1‑D3 (journalisation/headers) + E1‑E2 (CI/migrations) | Traçabilité + socle industriel. |
| **S4** | E3‑E4 (tests RBAC, nettoyage) + recette sécurité + durcissement | Recette « go/no‑go » sécurité passée. |

---

## 5. Hypothèses et risques

**Hypothèses :**
- Auth basée sur **Supabase Auth** (déjà en place pour la session) ; SSO Azure AD = V2.
- Option **backend‑only** retenue pour l'isolation (Prisma déjà server‑only) → RLS reporté.
- Pas de migration de données utilisateurs existante (seed démo uniquement).
- 1 environnement cible (pas de multi‑tenant en V1.5).

**Risques (et provisions) :**
| Risque | Impact | Mitigation |
|---|---|---|
| Alignement `schema.prisma` ↔ DDL appliqué plus complexe que prévu (E2) | +1–2 j·h | Comparer tôt ; figer le schéma avant migration. |
| Décision RLS vs backend‑only tranchée tardivement | Glissement | ADR en S1, défaut = backend‑only. |
| Intégration annuaire bancaire demandée en V1.5 | +5–8 j·h | Cadrer explicitement : OIDC socle en V1.5, fédération en V2. |
| Recette sécurité révèle des écarts (OWASP) | +2–4 j·h | Provision recette 15 % déjà incluse. |

---

## 6. Définition de « Terminé » (Definition of Done) V1.5

- [ ] Aucune route/page/action accessible sans session authentifiée réelle (plus de repli démo).
- [ ] Chaque Server Action et route export vérifie une **permission** explicite (deny‑by‑default).
- [ ] Base non exposée au client (aucun accès anon) ; advisors Supabase sécurité = 0 critique.
- [ ] Événements authN/authZ journalisés dans `AuditLog`.
- [ ] En‑têtes de sécurité + anti‑CSRF en place.
- [ ] CI verte (lint, typecheck, tests) ; migrations Prisma reproductibles.
- [ ] Tests RBAC (autorisé/refusé) pour chaque permission.
- [ ] Écran Import stub retiré ; incohérences cosmétiques corrigées.
- [ ] Recette sécurité « go/no‑go » formellement passée.
