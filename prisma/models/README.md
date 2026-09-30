# Instantanés des modèles publiés

`PI_PROMOTION_v4.0.0.json` est l'instantané **exact** de la version publiée en
production (`ScoringModelVersion` `ver_4`, schéma `pi_scoring`) : domaines,
critères, modalités, barèmes, alertes D5, seuils, coefficients BAM et
ajustements segment / zone, avec les métadonnées v3/v4 (criticité, famille,
jalon, définitions, effet des alertes, retour en comité).

Il est utilisé par :

- `lib/domain/models/piPromotionV4.ts` → configuration moteur (même fonction de
  conversion que le chargement en base : `lib/domain/modelSnapshot.ts`) ;
- `prisma/seed.ts` → un nouvel environnement reçoit exactement ce modèle ;
- `tests/modelAlignment.test.ts` → contrôle que la saisie, les libellés, la
  validation et l'import couvrent toutes les clés du modèle, et que le moteur
  reproduit les 20 cas de référence de l'outil Excel.

## Mettre à jour l'instantané après une publication

Lorsqu'une nouvelle version est publiée depuis l'administration du modèle,
extraire la version publiée et remplacer (ou ajouter) l'instantané :

```sql
select json_build_object(
 'modelCode', m.code, 'modelName', m.name, 'version', v.version, 'scoreScale', v."scoreScale",
 'bamCoefficients', v."bamCoefficients", 'decisionThresholds', v."decisionThresholds",
 'segmentAdjustments', v."segmentAdjustments", 'zoneAdjustments', v."zoneAdjustments",
 'domains', (select json_agg(json_build_object('code', d.code, 'name', d.name, 'weight', d.weight, 'orderIndex', d."orderIndex",
   'criteria', (select json_agg(json_build_object('code', c.code, 'name', c.name, 'description', c.description, 'type', c.type,
      'weight', c.weight, 'inputKey', c."inputKey", 'isGate', c."isGate", 'gateThreshold', c."gateThreshold",
      'orderIndex', c."orderIndex", 'critical', c.critical, 'family', c.family, 'gateStage', c."gateStage",
      'unit', c.unit, 'definition', c.definition,
      'options', (select coalesce(json_agg(json_build_object('value', o.value, 'label', o.label, 'score', o.score,
          'orderIndex', o."orderIndex") order by o."orderIndex"), '[]'::json)
        from pi_scoring."ScoringOption" o where o."criterionId" = c.id),
      'ranges', (select coalesce(json_agg(json_build_object('minIncl', r."minIncl", 'maxExcl', r."maxExcl", 'score', r.score,
          'label', r.label, 'orderIndex', r."orderIndex") order by r."orderIndex"), '[]'::json)
        from pi_scoring."ScoringRange" r where r."criterionId" = c.id)
   ) order by c."orderIndex") from pi_scoring."ScoringCriterion" c where c."domainId" = d.id)) order by d."orderIndex")
   from pi_scoring."ScoringDomain" d where d."versionId" = v.id),
 'redFlags', (select json_agg(json_build_object('code', r.code, 'name', r.name, 'description', r.description, 'rule', r.rule,
   'severity', r.severity, 'impactDomains', r."impactDomains", 'malus', r.malus, 'mitigable', r.mitigable,
   'mitigantHint', r."mitigantHint", 'effect', r.effect, 'requiresCommittee', r."requiresCommittee", 'regRef', r."regRef")
   order by r.code) from pi_scoring."RedFlagRule" r where r."versionId" = v.id)
) from pi_scoring."ScoringModelVersion" v
join pi_scoring."ScoringModel" m on m.id = v."modelId"
where m.code = 'PI_PROMOTION' and v.status = 'PUBLISHED';
```

Puis : régénérer les cas de référence Excel (`tools/excel/README.md`), lancer
`npm test` et corriger tout écart signalé par `tests/modelAlignment.test.ts`
(clé sans champ de saisie, sans libellé, sans colonne d'import, modalités
divergentes). Enfin, recalculer le portefeuille depuis *Administration › Modèle*
(« Recalculer le portefeuille »).
