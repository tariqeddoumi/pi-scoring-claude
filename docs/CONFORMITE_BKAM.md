# Conformité BKAM — Traçabilité article par article

Ce document relie chaque règle implémentée au texte des circulaires. Tous les
paramètres sont **administrables** (table `RegulatoryRegime` et dérivées) ;
les valeurs ci-dessous sont les **normes minimales** seedées par défaut.

## 1. Classification

### Circulaire 19/G/2002

| Article | Règle | Implémentation |
|---|---|---|
| Art. 2 | 3 classes : saines, en souffrance, irrégulières | `RegulatoryClass` (SAIN, PRE_DOUTEUX, DOUTEUX, COMPROMIS, CTX) ; irrégulière = statut dérivé |
| Art. 5 | Pré-douteuse : échéance impayée **90 j** ; situation non évaluable | trigger DPD 90-179 ; `financials_unavailable` |
| Art. 6 | Douteuse : **180 j** ; redressement judiciaire | trigger DPD 180-359 ; `judicial_recovery` |
| Art. 7 | Compromise : **360 j** ; action en justice, cessation | trigger DPD ≥360 ; `legal_exposure=litigation` → CTX |
| Art. 8 | Amortissable mensuel : compromise dès **9 échéances** | paramétrable (trigger DPD ≈ 270 j) |
| Art. 9 | Restructurée impayée 180 j → compromise | `restructuringFloor(..., "BKAM_19G")` |
| Art. 11 | Contagion contrepartie | `mostSevereGroupClass` (effet groupe) |
| Art. 12 | Classification indépendante des garanties | la classe est calculée avant déduction des garanties |
| Art. 33 | Effet groupe d'intérêt | `groupPeerClass` |

### Circulaire 1/W/2025 (abroge 19/G au 01/01/2027)

| Article | Règle | Implémentation |
|---|---|---|
| Art. 2-5 | **Nouvelle classe Sensible** | classe `SENSIBLE` (watch list) + triggers art. 5 |
| Art. 5.3 | **Promotion immobilière** : commercialisation < 50 % un an après travaux ; problèmes administratifs > 1 an ; retard chantier > 1 an ; décalage business plan | triggers `commercialization_below_50_1y`, `admin_problems_over_1y`, `construction_delay_over_1y`, `bp_significant_gap` |
| Art. 5.5 | CA −50 % en un an ; dettes fin./FP > 3 | `revenue_drop_pct`, `debt_equity_ratio` |
| Art. 8 | Souffrance : impayé > **90 j** ou *unlikeliness to pay* | trigger DPD + flags qualitatifs |
| Art. 10-12 | Pré-douteux 90 j / Douteux 180 j / Compromis 360 j | triggers DPD |
| Art. 12.6/12.7 | **Compromise** : projet finalisé ≥ 2 ans sans ventes ; projet à l'arrêt > 1 an | triggers `finished_2y_no_sales`, `project_stopped_over_1y` |
| Art. 17-31 | **Restructuration** (voir §3) | `restructuringFloor(..., "BKAM_1W")` |
| Art. 50 | Effet groupe **étendu aux sensibles** | `groupPeerClass` (toutes classes) |

## 2. Provisionnement

| Article | Règle | Valeur seedée |
|---|---|---|
| 19/G art. 13 | Pré-douteux 20 %, Douteux 50 %, Compromis 100 % | `REGIME_19G_PROVISION_RATES` |
| 1/W art. 32 | **Sensible ≥ 10 %** (nouveauté) | `SENSIBLE: 0.10` |
| 1/W art. 33 | Pré-douteux 20 %, Douteux 50 %, Compromis 100 % | `REGIME_1W_PROVISION_RATES` |
| Base | EAD − **agios réservés** − garanties éligibles | `provisioningEngine.computeProvision` |
| 19/G art. 4 bis | Créance **irrégulière** (couverte 100 %) | `isIrregular` → provision nulle |

## 3. Restructuration (1/W art. 17-31)

| Article | Règle | Implémentation (`restructuringFloor`) |
|---|---|---|
| Art. 18 | Restructuration non viable → douteuse | `viable === false` → DOUTEUX |
| Art. 21 | 1ʳᵉ restructuration → évaluer sensible/souffrance | floor SENSIBLE |
| Art. 22 | Différé ≥ 1 an → sensible a minima | `deferralMonths ≥ 12` → SENSIBLE |
| Art. 24 | Deux restructurations → sensible a minima | `count ≥ 2` → SENSIBLE |
| Art. 25 | 2ⁿᵈᵉ restructuration en période d'observation → douteuse | `secondDuringObservation` → DOUTEUX |
| Art. 28 | Au-delà de la 2ⁿᵈᵉ → douteuse | `count ≥ 3` → DOUTEUX |
| Art. 29 | Impayé > 30 j → sensible ; > 90 j → douteuse | `dpdOnRestructured` |

## 4. Garanties (19/G art. 15-22 ; 1/W art. 35-41)

| Quotité | Garanties | Profil d'abattement |
|---|---|---|
| **100 %** | Dépôts, garanties État / CCG (19/G) ou SNGFE (1/W), nantissement DAT/titres État | aucun |
| **80 %** | Garanties bancaires 1er ordre, assurance-crédit, nantissement titres | titres |
| **50 %** | Hypothèques immobilières, attestations marchés publics, véhicules neufs | hypothécaire / titres / véhicules |

| Article | Règle | Implémentation |
|---|---|---|
| 19/G art. 19 / 1/W art. 39 | Hypothèque **1er rang** ; évaluation récente si ≥ **1 M** (19/G) / **5 M** (1/W) | `requiresRank1`, `hypEvaluationThreshold`, `recentlyEvaluated` |
| 19/G art. 21 / 1/W art. 41 | **Abattements progressifs** : 25 % après 5 ans (hyp.) / 2 ans (titres) ; 0 % après 10 / 5 / 3 ans | `applyAbatement(profile, years)` |
| Art. 16/36 | Garanties retenues à hauteur des risques couverts | base provisionnable ≥ 0 |

## 5. Audit & gouvernance

| Exigence | Implémentation |
|---|---|
| Identification trimestrielle des créances en souffrance (19/G art. 26 ; 1/W art. 43) | `ClassificationRun` horodaté, rejouable |
| Agios réservés (19/G art. 29 ; 1/W art. 46) | `ProvisionRun.reservedAgios` |
| Traçabilité des calculs | `AuditLog` (CALCULATE / CLASSIFY / PROVISION) avant/après |
| Transaction atomique | `prisma.$transaction` dans `runFullScoring` |
