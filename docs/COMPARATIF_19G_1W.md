# Comparatif circulaires BKAM 19/G/2002 → 1/W/2025

Synthèse de lecture des deux textes et impact sur le tool de scoring promotion
immobilière (MPI). La 1/W/2025 **abroge** la 19/G/2002 et entre en vigueur **à
compter du 1ᵉʳ janvier 2027** (mise en place échelonnée sur 3 à 10 ans selon les
critères, art. 53).

## 00 — Synthèse (points clés)

1. **Nouvelle classe « Sensible »** entre saine et souffrance (logique proche d'un
   Stage 2 IFRS 9) — provisionnée à **10 %**.
2. **Déclencheurs spécifiques promotion immobilière** introduits dans le texte
   (commercialisation, retard de chantier, problèmes administratifs, arrêt de projet).
3. **Régime de restructuration détaillé** (art. 17-31) : viabilité, différé,
   périodes d'observation, réincidence.
4. **Effet groupe étendu** aux créances sensibles (art. 50).
5. **Seuil d'évaluation hypothécaire relevé** de 1 M à **5 M MAD** (art. 39).
6. Quotités de garanties **inchangées** (100 / 80 / 50 %) et abattements identiques.

## 01 — Comparatif article par article

| Thème | 19/G/2002 | 1/W/2025 |
|---|---|---|
| Classes | Saines · En souffrance · Irrégulières | Saines · **Sensibles** · En souffrance |
| Souffrance | Pré-douteux 90 j · Douteux 180 j · Compromis 360 j | Idem + *unlikeliness to pay* (art. 8) |
| Promotion immobilière | non spécifique | **Triggers dédiés** (art. 5.3, 12.6, 12.7) |
| Restructuration | art. 9 (compromise si 180 j) | **art. 17-31** (régime complet) |
| Sensible — provision | — | **10 %** (art. 32) |
| Pré-douteux / Douteux / Compromis | 20 / 50 / 100 % | 20 / 50 / 100 % |
| Effet groupe | art. 33 (souffrance) | **art. 50** (sensible + souffrance) |
| Hypothèque — seuil évaluation | ≥ 1 M MAD | **≥ 5 M MAD** |
| Garantie 100 % État | État / **CCG** | État / **SNGFE** |
| Entrée en vigueur | 2003 | **2027** (échelonnée) |

## 02 — Mapping scoring MPI (D1..D5)

| Élément 1/W | Domaine / input du tool |
|---|---|
| Sensible : commercialisation < 50 % | D3 `pre_sale_rate`, trigger `commercialization_below_50_1y` |
| Sensible : retard chantier > 1 an | D2 `progress_vs_plan`, trigger `construction_delay_over_1y` |
| Sensible : décalage business plan | D3 `sales_vs_plan`, trigger `bp_significant_gap` |
| Compromise : projet à l'arrêt > 1 an | D5 `project_stopped_over_1y` (souffrance auto) |
| Restructuration | D5 `restructured` + contexte (`restructuring_count`, `deferral`) |
| Effet groupe | champ projet `groupId` → `mostSevereGroupClass` |
| Dettes fin./FP > 3 | `debt_equity_ratio` (art. 5.5) |

## 03 — Classes & provisions

| Classe | 19/G | 1/W | Bloque GO |
|---|---|---|---|
| Saine | 0 % | 0 % | non |
| **Sensible** | — | **10 %** | non (watch list) |
| Pré-douteux | 20 % | 20 % | non |
| Douteux | 50 % | 50 % | non |
| Compromis | 100 % | 100 % | non |
| **CTX** (contentieux) | 100 % | 100 % | **oui ⇒ NO_GO, score 0** |

## 04 — Garanties (quotités, abattements)

Quotités identiques entre les deux régimes ; abattements identiques (art. 21/41).
Seules changent : l'appellation de la garantie d'État (CCG → SNGFE) et le seuil
d'évaluation hypothécaire (1 M → 5 M MAD).

| Garantie | Quotité | Abattement → 25 % | → 0 % |
|---|---|---|---|
| Hypothèque | 50 % | 5 ans | 10 ans |
| Nantissement titres / attestations | 80 / 50 % | 2 ans | 5 ans |
| Véhicules neufs | 50 % | 2 ans | 3 ans |
| Dépôts / État / DAT | 100 % | — | — |

## 05 — Red flags intégrés au scoring (pilier D5)

| Red flag | Effet |
|---|---|
| Retard chantier ≥ 6 mois | −15 |
| Cash coverage < 1,0x | −25 |
| Impasse persistante | −20 |
| Première restructuration | −25 |
| Fonds propres négatifs | −25 |
| Garantie non 1er rang | −25 |
| Impayé ≥ 90 j | **souffrance auto (hors score)** |
| Projet arrêté ≥ 12 mois | **souffrance auto (hors score)** |
| Contentieux | **CTX ⇒ NO_GO, score 0** |

## 06 — Roadmap d'intégration

1. ✅ Module cible classification/provisionnement 1/W (Sensible, triggers immobiliers).
2. ✅ Garanties détaillées (quotités + abattements + seuil d'évaluation).
3. ✅ Restructuration (art. 17-31) et effet groupe (art. 50).
4. ⏳ Authentification (NextAuth/Supabase) à brancher.
5. ⏳ Calibration statistique PD proxy → Expected Loss sur historique interne.
6. ⏳ Connecteur d'import Excel (SheetJS) et génération PDF (rapport comité).

## 07 — Sources & hypothèses de lecture

- Circulaire **19/G/2002** du 23/12/2002 (texte intégral).
- Circulaire **1/W/2025** du 15/12/2025 (texte intégral, OCR).
- Modèle interne de scoring Promotion Immobilière **V1.0**.
- Hypothèses : l'amortissable mensuel « 9 échéances » (art. 8/13) est approximé par un
  trigger DPD paramétrable ; les abattements des garanties bancaires 1er ordre (point 2)
  sans délai explicite sont laissés sans abattement (profil `NONE`), modifiable en admin.
