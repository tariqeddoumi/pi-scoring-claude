# Intégration SI bancaire (T24 / Evolan)

## Principe et périmètre des sources de données

| Donnée | Source |
|---|---|
| Signalétique client (promoteur) | **Saisie manuelle** (module Promoteurs) ou **API SI** — le contrat ci-dessous est extensible à un endpoint signalétique ; en attendant, la fiche promoteur est saisie et reste la référence. |
| Champs de la grille de scoring lisibles dans les documents | **Lecture IA** des documents importés (business plan, note, autorisations…) — l'IA ne remplit que ce qu'elle sait lire, l'utilisateur saisit le reste ; toute valeur importée est modifiable. |
| Déblocages, encours, échéancier & impayés, restructuration | **Synchronisation SI** (T24 / Evolan) via ce connecteur, sinon saisie au journal d'événements. |
| Rattachement des déblocages au planning du BP initial | **Manuel** — obligatoirement (décision humaine), depuis la page Suivi. |

## Configuration (variables d'environnement)

```
CORE_BANKING_PROVIDER = T24        # ou EVOLAN — nom affiché et tracé en audit
CORE_BANKING_API_URL  = https://middleware.banque.ma/api
CORE_BANKING_API_KEY  = <jeton Bearer>
```

Sans configuration, le bouton « Synchroniser depuis le SI » renvoie une erreur
claire et l'outil fonctionne en saisie manuelle.

Chaque dossier porte une **Référence SI** (`coreBankingRef`, éditable dans le
formulaire projet) qui sert de clé d'appel.

## Contrat d'API attendu

`GET {CORE_BANKING_API_URL}/dossiers/{coreBankingRef}/snapshot` → JSON :

```json
{
  "source": "T24",
  "asOf": "2026-07-31",
  "facilities": [
    {
      "externalRef": "FAC-001",
      "label": "Tranche 1 — gros œuvre",
      "authorizedAmount": 40000000,
      "drawnAmount": 25000000,
      "reservedAgios": 0,
      "installments": [
        { "seq": 1, "dueDate": "2026-06-30", "amountDue": 5000000, "amountPaid": 5000000 },
        { "seq": 2, "dueDate": "2026-09-30", "amountDue": 5000000, "amountPaid": 0 }
      ]
    }
  ],
  "disbursements": [
    { "ref": "DSB-2026-0142", "date": "2026-05-12", "amount": 10000000, "facilityRef": "FAC-001" }
  ],
  "restructured": false
}
```

Validation : `lib/domain/coreBanking.ts` (zod). Toute réponse non conforme est
rejetée avec un message explicite.

## Effets de la synchronisation (idempotente)

1. **Facilités** : upsert par `externalRef` (montants autorisé/tiré, agios) ;
   l'échéancier est remplacé par la vérité SI → le **DPD et les impayés se
   dérivent automatiquement** à la prochaine synchronisation vers le scoring
   (bascules art.10-12 de la 1/W).
2. **Déblocages** : un événement « Déblocage » par référence SI (dédoublonnage
   par `ref`) — créés **non rattachés** ; le rattachement au planning du BP
   initial se fait manuellement sur la page Suivi.
3. **Restructuration** : si le SI la signale, un événement matériel
   « Restructuration » est créé (une seule fois) → régime art.17-31 à la
   prochaine synchronisation des inputs.
4. **Audit** : chaque synchronisation est journalisée (action IMPORT, source,
   date de situation, volumes).
