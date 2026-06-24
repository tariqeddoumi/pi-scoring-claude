# Guide administrateur

## 1. Principe : tout est paramétrable
Aucune doctrine métier n'est codée en dur dans les moteurs. La configuration vit dans
la base (seedée depuis `lib/domain/referenceData.ts`) et alimente des moteurs purs.

## 2. Model Builder (`/admin/model`)
Affiche la version publiée du modèle de scoring :
- **Domaines** D1..D4, leurs poids, et chaque **critère** (type QUAL/NUM, poids,
  barème/modalités, gate).
- **Pilier D5** : red flags (règle, sévérité, malus, domaines impactés).

### Versionner le modèle
- Entités : `ScoringModel` → `ScoringModelVersion` (statut DRAFT / PUBLISHED / RETIRED).
- Une version porte : `scoreScale`, `bamCoefficients`, `decisionThresholds`,
  `segmentAdjustments` (α), `zoneAdjustments` (β).
- Pour faire évoluer le barème : créer une nouvelle version, la peupler
  (domaines/critères/options/ranges/red flags), puis la publier. Les runs historiques
  restent rattachés à leur version (immuabilité de l'audit).

### Critères
- **QUAL** : `ScoringOption` (value → label, score 0..échelle).
- **NUM** : `ScoringRange` `[minIncl, maxExcl)` → score.
- **Gate** : `isGate` + `gateThreshold` ; si score ≤ seuil ⇒ NO_GO.
- `inputKey` relie le critère à une clé `ProjectInput`.

## 3. Admin réglementaire (`/admin/regimes`)
Pour chaque régime (`RegulatoryRegime`) :
- **Classes** (`RegulatoryClass`) : WL, défaut, blocage GO, **taux de provision**
  (`ProvisionRate`, daté).
- **Déclencheurs** (`RegulatoryTrigger`) : DPD (min/max jours) ou condition DSL
  (JSON sur les inputs) → classe cible, priorité.
- **Garanties** (`GuaranteeType`) : quotité, profil d'abattement, éligibilité, 1er rang.
- Régime : `effectiveFrom`, `active`, `hypEvaluationThreshold`, `restructuringPolicy`.

### Changer de régime actif (19/G ↔ 1/W)
Mettre `active = true` sur le régime cible (et `false` sur l'autre). Le moteur charge
le régime actif le plus récent. La bascule 1/W est prévue au 01/01/2027.

### DSL de règle (triggers & red flags)
```json
{ "clause": { "key": "commercialization_below_50_1y", "op": "isTrue" } }
{ "all": [ { "key": "dpd_days", "op": "gte", "value": 90 } ] }
{ "any": [ { "key": "legal_exposure", "op": "eq", "value": "litigation" } ] }
```
Opérateurs : `eq, neq, gt, gte, lt, lte, in, isTrue, isFalse`.

## 4. RBAC (`lib/rbac.ts`)
Rôles : ADMIN, RISK_ANALYST, RELATIONSHIP_MANAGER, MANAGER, AUDITOR. Permissions
atomiques (`project.read`, `scoring.run`, `model.write`, `regime.write`, `audit.read`…).
`assertPermission(role, perm)` est la garde serveur.

## 5. Audit
`AuditLog` enregistre CREATE/UPDATE/CALCULATE/CLASSIFY/PROVISION avec snapshots
`before`/`after`. Ne jamais purger sans politique de rétention validée.
