# -*- coding: utf-8 -*-
"""Construit l'instantané du modèle PI_PROMOTION v5.0.0 à partir de la v4.0.0
publiée (diagnostic du 1er octobre 2026 : régionalité, tranche financée,
programme mixte, équipements exigés, suivi des déblocages, désistements,
entreprise de travaux, dépassement de coût).

Les poids des domaines sont inchangés. Au sein de chaque domaine, les poids
sont rééquilibrés pour accueillir les nouveaux critères (somme = 100 %).
Ces poids sont un choix d'expert à valider : aucune calibration statistique.

Usage : python3 prisma/models/derive_v5_from_v4.py
"""
import copy, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
v4 = json.load(open(os.path.join(HERE, "PI_PROMOTION_v4.0.0.json"), encoding="utf-8"))
m = copy.deepcopy(v4)
m["version"] = "v5.0.0"
m["publishedAt"] = "2026-10-01"

def ranges(*rs):
    return [{"minIncl": a, "maxExcl": b, "score": s, "label": l, "orderIndex": i} for i, (a, b, s, l) in enumerate(rs)]

def options(*os_):
    return [{"value": v, "label": l, "score": s, "orderIndex": i} for i, (v, l, s) in enumerate(os_)]

def crit(code, name, typ, key, unit, definition, description, family="ECONOMIC", opts=None, rngs=None, gate=False, critical=False):
    return {"code": code, "name": name, "description": description, "type": typ, "weight": 0, "inputKey": key, "isGate": gate,
            "gateThreshold": None, "orderIndex": 0, "critical": critical, "family": family, "gateStage": None, "unit": unit,
            "definition": definition, "options": opts or [], "ranges": rngs or []}

NEW = {
    "D2": [
        crit("D2C9", "Tension du marché régional", "QUAL", "regional_market_tension", "modalité",
             "Appréciation datée du marché immobilier de la région administrative du programme pour son segment (référentiel « Marché régional » de la Direction des risques ou étude de marché).",
             "Régionalité : un même programme ne se vend pas au même rythme selon la région et le segment.",
             opts=options(("surstock", "Marché en surstock (écoulement lent, prix sous pression)", 2), ("equilibre", "Marché équilibré", 6), ("porteur", "Marché porteur (demande soutenue)", 10))),
        crit("D2C10", "Entreprise de travaux et garanties de marché", "QUAL", "contractor_quality", "modalité",
             "Qualification et classification de l'entreprise de BTP, nature du marché (forfaitaire ou en régie) et garanties contractuelles (caution de bonne exécution, retenue de garantie).",
             "Risque d'achèvement porté par l'entreprise qui construit.",
             opts=options(("non_qualifiee", "Entreprise non qualifiée, travaux en régie ou promoteur-constructeur sans structure", 2),
                          ("qualifiee", "Entreprise qualifiée, garanties de marché partielles", 6),
                          ("qualifiee_garantie", "Entreprise qualifiée et classée, marché forfaitaire avec caution de bonne exécution et retenue de garantie", 10))),
        crit("D2C11", "Équipements exigés non budgétés (% du coût)", "NUM", "equipment_unbudgeted_pct", "%",
             "Coût des équipements exigés par la commune, le cahier des charges ou l'autorisation (mosquée, école, voirie…) non prévus au budget et à la charge du programme / coût total du programme.",
             "Un équipement public non budgété ampute la marge et peut bloquer la réception.",
             rngs=ranges((None, 0.0001, 10, "0 % — tout est budgété (favorable)"), (0.0001, 3, 6, "> 0 à < 3 % (vigilance)"), (3, None, 1, "≥ 3 % (critique)"))),
        crit("D2C12", "Autonomie du périmètre financé (tranche)", "QUAL", "tranche_dependency", "modalité",
             "Lorsque la banque finance une tranche et non le programme entier : la tranche peut-elle être achevée, livrée et vendue sans les ouvrages communs (accès, VRD, raccordements) d'autres tranches ?",
             "Financement d'un lot : risque de dépendance aux tranches non financées.",
             opts=options(("dependante_non_financee", "Tranche dépendante d'ouvrages communs non financés", 1),
                          ("dependante_financee", "Tranche dépendante d'ouvrages communs financés ou réalisés", 6),
                          ("autonome", "Tranche autonome (accès, VRD et raccordements propres)", 10),
                          ("programme_entier", "Financement du programme entier", 10))),
    ],
    "D3": [
        crit("D3C9", "Part du CA en produits à écoulement lent", "NUM", "slow_liquidity_share_pct", "%",
             "Chiffre d'affaires des commerces, bureaux et composantes hôtelières / chiffre d'affaires total du programme (ou du périmètre financé).",
             "Programme mixte : les commerces, bureaux et l'hôtel se vendent plus lentement que les logements.",
             rngs=ranges((None, 20, 10, "< 20 % (favorable)"), (20, 40, 6, "20 à < 40 % (vigilance)"), (40, None, 1, "≥ 40 % (critique)"))),
        crit("D3C10", "Taux de désistement des réservations", "NUM", "cancellation_rate_pct", "%",
             "Désistements / (réservations, compromis, ventes et livraisons + désistements), sur le périmètre financé.",
             "Qualité des préventes : une prévente qui se désiste n'en était pas une.",
             rngs=ranges((None, 10, 10, "< 10 % (favorable)"), (10, 20, 6, "10 à < 20 % (vigilance)"), (20, None, 1, "≥ 20 % (critique)"))),
    ],
    "D4": [
        crit("D4C8", "Déblocages vs avancement certifié", "NUM", "drawdown_vs_progress_pct", "%",
             "Cumul débloqué sur les crédits de travaux / (montant autorisé × avancement certifié) × 100. Au-delà de 100 %, la banque a financé plus que les travaux réalisés.",
             "Suivi des déblocages : un tirage en avance sur les travaux réduit la valeur de la garantie par rapport à l'encours.",
             family="GUARANTEE",
             rngs=ranges((None, 105, 10, "< 105 % — en phase (favorable)"), (105, 115, 6, "105 à < 115 % (vigilance)"), (115, None, 1, "≥ 115 % — tirages en avance (critique)"))),
        crit("D4C9", "Dépassement du coût à terminaison", "NUM", "cost_overrun_pct", "%",
             "(Coût à terminaison estimé − coût du budget initial) / coût du budget initial × 100.",
             "Un dépassement de coût consomme la marge et l'apport, et crée une impasse.",
             rngs=ranges((None, 5, 10, "< 5 % (favorable)"), (5, 10, 6, "5 à < 10 % (vigilance)"), (10, None, 1, "≥ 10 % (critique)"))),
    ],
}

WEIGHTS = {
    "D1": {"D1C1": 0.20, "D1C2": 0.25, "D1C3": 0.15, "D1C4": 0.15, "D1C5": 0.10, "D1C6": 0.15},
    "D2": {"D2C1": 0.10, "D2C2": 0.15, "D2C3": 0.10, "D2C4": 0.10, "D2C5": 0.05, "D2C6": 0.05, "D2C7": 0.05, "D2C8": 0.10,
           "D2C9": 0.10, "D2C10": 0.10, "D2C11": 0.05, "D2C12": 0.05},
    "D3": {"D3C1": 0.15, "D3C2": 0.10, "D3C3": 0.05, "D3C4": 0.20, "D3C5": 0.15, "D3C6": 0.05, "D3C7": 0.10, "D3C8": 0.05,
           "D3C9": 0.05, "D3C10": 0.10},
    "D4": {"D4C1": 0.15, "D4C2": 0.10, "D4C3": 0.20, "D4C4": 0.10, "D4C5": 0.10, "D4C6": 0.10, "D4C7": 0.05,
           "D4C8": 0.10, "D4C9": 0.10},
}

for d in m["domains"]:
    d["criteria"].extend(NEW.get(d["code"], []))
    w = WEIGHTS[d["code"]]
    assert set(w) == {c["code"] for c in d["criteria"]}, d["code"]
    assert abs(sum(w.values()) - 1) < 1e-9, d["code"]
    for i, c in enumerate(d["criteria"]):
        c["weight"] = w[c["code"]]
        c["orderIndex"] = i

def flag(code, name, key, sev, malus, doms, effect, committee, regref, desc, hint, mitigable=True):
    return {"code": code, "name": name, "description": desc, "rule": {"clause": {"op": "isTrue", "key": key}}, "severity": sev,
            "impactDomains": doms, "malus": malus, "mitigable": mitigable, "mitigantHint": hint, "effect": effect,
            "requiresCommittee": committee, "regRef": regref}

m["redFlags"].extend([
    flag("RF_TIRAGE_AVANCE", "Déblocages en avance sur l'avancement des travaux", "drawdown_ahead_of_works", "HIGH", 15, ["D4", "D5"], "SURVEILLANCE", True,
         "Politique de crédit — déblocage sur situation de travaux visée",
         "Le cumul débloqué dépasse de 15 % ou plus ce que justifie l'avancement certifié : l'encours devance la valeur créée.",
         "Suspendre les tirages jusqu'à une situation de travaux visée cohérente ; recaler le plan de tirage."),
    flag("RF_PLAN_TIRAGE_RETARD", "Plan de tirage en retard sur le calendrier", "drawdown_schedule_late", "MEDIUM", 5, ["D2", "D5"], "SURVEILLANCE", False,
         "Planning des déblocages du business plan",
         "Au moins 25 % du montant prévu à date n'a pas été débloqué : signe d'un chantier en retard ou d'un besoin mal calibré.",
         "Visite de chantier ; mise à jour du planning et du plan de trésorerie."),
    flag("RF_EQUIPEMENT_RECEPTION", "Équipement exigé en retard (conditionne la réception)", "equipment_delivery_at_risk", "HIGH", 15, ["D2", "D5"], "SURVEILLANCE", True,
         "Cahier des charges / convention avec la commune ; réception et permis d'habiter",
         "Un équipement exigé (mosquée, école, voirie…) conditionnant la réception est en retard : risque de blocage de la livraison, des actes et des mainlevées.",
         "Calendrier de réalisation de l'équipement, financement identifié, accord de la commune."),
    flag("RF_COMPOSANTE_SANS_PRENEUR", "Composante commerciale ou hôtelière sans preneur engagé", "component_exit_unsecured", "MEDIUM", 10, ["D3", "D5"], "HYPOTHESIS", False,
         "Programme mixte — liquidité des composantes non résidentielles",
         "Une composante significative (hôtel, commerces, bureaux) n'a ni acquéreur, ni opérateur, ni preneur engagé.",
         "Lettre d'engagement d'un opérateur ou d'un investisseur ; plan de commercialisation dédié."),
    {"code": "RF_TRANCHE_DEPENDANTE", "name": "Tranche financée dépendante d'ouvrages communs non financés",
     "description": "La banque finance une tranche qui ne peut être achevée, livrée ou vendue sans des ouvrages communs (accès, VRD, raccordements) qui ne sont ni réalisés ni financés.",
     "rule": {"clause": {"op": "eq", "key": "tranche_dependency", "value": "dependante_non_financee"}}, "severity": "HIGH",
     "impactDomains": ["D2", "D5"], "malus": 15, "mitigable": True,
     "mitigantHint": "Financement ou réalisation préalable des ouvrages communs ; condition suspensive au premier tirage.",
     "effect": "SURVEILLANCE", "requiresCommittee": True, "regRef": "Financement par tranche — ouvrages communs"},
])
m["redFlags"].sort(key=lambda r: r["code"])

out = os.path.join(HERE, "PI_PROMOTION_v5.0.0.json")
json.dump(m, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("écrit", out, "·", sum(len(d["criteria"]) for d in m["domains"]), "critères ·", len(m["redFlags"]), "alertes")
