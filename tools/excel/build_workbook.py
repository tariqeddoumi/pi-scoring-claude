# -*- coding: utf-8 -*-
"""Génère le classeur Excel du modèle PI_PROMOTION.

Sources uniques (aucune copie manuelle) :
  - modèle : prisma/models/PI_PROMOTION_v5.0.0.json (instantané exact de la base) ;
  - référentiels métier : _build/referentiels.json (exporté du code de
    l'application par _build/gen_refs.ts) ;
  - cas de référence : _build/vectors.json (moteur de production, _build/gen_vectors.ts).
Le moteur est en FORMULES Excel ; le VBA n'orchestre que."""
import json, os, sys, xlsxwriter

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "_build") + os.sep
SNAPSHOT = os.path.join(HERE, "..", "..", "prisma", "models", "PI_PROMOTION_v5.0.0.json")
TOOL_VERSION = "5.1"
TOOL_DATE = "05/10/2026"


def from_snapshot(path):
    """Convertit l'instantané du modèle en listes compactes utilisées par le générateur."""
    m = json.load(open(path, encoding="utf-8"))
    meta = {"version": m["version"], "scoreScale": m["scoreScale"], "publishedAt": m.get("publishedAt", ""),
            "thresholds": m["decisionThresholds"], "bam": m["bamCoefficients"],
            "segments": m["segmentAdjustments"], "zones": m["zoneAdjustments"],
            "domains": [[d["code"], d["name"], d["weight"]] for d in sorted(m["domains"], key=lambda d: d["orderIndex"])]}
    crit, bar = [], []
    for d in sorted(m["domains"], key=lambda d: d["orderIndex"]):
        for c in sorted(d["criteria"], key=lambda c: c["orderIndex"]):
            crit.append([d["code"], c["code"], c["name"], c["type"], c["weight"], c["inputKey"], c["isGate"],
                         c["gateThreshold"], c["gateStage"], c["family"], bool(c["critical"]), c["unit"], c["orderIndex"]])
            for o in sorted(c["options"], key=lambda o: o["orderIndex"]):
                bar.append([c["code"], "MODALITE", o["orderIndex"], None, None, o["value"], o["label"], o["score"]])
            for r in sorted(c["ranges"], key=lambda r: r["orderIndex"]):
                bar.append([c["code"], "PLAGE", r["orderIndex"], r["minIncl"], r["maxExcl"], None, r["label"], r["score"]])
    alr = []
    for f in sorted(m["redFlags"], key=lambda f: f["code"]):
        cl = f["rule"]["clause"]
        alr.append([f["code"], f["name"], f["severity"], f["malus"], ",".join(f["impactDomains"]), cl["key"], cl["op"],
                    cl.get("value"), bool(f["requiresCommittee"]), f["effect"], f["regRef"], f["mitigable"]])
    return meta, crit, bar, alr


meta, crit, bar, alr = from_snapshot(SNAPSHOT)
refs = json.load(open(D + "referentiels.json", encoding="utf-8"))
vec = json.load(open(D + "vectors.json", encoding="utf-8"))
# Usage : build_workbook.py [sortie.xlsx|sortie.xlsm] [--cache valeurs.json] [--vba vbaProject.bin]
# --cache : valeurs calculées (LibreOffice) écrites comme résultats en cache des formules, pour
#           que l'aperçu (mode protégé, messagerie, téléphone) affiche le vrai résultat ;
# --vba   : projet VBA intégré (classeur .xlsm prêt à l'emploi).
args = sys.argv[1:]
def opt(name):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return None
CACHE_PATH, VBA_PATH = opt("--cache"), opt("--vba")
OUT = args[0] if args else os.path.join(HERE, "PI_Promotion_Modele_v5.xlsx")
CACHE = json.load(open(CACHE_PATH, encoding="utf-8")) if CACHE_PATH else {}

wb = xlsxwriter.Workbook(OUT)
if VBA_PATH:
    wb.add_vba_project(VBA_PATH)

# Résultats en cache : chaque formule reçoit la valeur calculée par LibreOffice (même adresse).
from xlsxwriter.worksheet import Worksheet as _WS
from xlsxwriter.utility import xl_cell_to_rowcol as _rc
_wf, _waf = _WS.write_formula, _WS.write_array_formula
def _cached(ws, row, col):
    v = CACHE.get(ws.name, {}).get(f"{row},{col}")
    return v
def _write_formula(self, *a, **k):
    if isinstance(a[0], str):
        row, col = _rc(a[0]); rest = a[1:]
    else:
        row, col = a[0], a[1]; rest = a[2:]
    formula = rest[0]; fmt = rest[1] if len(rest) > 1 else k.get("cell_format")
    v = _cached(self, row, col)
    return _wf(self, row, col, formula, fmt, v if v is not None else 0) if CACHE else _wf(self, row, col, formula, fmt)
def _write_array_formula(self, *a, **k):
    if isinstance(a[0], str):
        rng = a[0].split(":"); r1, c1 = _rc(rng[0]); r2, c2 = _rc(rng[-1]); rest = a[1:]
    else:
        r1, c1, r2, c2 = a[:4]; rest = a[4:]
    formula = rest[0]; fmt = rest[1] if len(rest) > 1 else None
    v = _cached(self, r1, c1)
    return _waf(self, r1, c1, r2, c2, formula, fmt, v if v is not None else 0) if CACHE else _waf(self, r1, c1, r2, c2, formula, fmt)
_WS.write_formula, _WS.write_array_formula = _write_formula, _write_array_formula
NAVY, BLUE, LIGHT, GREY = "#1F3864", "#2E5496", "#D9E1F2", "#F2F2F2"
f = lambda **k: wb.add_format({"font_name": "Calibri", "font_size": 10, **k})
F_TITLE = f(bold=True, font_size=16, font_color=NAVY)
F_SUB = f(italic=True, font_color="#595959")
F_H = f(bold=True, font_color="white", bg_color=BLUE, border=1, text_wrap=True, valign="vcenter")
F_HS = f(bold=True, font_color=NAVY, bg_color=LIGHT, border=1)
# Cellules de saisie (jaunes) : non verrouillées, seules modifiables quand la feuille est protégée.
F_IN = f(bg_color="#FFF2CC", border=1, locked=False)
F_INN = f(bg_color="#FFF2CC", border=1, num_format="0.####", locked=False)
F_P = f(bg_color="#DDEBF7", border=1)
F_PN = f(bg_color="#DDEBF7", border=1, num_format="0.####")
F_C = f(bg_color=GREY, border=1)
F_CN = f(bg_color=GREY, border=1, num_format="0.00;-0.00;;@")
F_CN4 = f(bg_color=GREY, border=1, num_format="0.0000")
F_CP = f(bg_color=GREY, border=1, num_format="0.0%")
F_L = f(bold=True)
F_BIG = f(bold=True, font_size=18, font_color=NAVY, align="center", border=2, num_format="0.00")
F_BIGT = f(bold=True, font_size=14, align="center", border=2)
F_W = f(text_wrap=True, valign="top")
F_WB = f(text_wrap=True, valign="top", bold=True, font_color=NAVY)
F_RAW = f(font_color="#7F7F7F", font_size=8, bg_color=GREY, border=1)
F_OK = f(bg_color="#C6EFCE", font_color="#006100")
F_KO = f(bg_color="#FFC7CE", font_color="#9C0006")
F_WA = f(bg_color="#FFEB9C", font_color="#7F6000")
F_GR = f(bg_color="#D9D9D9", font_color="#404040")

# ---------------------------------------------------------------- listes clés
crit_keys = [(c[5], c[2], c[3], c[0]) for c in crit]                       # (key,label,type,dom)
DERIVED = ["authorization_completeness_pct", "works_authorization_blocked", "secured_sales_rate",
           "buyers_financing_at_risk", "release_quotity_gap_pts", "release_underpriced", "division_limit_breach",
           "project_stopped_months",
           # v5 : déblocages, plan de tirage, équipements, programme mixte, désistements, coût
           "drawdown_vs_progress_pct", "drawdown_ahead_of_works", "drawdown_schedule_late",
           "equipment_unbudgeted_pct", "equipment_delivery_at_risk", "slow_liquidity_share_pct",
           "cancellation_rate_pct", "cost_overrun_pct"]
extra = [("dpd_days", "Retard de paiement (jours)", "NUM"), ("construction_delay_months", "Retard chantier (mois)", "NUM"),
         ("project_stopped_months", "Arrêt du projet (mois)", "NUM"), ("restructured", "Créance restructurée", "QUAL"),
         ("legal_exposure", "Exposition juridique", "QUAL"), ("equity_negative", "Fonds propres négatifs", "BOOL"),
         ("funding_gap_persistent", "Impasse de trésorerie persistante", "BOOL"),
         ("works_authorization_blocked", "Autorisation de travaux bloquante", "BOOL"),
         ("buyers_financing_at_risk", "Financement des acquéreurs à risque", "BOOL"),
         ("release_underpriced", "Mainlevée sous-tarifée", "BOOL"),
         ("division_limit_breach", "Limite de division des risques dépassée", "BOOL"),
         ("drawdown_ahead_of_works", "Déblocages en avance sur les travaux", "BOOL"),
         ("drawdown_schedule_late", "Plan de tirage en retard", "BOOL"),
         ("equipment_delivery_at_risk", "Équipement exigé en retard (réception)", "BOOL"),
         ("component_exit_unsecured", "Composante commerciale / hôtelière sans preneur", "BOOL")]
KEYS = []   # (section, key, label, type)
domname = {d[0]: d[1] for d in meta["domains"]}
for k, lab, t, dm in crit_keys:
    KEYS.append((f"{dm} — {domname[dm]}", k, lab, t))
for k, lab, t in extra:
    KEYS.append(("Alertes D5", k, lab, t))
NK = len(KEYS)
STATIC_LISTS = {"restructured": ["yes", "no"], "legal_exposure": ["clear", "watch", "litigation"]}
opts = {}
for b in bar:
    if b[1] == "MODALITE": opts.setdefault(b[0], []).append(b[5])
crit_by_key = {c[5]: c for c in crit}
def key_list(k):
    if k in STATIC_LISTS: return STATIC_LISTS[k]
    c = crit_by_key.get(k)
    if c and c[3] == "QUAL": return opts[c[1]]
    return None

# ------------------------------------------------------------------ feuilles
# Ordre de travail : Accueil → Saisie → Fiche ; puis outils ; onglets techniques masqués.
wsAc = wb.add_worksheet("Accueil")
wsS = wb.add_worksheet("Saisie")
wsFi = wb.add_worksheet("Fiche")
wsC = wb.add_worksheet("Calculateurs")
wsP = wb.add_worksheet("Portefeuille")
wsX = wb.add_worksheet("Stress")
wsR = wb.add_worksheet("Resultat")
wsH = wb.add_worksheet("Historique")
wsL = wb.add_worksheet("Aide")
wsT = wb.add_worksheet("Tests")
wsV = wb.add_worksheet("Validation")   # rapport de la macro ValiderModele (aucune feuille créée par macro)
wsG = wb.add_worksheet("P_General")
wsK = wb.add_worksheet("P_Criteres")
wsB = wb.add_worksheet("P_Baremes")
wsA = wb.add_worksheet("P_Alertes")
wsJ = wb.add_worksheet("P_Ajustements")
wsF = wb.add_worksheet("P_Referentiels")
for w in (wsG, wsK, wsB, wsA, wsJ, wsF): w.set_tab_color("#5B9BD5")
for w in (wsS, wsC): w.set_tab_color("#FFC000")
for w in (wsFi, wsAc): w.set_tab_color("#70AD47")
wsR.set_tab_color("#A9D08E")
# Paramètres et cas de référence : masqués (ruban « Scoring PI » › Paramètres, ou clic droit › Afficher).
for w in (wsT, wsV, wsG, wsK, wsB, wsA, wsJ, wsF): w.hide()
wsV.write("A1", "Validation du modèle : ruban « Scoring PI » › Valider le modèle (le rapport s'affiche ici).", F_SUB)

# ============================================================ P_General
wsG.set_column("A:A", 34); wsG.set_column("B:I", 16)
wsG.write("A1", "Paramètres généraux du modèle", F_TITLE)
wsG.write("A2", "Cellules bleues = paramétrables. Toute modification doit être validée (macro ValiderModele) et versionnée.", F_SUB)
wsG.write_row("A3", ["Paramètre", "Valeur"], F_H)
gen = [("Version du modèle", meta["version"], "P_Version"), ("Publié le", meta["publishedAt"], "P_Date"),
       ("Échelle de notation des critères", meta["scoreScale"], "P_Scale"),
       ("Seuil GO (score final ≥)", meta["thresholds"]["go"], "P_GO"),
       ("Seuil GO sous conditions (≥)", meta["thresholds"]["goWithConditions"], "P_GWC"),
       ("Seuil Watch list (≥)", meta["thresholds"]["watchList"], "P_WATCH"),
       ("PD proxy — constante a", 2.223, "P_PDa"), ("PD proxy — coefficient b", 0.0802, "P_PDb"),
       ("Clé critique additionnelle", "dpd_days", "P_ExtraKey")]
for i, (lab, val, nm) in enumerate(gen):
    r = 4 + i
    wsG.write(f"A{r}", lab, F_C); wsG.write(f"B{r}", val, F_PN if not isinstance(val, str) else F_P)
    wb.define_name(nm, f"=P_General!$B${r}")
wsG.write("A14", "Domaines de notation", F_HS)
wsG.write_row("A15", ["Code", "Nom", "Poids"], F_H)
for i in range(8):
    r = 16 + i
    if i < len(meta["domains"]):
        d = meta["domains"][i]; wsG.write(f"A{r}", d[0], F_P); wsG.write(f"B{r}", d[1], F_P); wsG.write(f"C{r}", d[2], F_PN)
    else:
        for c in "ABC": wsG.write_blank(f"{c}{r}", None, F_P)
wb.define_name("P_DomCodes", "=P_General!$A$16:$A$23"); wb.define_name("P_DomNoms", "=P_General!$B$16:$B$23")
wb.define_name("P_DomPoids", "=P_General!$C$16:$C$23")
wsG.write("A25", "Classes réglementaires (ordre de sévérité croissante)", F_HS)
wsG.write_row("A26", ["Code", "Libellé", "Défaut avéré", "Bloque GO", "Coefficient BAM"], F_H)
cls = [("SAIN", "Créance saine", "Non", "Non"), ("SENSIBLE", "Créance sensible (surveillance)", "Non", "Non"),
       ("PRE_DOUTEUX", "Pré-douteuse", "Oui", "Non"), ("DOUTEUX", "Douteuse", "Oui", "Non"),
       ("COMPROMIS", "Compromise", "Oui", "Non"), ("CTX", "Contentieux", "Oui", "Oui")]
for i in range(10):
    r = 27 + i
    if i < len(cls):
        c = cls[i]; wsG.write(f"A{r}", c[0], F_P); wsG.write(f"B{r}", c[1], F_P); wsG.write(f"C{r}", c[2], F_P)
        wsG.write(f"D{r}", c[3], F_P); wsG.write(f"E{r}", meta["bam"][c[0]], F_PN)
    else:
        for c in "ABCDE": wsG.write_blank(f"{c}{r}", None, F_P)
wb.define_name("P_Classes", "=P_General!$A$27:$E$36"); wb.define_name("P_ClsCodes", "=P_General!$A$27:$A$36")
wsG.write("A38", "Grilles de pondération par phase (challenger — non adoptées)", F_HS)
wsG.write("A39", "Phase", F_H)
for j, d in enumerate(meta["domains"]): wsG.write(38, 1 + j, d[0], F_H)
phases = [("PRE_DEVELOPMENT", [0.25, 0.30, 0.20, 0.25]), ("CONSTRUCTION", [0.20, 0.25, 0.25, 0.30]), ("ECOULEMENT", [0.15, 0.10, 0.35, 0.40])]
for i, (p, ws_) in enumerate(phases):
    r = 40 + i; wsG.write(f"A{r}", p, F_P)
    for j, w in enumerate(ws_): wsG.write(r - 1, 1 + j, w, F_PN)
wb.define_name("P_PhaseHdr", "=P_General!$B$39:$I$39"); wb.define_name("P_PhaseTbl", "=P_General!$A$40:$I$42")
wb.define_name("P_PhaseCodes", "=P_General!$A$40:$A$42")
wsG.write("A44", "Repères de retard de paiement (jours)", F_HS)
for i, (lab, v, nm) in enumerate([("Seuil pré-douteux", 90, "P_DPD1"), ("Seuil douteux", 180, "P_DPD2"), ("Seuil compromis", 360, "P_DPD3")]):
    r = 45 + i; wsG.write(f"A{r}", lab, F_C); wsG.write(f"B{r}", v, F_PN); wb.define_name(nm, f"=P_General!$B${r}")
wsG.write("A50", "Libellés des décisions (affichage)", F_HS)
wsG.write_row("A51", ["Code", "Libellé"], F_H)
DEC_LABELS = [("GO", "Favorable"), ("GO_WITH_CONDITIONS", "Favorable sous conditions"), ("WATCH_LIST", "Surveillance (watch list)"),
              ("NO_GO", "Défavorable"), ("DOSSIER_INCOMPLET", "Dossier incomplet")]
for i, (c_, l_) in enumerate(DEC_LABELS):
    wsG.write(f"A{52+i}", c_, F_P); wsG.write(f"B{52+i}", l_, F_P)
wb.define_name("P_DecTbl", "=P_General!$A$52:$B$56")
# Interrupteur des calculateurs : les macros de traitement de masse (portefeuille,
# autotests) le coupent pour qu'aucune valeur du dossier courant ne se mêle aux lignes scorées.
wsG.write("D4", "Calculateurs actifs", F_C); wsG.write_boolean("E4", True, F_P)
wb.define_name("Calc_Actif", "=P_General!$E$4")

# ============================================================ P_Ajustements
wsJ.set_column("A:A", 22); wsJ.set_column("B:B", 30); wsJ.set_column("C:C", 10); wsJ.set_column("E:E", 22); wsJ.set_column("F:F", 30); wsJ.set_column("G:G", 10)
wsJ.write("A1", "Ajustements segment (α) et zone (β)", F_TITLE)
wsJ.write("A2", "S_ajusté = S_éco × (1 + α + β). Un segment ou une zone hors de ces listes est signalé, jamais assimilé à un risque neutre.", F_SUB)
wsJ.write_row("A4", ["Segment", "Libellé", "α"], F_H); wsJ.write_row("E4", ["Zone", "Libellé", "β"], F_H)
seglab = {"social": "Logement social", "intermediaire": "Logement intermédiaire", "moyen_haut": "Moyen-haut standing", "touristique": "Touristique / hôtelier", "bureaux": "Bureaux", "commerces": "Commerces", "villas": "Villas"}
zonelab = {"casa_centre": "Casablanca — centre", "casa_peripherie": "Casablanca — périphérie", "rabat_centre": "Rabat — centre", "rabat_peripherie": "Rabat — périphérie", "tanger": "Tanger", "marrakech": "Marrakech", "agadir": "Agadir", "fes_oriental": "Fès / Oriental", "regions_interieures": "Régions intérieures"}
for i in range(20):
    r = 5 + i
    for (cols, dct, lab) in ((("A", "B", "C"), meta["segments"], seglab), (("E", "F", "G"), meta["zones"], zonelab)):
        ks = list(dct.keys())
        if i < len(ks):
            wsJ.write(f"{cols[0]}{r}", ks[i], F_P); wsJ.write(f"{cols[1]}{r}", lab[ks[i]], F_P); wsJ.write(f"{cols[2]}{r}", dct[ks[i]], F_PN)
        else:
            for c in cols: wsJ.write_blank(f"{c}{r}", None, F_P)
wb.define_name("P_SegCodes", "=P_Ajustements!$A$5:$A$24"); wb.define_name("P_SegTbl", "=P_Ajustements!$A$5:$C$24")
wb.define_name("P_ZoneCodes", "=P_Ajustements!$E$5:$E$24"); wb.define_name("P_ZoneTbl", "=P_Ajustements!$E$5:$G$24")
wb.define_name("P_SegLabels", f"=P_Ajustements!$B$5:$B${4+len(meta['segments'])}")
wb.define_name("P_ZoneLabels", f"=P_Ajustements!$F$5:$F${4+len(meta['zones'])}")
wb.define_name("P_SegLabelsAll", "=P_Ajustements!$B$5:$B$24"); wb.define_name("P_ZoneLabelsAll", "=P_Ajustements!$F$5:$F$24")

# ============================================================ P_Criteres
NCR = 60; CR0 = 5
wsK.set_column("A:B", 9); wsK.set_column("C:C", 46); wsK.set_column("D:D", 8); wsK.set_column("E:E", 8); wsK.set_column("F:F", 32)
wsK.set_column("G:H", 9); wsK.set_column("I:I", 12); wsK.set_column("J:J", 12); wsK.set_column("K:K", 9); wsK.set_column("L:L", 10)
wsK.write("A1", f"Critères de notation ({len(crit)} dans la {meta['version']} — jusqu'à 60 lignes)", F_TITLE)
wsK.write("A2", "Ajouter un critère = compléter une ligne + ses barèmes (P_Baremes) + sa clé dans Saisie. Poids du domaine : somme = 100 %.", F_SUB)
wsK.write_row("A4", ["Code", "Domaine", "Libellé", "Type", "Poids", "Clé d'entrée", "Gate", "Seuil gate", "Jalon gate", "Famille", "Critique", "Unité"], F_H)
for i in range(NCR):
    r = CR0 + i
    if i < len(crit):
        c = crit[i]
        vals = [c[1], c[0], c[2], c[3], c[4], c[5], "Oui" if c[6] else "Non", c[7], c[8], c[9], "Oui" if c[10] else "Non", c[11]]
    else:
        vals = [None] * 12
    for j, v in enumerate(vals):
        fmt = F_PN if j in (4, 7) else F_P
        if v is None: wsK.write_blank(r - 1, j, None, fmt)
        else: wsK.write(r - 1, j, v, fmt)
CRL = CR0 + NCR - 1
wsK.data_validation(f"D{CR0}:D{CRL}", {"validate": "list", "source": ["NUM", "QUAL"], "ignore_blank": True})
wsK.data_validation(f"G{CR0}:G{CRL}", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})
wsK.data_validation(f"K{CR0}:K{CRL}", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})
wsK.data_validation(f"J{CR0}:J{CRL}", {"validate": "list", "source": ["ECONOMIC", "GUARANTEE"], "ignore_blank": True})
wsK.freeze_panes(4, 3)

# ============================================================ P_Baremes
BR0 = 5; BRL = 400
wsB.set_column("A:A", 9); wsB.set_column("B:B", 11); wsB.set_column("C:C", 16); wsB.set_column("D:E", 10); wsB.set_column("F:F", 40); wsB.set_column("G:H", 8)
wsB.write("A1", "Barèmes de notation", F_TITLE)
wsB.write("A2", "PLAGE : borne basse incluse (≥ Min), borne haute exclue (< Max) ; cellule vide = illimité. MODALITE : valeur exacte saisie. Note de 1 à 10.", F_SUB)
wsB.write_row("A4", ["Critère", "Type", "Valeur (modalité)", "Min (≥)", "Max (<)", "Libellé", "Ordre", "Note"], F_H)
for i, b in enumerate(bar):
    r = BR0 + i - 1
    wsB.write(r, 0, b[0], F_P); wsB.write(r, 1, b[1], F_P)
    if b[5] is None: wsB.write_blank(r, 2, None, F_P)
    else: wsB.write(r, 2, b[5], F_P)
    for j, idx in ((3, 3), (4, 4)):
        if b[idx] is None: wsB.write_blank(r, j, None, F_PN)
        else: wsB.write(r, j, b[idx], F_PN)
    wsB.write(r, 5, b[6], F_P); wsB.write(r, 6, b[2], F_P); wsB.write(r, 7, b[7], F_PN)
wsB.data_validation(f"B{BR0}:B{BRL}", {"validate": "list", "source": ["PLAGE", "MODALITE"], "ignore_blank": True})
wsB.freeze_panes(4, 0)

# ============================================================ P_Alertes
NAL = 30; AL0 = 5
wsA.set_column("A:A", 30); wsA.set_column("B:B", 48); wsA.set_column("C:C", 11); wsA.set_column("D:D", 8); wsA.set_column("E:E", 10)
wsA.set_column("F:F", 30); wsA.set_column("G:G", 10); wsA.set_column("H:H", 12); wsA.set_column("I:I", 9); wsA.set_column("J:J", 14); wsA.set_column("K:K", 50)
wsA.write("A1", "Couche D5 — alertes (red flags)", F_TITLE)
wsA.write("A2", "Règle simple : Clé / Opérateur / Valeur. Opérateurs : isTrue, isFalse, eq, neq, gt, gte, lt, lte. BLOCKING = souffrance automatique (malus 0).", F_SUB)
wsA.write_row("A4", ["Code", "Libellé", "Sévérité", "Malus", "Domaines", "Clé d'entrée", "Opérateur", "Valeur réf.", "Comité", "Effet", "Référence réglementaire / interne"], F_H)
for i in range(NAL):
    r = AL0 + i - 1
    if i < len(alr):
        a = alr[i]; vals = [a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], "Oui" if a[8] else "Non", a[9], a[10]]
    else: vals = [None] * 11
    for j, v in enumerate(vals):
        fmt = F_PN if j in (3, 7) else F_P
        if v is None: wsA.write_blank(r, j, None, fmt)
        else: wsA.write(r, j, v, fmt)
ALL = AL0 + NAL - 1
wsA.data_validation(f"C{AL0}:C{ALL}", {"validate": "list", "source": ["LOW", "MEDIUM", "HIGH", "BLOCKING"], "ignore_blank": True})
wsA.data_validation(f"G{AL0}:G{ALL}", {"validate": "list", "source": ["isTrue", "isFalse", "eq", "neq", "gt", "gte", "lt", "lte"], "ignore_blank": True})
wsA.data_validation(f"I{AL0}:I{ALL}", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})

# ============================================================ P_Referentiels
wsF.set_column("A:A", 28); wsF.set_column("B:B", 52); wsF.set_column("C:C", 11); wsF.set_column("D:F", 12); wsF.set_column("G:H", 12); wsF.set_column("I:I", 40)
wsF.write("A1", "Référentiels métier (pratique marocaine)", F_TITLE)
wsF.write("A2", "Équivalents des référentiels administrables de l'application. Modifiables ici sans macro.", F_SUB)
wsF.write("A4", "Chaîne d'autorisations", F_HS)
wsF.write_row("A5", ["Code", "Pièce", "Jalon", "Lotissement", "Construction", "Mixte", "Bloque travaux", "Bloque livraison", "Référence"], F_H)
AUTH = [(a["code"], a["label"], a["stage"], "LOTISSEMENT" in a["appliesTo"], "CONSTRUCTION" in a["appliesTo"],
         "MIXTE" in a["appliesTo"], a["blocksWorks"], a["blocksDelivery"], a["regRef"]) for a in refs["auth"]]
for i in range(24):
    r = 6 + i - 1
    if i < len(AUTH):
        a = AUTH[i]
        wsF.write(r, 0, a[0], F_P); wsF.write(r, 1, a[1], F_P); wsF.write(r, 2, a[2], F_P)
        for j in range(3, 8): wsF.write(r, j, "Oui" if a[j] else "Non", F_P)
        wsF.write(r, 8, a[8], F_P)
    else:
        for j in range(9): wsF.write_blank(r, j, None, F_P)
wb.define_name("R_AuthCodes", "=P_Referentiels!$A$6:$A$29"); wb.define_name("R_AuthTbl", "=P_Referentiels!$A$6:$I$29")
wsF.write("A32", "Financement de l'acquéreur", F_HS)
wsF.write_row("A33", ["Code", "Libellé", "Facteur de sécurisation"], F_H)
FIN = [(x["code"], x["label"], x["factor"]) for x in refs["financing"]]
for i in range(12):
    r = 34 + i - 1
    if i < len(FIN):
        wsF.write(r, 0, FIN[i][0], F_P); wsF.write(r, 1, FIN[i][1], F_P); wsF.write(r, 2, FIN[i][2], F_PN)
    else:
        for j in range(3): wsF.write_blank(r, j, None, F_P)
wb.define_name("R_FinCodes", "=P_Referentiels!$A$34:$A$45"); wb.define_name("R_FinTbl", "=P_Referentiels!$A$34:$C$45")
wsF.write("A48", "Natures de concours (information — contrôle de tirage)", F_HS)
wsF.write_row("A49", ["Code", "Libellé", "Situation de travaux visée requise"], F_H)
NAT = [(x["code"], x["label"], "Oui" if x["requiresWorksCertificate"] else "Non") for x in refs["natures"]]
for i, n in enumerate(NAT):
    for j in range(3): wsF.write(49 + i, j, n[j], F_P)
wsF.write("A64", "Modalités des données d'alerte (libellé affiché → code)", F_HS)
wsF.write_row("A65", ["Clé", "Code", "Libellé"], F_H)
MODS = [("restructured", "no", "Non"), ("restructured", "yes", "Oui — créance restructurée"),
        ("legal_exposure", "clear", "Aucun litige"), ("legal_exposure", "watch", "Sous surveillance"), ("legal_exposure", "litigation", "Litige en cours")]
for i, (k_, c_, l_) in enumerate(MODS):
    wsF.write(65 + i, 0, k_, F_P); wsF.write(65 + i, 1, c_, F_P); wsF.write(65 + i, 2, l_, F_P)
wb.define_name("R_ModKey", "=P_Referentiels!$A$66:$A$75"); wb.define_name("R_ModCode", "=P_Referentiels!$B$66:$B$75")
wb.define_name("R_ModLab", "=P_Referentiels!$C$66:$C$75")
MOD_ROWS = {}
for i, (k_, _, _) in enumerate(MODS): MOD_ROWS.setdefault(k_, []).append(66 + i)
wsF.write("A56", "Dispositifs d'aide à l'acquéreur (information)", F_HS)
for i, (c, l) in enumerate([(x["code"], x["label"]) for x in refs["aid"]]):
    wsF.write(56 + i, 0, c, F_P); wsF.write(56 + i, 1, l, F_P)

# ============================================================ Saisie
S0 = 13; SN = 80; SL = S0 + SN - 1
NCRIT = len(crit_keys); CRIT_LAST = S0 + NCRIT - 1
# Unité affichée (et repère d'exemple) des données numériques ; « % » = en points de pourcentage.
UNIT = {"promoter_completed_projects": "nombre de projets (ex. 8)", "promoter_gearing": "% (dettes / fonds propres, ex. 85)",
        "mono_project_concentration": "% (ex. 35)", "equity_injected_ratio": "% (ex. 100)", "progress_vs_plan": "% (ex. 100)",
        "land_cost_ratio": "% (ex. 22)", "authorization_completeness_pct": "%", "equipment_unbudgeted_pct": "% du coût",
        "pre_sale_rate": "% (ex. 62)", "sales_vs_plan": "% (ex. 100)", "dso_days": "jours (ex. 90)", "cash_coverage": "ratio (ex. 1,2)",
        "funding_gap_pct": "% (ex. 0)", "stock_rotation_months": "mois (ex. 16)", "stressed_margin_pct": "% (ex. 18)",
        "secured_sales_rate": "%", "slow_liquidity_share_pct": "% du CA", "cancellation_rate_pct": "%", "gross_margin_pct": "% (ex. 27)",
        "ltc": "% (ex. 61)", "ltv_stressed": "% (ex. 65)", "guarantee_coverage": "% (ex. 125)", "interest_coverage": "ratio (ex. 3,2)",
        "release_quotity_gap_pts": "points", "drawdown_vs_progress_pct": "%", "cost_overrun_pct": "%",
        "dpd_days": "jours", "construction_delay_months": "mois", "project_stopped_months": "mois"}
PCT = {k for k, u in UNIT.items() if u.startswith("%")}
# Lignes des modalités de chaque critère qualitatif dans P_Baremes (listes déroulantes en clair).
BAR_ROWS, OPT_LABEL = {}, {}
for i_, b_ in enumerate(bar):
    if b_[1] == "MODALITE":
        BAR_ROWS.setdefault(b_[0], []).append(5 + i_); OPT_LABEL[(b_[0], b_[5])] = b_[6]
MOD_LABEL = {(k_, c_): l_ for k_, c_, l_ in MODS}
BA_ = "P_Baremes!$A$5:$A$400"; BC_ = "P_Baremes!$C$5:$C$400"; BF_ = "P_Baremes!$F$5:$F$400"
F_STATE = f(font_size=9, bg_color=GREY, border=1)
wsS.set_column("A:A", 24); wsS.set_column("B:B", 30, None, {"hidden": True}); wsS.set_column("C:C", 46)
wsS.set_column("D:D", 8, None, {"hidden": True}); wsS.set_column("E:E", 22); wsS.set_column("F:F", 16)
wsS.set_column("G:G", 16, None, {"hidden": True}); wsS.set_column("H:H", 34); wsS.set_column("I:I", 30)
wsS.write("A1", "Saisie du dossier", F_TITLE)
wsS.write("A2", "Renseignez les cellules jaunes (listes déroulantes en clair). Laissez VIDE une donnée inconnue : elle n'améliore jamais le résultat. La colonne « État » signale ce qui manque.", F_SUB)
lab = [("A4", "Référence dossier"), ("A5", "Nom du projet"), ("A6", "Segment"), ("A7", "Zone"), ("A8", "Classe réglementaire BAM"), ("A9", "Phase du projet (challenger)"), ("A10", "Version du modèle")]
for a_, t in lab: wsS.write(a_, t, F_L)
for a_ in ("C4", "C5", "C6", "C7", "C8", "C9"): wsS.write_blank(a_, None, F_IN)
wsS.write_formula("C10", "=P_Version&\" — \"&P_Date", F_C)
F_CODE = f(font_size=8, font_color="#7F7F7F")
# Segment et zone : libellés en clair dans la liste ; le code (colonne D) alimente le moteur.
wsS.write_formula("D6", '=IF(C6="","",IFERROR(INDEX(P_SegCodes,MATCH(C6,P_SegLabelsAll,0)),C6))', F_CODE)
wsS.write_formula("D7", '=IF(C7="","",IFERROR(INDEX(P_ZoneCodes,MATCH(C7,P_ZoneLabelsAll,0)),C7))', F_CODE)
wsS.data_validation("C6", {"validate": "list", "source": "=P_SegLabels", "ignore_blank": True, "error_type": "warning",
                          "error_title": "Segment", "error_message": "Choisissez un segment dans la liste."})
wsS.data_validation("C7", {"validate": "list", "source": "=P_ZoneLabels", "ignore_blank": True, "error_type": "warning",
                          "error_title": "Zone", "error_message": "Choisissez une zone dans la liste."})
wsS.data_validation("C8", {"validate": "list", "source": "=P_ClsCodes", "ignore_blank": True})
wsS.data_validation("C9", {"validate": "list", "source": "=P_PhaseCodes", "ignore_blank": True})
wsS.write("D8", "", F_C)
wsS.write_formula("E8", '=IFERROR(IF(NOT(ISNUMBER(INDEX(In_Retenue,MATCH("dpd_days",In_Cles,0)))),"",IF(INDEX(In_Retenue,MATCH("dpd_days",In_Cles,0))>=P_DPD3,"COMPROMIS",IF(INDEX(In_Retenue,MATCH("dpd_days",In_Cles,0))>=P_DPD2,"DOUTEUX",IF(INDEX(In_Retenue,MATCH("dpd_days",In_Cles,0))>=P_DPD1,"PRE_DOUTEUX","SAIN")))),"")', F_C)
wsS.write_formula("F8", '=IF(OR(C8="",E8=""),"",IF(MATCH(C8,P_ClsCodes,0)<MATCH(E8,P_ClsCodes,0),"⚠ Moins sévère que le retard","Cohérente avec le retard"))', F_C)
wsS.write_comment("E8", "Classe suggérée par le seul retard de paiement. Les déclencheurs qualitatifs 1/W (art. 5, 12.6, 12.7, restructuration) restent à apprécier.", {"x_scale": 2})
wsS.write_comment("C8", "Classe réglementaire BAM du dossier. Vide = dossier incomplet.", {"x_scale": 1.5})
wsS.write_comment("C9", "Facultatif : sert uniquement au score « challenger » pondéré par phase (indicatif).", {"x_scale": 1.5})
# Résultat en direct (le moteur recalcule à chaque saisie)
wsS.write("H3", "Résultat en direct", F_HS); wsS.write_blank("I3", None, F_HS)
F_PANEL = f(bold=True, bg_color=GREY, border=1)
panel = [("H4", "Score final (0–100)", "I4", "=Res_ScoreFinal", f(bold=True, bg_color=GREY, border=1, num_format="0.00", font_size=12)),
         ("H5", "Décision", "I5", '=IFERROR(VLOOKUP(Res_Decision,P_DecTbl,2,FALSE),Res_Decision)', F_PANEL),
         ("H6", "Classe interne", "I6", "=Res_ClasseInt", F_PANEL),
         ("H7", "Critères renseignés", "I7", f'=SUMPRODUCT((G{S0}:G{CRIT_LAST}<>"")*1)&" / {NCRIT}"', F_PANEL),
         ("H8", "Données décisionnelles manquantes", "I8", f'=COUNTIF(I{S0}:I{SL},"⚠ Manquant*")', F_PANEL),
         ("H9", "Valeurs à vérifier (%)", "I9", f'=COUNTIF(I{S0}:I{SL},"⚠ En %*")+COUNTIF(I{S0}:I{SL},"⚠ Valeur hors*")', F_PANEL)]
for la, lt, va, fm, fmt in panel:
    wsS.write(la, lt, F_C); wsS.write_formula(va, fm, fmt)
wsS.write_url("H10", "internal:Fiche!A1", string="→ Ouvrir la fiche de résultat")
wsS.write_formula("I10", '=IF(Calc_Actif,"","⚠ Calculateurs désactivés")', f(font_color="#9C0006", bold=True))
for code_, fmt_ in (("GO", F_OK), ("GO_WITH_CONDITIONS", f(bg_color="#E2EFDA", font_color="#375623", bold=True)), ("WATCH_LIST", F_WA), ("NO_GO", F_KO), ("DOSSIER_INCOMPLET", F_GR)):
    wsS.conditional_format("I5", {"type": "formula", "criteria": f'=Res_Decision="{code_}"', "format": fmt_})
wsS.conditional_format("I8:I9", {"type": "cell", "criteria": ">", "value": 0, "format": F_KO})
wsS.write_row("A12", ["Section", "Clé technique", "Donnée", "Type", "Votre saisie", "Calculé (Calculateurs)", "Valeur utilisée", "Unité / aide", "État"], F_H)
decisional = lambda r: f'OR(COUNTIFS(P_Criteres!$F$5:$F$64,B{r},P_Criteres!$G$5:$G$64,"Oui")>0,COUNTIFS(P_Criteres!$F$5:$F$64,B{r},P_Criteres!$K$5:$K$64,"Oui")>0,B{r}=P_ExtraKey)'
for i in range(SN):
    r = S0 + i
    if i < NK:
        sec, k, lb, t = KEYS[i]
        wsS.write(f"A{r}", sec, F_C); wsS.write(f"B{r}", k, F_C); wsS.write(f"C{r}", lb, F_C); wsS.write(f"D{r}", t, F_C)
        wsS.write_blank(f"E{r}", None, F_IN)
        if k not in DERIVED: wsS.write_blank(f"F{r}", None, F_C)
        c = crit_by_key.get(k)
        hors_liste = None
        if t == "BOOL":
            g = f'=IF(E{r}<>"",IF(E{r}="Oui",TRUE,IF(E{r}="Non",FALSE,"")),IF(F{r}="","",IF(F{r}="Oui",TRUE,IF(F{r}="Non",FALSE,""))))'
            h = "Oui / Non"
            wsS.data_validation(f"E{r}", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True,
                                          "error_title": lb[:31], "error_message": "Choisissez Oui ou Non (ou laissez vide si inconnu)."})
        elif t == "QUAL" and c is not None:
            rows_ = BAR_ROWS[c[1]]
            g = (f'=IF(E{r}<>"",IF(SUMPRODUCT(({BA_}="{c[1]}")*({BF_}=E{r}))>0,'
                 f'INDEX({BC_},SUMPRODUCT(MAX(({BA_}="{c[1]}")*({BF_}=E{r})*(ROW({BA_})-4)))),E{r}),IF(F{r}="","",F{r}))')
            h = "choisir dans la liste"
            wsS.data_validation(f"E{r}", {"validate": "list", "source": f"=P_Baremes!$F${rows_[0]}:$F${rows_[-1]}", "ignore_blank": True,
                                          "error_type": "warning", "error_title": lb[:31], "error_message": "Choisissez une valeur dans la liste."})
            hors_liste = f'AND(E{r}<>"",COUNTIFS({BA_},"{c[1]}",{BC_},G{r})=0)'
        elif t == "QUAL":
            rows_ = MOD_ROWS[k]
            g = (f'=IF(E{r}<>"",IF(SUMPRODUCT((R_ModKey="{k}")*(R_ModLab=E{r}))>0,'
                 f'INDEX(R_ModCode,SUMPRODUCT(MAX((R_ModKey="{k}")*(R_ModLab=E{r})*(ROW(R_ModKey)-65)))),E{r}),IF(F{r}="","",F{r}))')
            h = "choisir dans la liste"
            wsS.data_validation(f"E{r}", {"validate": "list", "source": f"=P_Referentiels!$C${rows_[0]}:$C${rows_[-1]}", "ignore_blank": True,
                                          "error_type": "warning", "error_title": lb[:31], "error_message": "Choisissez une valeur dans la liste."})
            hors_liste = f'AND(E{r}<>"",COUNTIFS(R_ModKey,"{k}",R_ModCode,G{r})=0)'
        else:
            g = f'=IF(E{r}<>"",E{r},IF(F{r}="","",F{r}))'
            h = UNIT.get(k, "nombre")
            wsS.data_validation(f"E{r}", {"validate": "decimal", "criteria": "between", "minimum": -1e12, "maximum": 1e12, "ignore_blank": True,
                                          "error_title": lb[:31], "error_message": "Saisissez un nombre (ex. 62 pour 62 %), ou laissez vide si inconnu."})
        wsS.write_formula(f"G{r}", g, F_C)
        if k in DERIVED: h += " — calculé par l'onglet Calculateurs ; votre saisie prime"
        wsS.write(f"H{r}", h, f(font_size=9, font_color="#595959"))
        pct = "TRUE" if k in PCT else "FALSE"
        state = (f'=IF({pct}*ISNUMBER(G{r})*(N(G{r})>0)*(N(G{r})<1),"⚠ En % : saisir 62 pour 62 %",'
                 + (f'IF({hors_liste},"⚠ Valeur hors liste",' if hors_liste else "")
                 + f'IF(G{r}<>"","✔ Renseigné",IF({decisional(r)},"⚠ Manquant — décisionnel","○ Non renseigné")))'
                 + (")" if hors_liste else ""))
        wsS.write_formula(f"I{r}", state, F_STATE)
    else:
        for c_ in "ABCDFHI": wsS.write_blank(f"{c_}{r}", None, F_C)
        wsS.write_blank(f"E{r}", None, F_IN)
        wsS.write_formula(f"G{r}", f'=IF(E{r}<>"",E{r},IF(F{r}="","",F{r}))', F_C)
wsS.conditional_format(f"I{S0}:I{SL}", {"type": "text", "criteria": "begins with", "value": "⚠ Manquant", "format": F_KO})
wsS.conditional_format(f"I{S0}:I{SL}", {"type": "text", "criteria": "begins with", "value": "⚠", "format": F_WA})
wsS.conditional_format(f"I{S0}:I{SL}", {"type": "text", "criteria": "begins with", "value": "✔", "format": f(font_color="#006100", bg_color="#E2EFDA")})
wb.define_name("In_Cles", f"=Saisie!$B${S0}:$B${SL}"); wb.define_name("In_Saisie", f"=Saisie!$E${S0}:$E${SL}")
wb.define_name("In_Calc", f"=Saisie!$F${S0}:$F${SL}"); wb.define_name("In_Retenue", f"=Saisie!$G${S0}:$G${SL}")
wb.define_name("In_Etat", f"=Saisie!$I${S0}:$I${SL}")
SROW = {k: S0 + i for i, (_, k, _, _) in enumerate(KEYS)}
wsS.freeze_panes(12, 3)
# Dossier d'exemple (cas de référence T06 : trésorerie tendue → alerte et décision
# sous conditions). À remplacer : ruban « Scoring PI » › Nouveau dossier.
EXEMPLE = next(v for v in vec if v["id"] == "T06")
for a_, v in (("C4", "EXEMPLE"), ("C5", "Dossier d'exemple — à remplacer (ruban « Scoring PI » › Nouveau dossier)"),
              ("C6", seglab["moyen_haut"]), ("C7", zonelab["casa_centre"]), ("C8", "SAIN"), ("C9", "CONSTRUCTION")):
    wsS.write(a_, v, F_IN)
def display_value(k, v):
    """Valeur saisie telle qu'affichée : libellé en clair pour les listes, Oui/Non pour les booléens."""
    if isinstance(v, bool): return "Oui" if v else "Non"
    c = crit_by_key.get(k)
    if c is not None and c[3] == "QUAL": return OPT_LABEL.get((c[1], v), v)
    return MOD_LABEL.get((k, v), v)
for k, r in SROW.items():
    v = EXEMPLE["inputs"].get(k)
    if v is None: continue
    wsS.write(f"E{r}", display_value(k, v), F_IN)
wsS.protect("", {"format_columns": True, "format_rows": True, "insert_hyperlinks": False})

# ============================================================ Calculateurs
wsC.set_column("A:A", 30); wsC.set_column("B:B", 50); wsC.set_column("C:H", 15)
wsC.write("A1", "Calculateurs — alimentent automatiquement les données dérivées (Saisie, colonne « Valeur calculée »)", F_TITLE)
wsC.write("A2", "Une valeur saisie directement dans l'onglet Saisie prime toujours sur ces calculs.", F_SUB)
# --- A autorisations
wsC.write("A4", "A. Chaîne d'autorisations", F_HS)
wsC.write("A5", "Nature du programme", F_L); wsC.write("B5", "CONSTRUCTION", F_IN)
wsC.data_validation("B5", {"validate": "list", "source": ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"]})
wsC.write_row("A7", ["Code", "Pièce", "Exigible", "Obtenue", "Bloque travaux", "Bloque livraison", "Manquante"], F_H)
for i in range(24):
    r = 8 + i; s = 6 + i
    wsC.write_formula(f"A{r}", f'=IF(P_Referentiels!A{s}="","",P_Referentiels!A{s})', F_C)
    wsC.write_formula(f"B{r}", f'=IF(A{r}="","",P_Referentiels!B{s})', F_C)
    wsC.write_formula(f"C{r}", f'=IF(A{r}="",FALSE,IF($B$5="LOTISSEMENT",P_Referentiels!D{s},IF($B$5="CONSTRUCTION",P_Referentiels!E{s},P_Referentiels!F{s}))="Oui")', F_C)
    wsC.write_blank(f"D{r}", None, F_IN)
    wsC.write_formula(f"E{r}", f'=IF(A{r}="",FALSE,P_Referentiels!G{s}="Oui")', F_C)
    wsC.write_formula(f"F{r}", f'=IF(A{r}="",FALSE,P_Referentiels!H{s}="Oui")', F_C)
    wsC.write_formula(f"G{r}", f'=AND(C{r},D{r}<>"Oui")', F_C)
wsC.data_validation("D8:D31", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})
wsC.write("A33", "Complétude de la chaîne (%)", F_L)
wsC.write_formula("C33", '=IF(SUMPRODUCT((C8:C31=TRUE)*1)=0,100,ROUND(SUMPRODUCT((C8:C31=TRUE)*(D8:D31="Oui"))/SUMPRODUCT((C8:C31=TRUE)*1)*100,2))', F_CN)
wsC.write("A34", "Verrou de travaux (pièce indispensable manquante)", F_L)
wsC.write_formula("C34", '=SUMPRODUCT((G8:G31=TRUE)*(E8:E31=TRUE))>0', F_C)
wsC.write("A35", "Saisie de la chaîne effectuée ?", F_L)
wsC.write_formula("C35", '=COUNTIF(D8:D31,"Oui")+COUNTIF(D8:D31,"Non")>0', F_C)
# --- B ventes sécurisées
wsC.write("A38", "B. Ventes sécurisées (financement de l'acquéreur)", F_HS)
wsC.write("A39", "Valeur commercialisable totale (MAD)", F_L); wsC.write_blank("C39", None, F_IN)
wsC.write("D39", "vide = somme des prix des lots ci-dessous", f(font_size=8, italic=True))
wsC.write_row("A41", ["Lot", "Statut de financement acquéreur", "Prix (MAD)", "Engagé juridiquement", "Facteur", "Renseigné", "À risque"], F_H)
for i in range(40):
    r = 42 + i
    wsC.write_blank(f"A{r}", None, F_IN); wsC.write_blank(f"B{r}", None, F_IN); wsC.write_blank(f"C{r}", None, F_IN); wsC.write_blank(f"D{r}", None, F_IN)
    wsC.write_formula(f"E{r}", f'=IF(B{r}="",0,IFERROR(VLOOKUP(B{r},R_FinTbl,3,FALSE),0.2))', F_CN)
    wsC.write_formula(f"F{r}", f'=B{r}<>""', F_C)
    wsC.write_formula(f"G{r}", f'=AND(B{r}<>"",D{r}<>"Non",E{r}<=0.4)', F_C)
wsC.data_validation("B42:B81", {"validate": "list", "source": "=R_FinCodes", "ignore_blank": True})
wsC.data_validation("D42:D81", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})
wsC.write("A83", "Chiffre d'affaires engagé (MAD)", F_L); wsC.write_formula("C83", '=SUMPRODUCT((F42:F81=TRUE)*(D42:D81<>"Non")*C42:C81)', f(bg_color=GREY, border=1, num_format="#,##0"))
wsC.write("A84", "Chiffre d'affaires sécurisé (MAD)", F_L); wsC.write_formula("C84", '=SUMPRODUCT((F42:F81=TRUE)*(D42:D81<>"Non")*C42:C81*E42:E81)', f(bg_color=GREY, border=1, num_format="#,##0"))
wsC.write("A85", "Taux de ventes sécurisées (%)", F_L)
wsC.write_formula("C85", '=IF(SUMPRODUCT((F42:F81=TRUE)*1)=0,"",IF(IF(C39="",SUM(C42:C81),C39)>0,ROUND(C84/IF(C39="",SUM(C42:C81),C39)*100,2),""))', F_CN)
wsC.write("A86", "Financement acquéreurs à risque (≥ 40 % des lots renseignés)", F_L)
wsC.write_formula("C86", '=IF(SUMPRODUCT((F42:F81=TRUE)*1)=0,"",AND(C83>0,SUMPRODUCT((G42:G81=TRUE)*1)/SUMPRODUCT((F42:F81=TRUE)*1)>=0.4))', F_C)
# --- C mainlevée
wsC.write("A89", "C. Mainlevée partielle et prix de désengagement", F_HS)
wsC.write("A90", "Quotité de désengagement convenue (%)", F_L); wsC.write_blank("C90", None, F_IN)
wsC.write("A91", "Encours de crédit adossé au programme (MAD)", F_L); wsC.write_blank("C91", None, F_IN)
wsC.write("A92", "Valeur commercialisable totale (MAD)", F_L); wsC.write_blank("C92", None, F_IN)
wsC.write("A93", "Quotité d'équilibre (%) = encours / valeur", F_L)
wsC.write_formula("C93", '=IF(AND(ISNUMBER(C91),ISNUMBER(C92)),IF(C92>0,ROUND(C91/C92*100,2),""),"")', F_CN)
wsC.write("A94", "Écart quotité appliquée − équilibre (points)", F_L)
wsC.write_formula("C94", '=IF(AND(ISNUMBER(C90),ISNUMBER(C91),ISNUMBER(C92)),IF(AND(C91>0,C92>0),ROUND(C90-C91/C92*100,2),""),"")', F_CN)
wsC.write("A95", "Quotité sous-tarifée ?", F_L); wsC.write_formula("C95", '=IF(C94="","",C94<0)', F_C)
wsC.write("A96", "Quotité recommandée (équilibre + 10 %)", F_L)
wsC.write_formula("C96", '=IF(C93="","",ROUND(MIN(100,C93*1.1),2))', F_CN)
# --- D division des risques
wsC.write("A99", "D. Division des risques", F_HS)
wsC.write("A100", "Fonds propres prudentiels de l'établissement (MAD)", F_L); wsC.write_blank("C100", None, F_IN)
wsC.write("A101", "Limite par contrepartie / groupe (% des fonds propres)", F_L); wsC.write("C101", 20, F_INN)
wsC.write("A102", "Seuil « grand risque » (% des fonds propres)", F_L); wsC.write("C102", 5, F_INN)
wsC.write_row("A104", ["Concours", "", "Encours tiré (MAD)", "Non tiré (MAD)", "CCF (0–1)", "Exposition"], F_H)
for i in range(10):
    r = 105 + i
    wsC.write_blank(f"A{r}", None, F_IN); wsC.write_blank(f"C{r}", None, F_IN); wsC.write_blank(f"D{r}", None, F_IN); wsC.write_blank(f"E{r}", None, F_IN)
    wsC.write_blank(f"B{r}", None, f(locked=False))
    wsC.write_formula(f"F{r}", f'=MAX(0,N(C{r}))+MAX(0,N(D{r}))*IF(E{r}="",1,MIN(1,MAX(0,E{r})))', f(bg_color=GREY, border=1, num_format="#,##0"))
wsC.write("A116", "Exposition agrégée (MAD)", F_L); wsC.write_formula("C116", "=SUM(F105:F114)", f(bg_color=GREY, border=1, num_format="#,##0"))
wsC.write("A117", "Limite (MAD)", F_L); wsC.write_formula("C117", '=IF(ISNUMBER(C100),ROUND(C100*C101/100,2),"")', f(bg_color=GREY, border=1, num_format="#,##0"))
wsC.write("A118", "Ratio exposition / fonds propres (%)", F_L); wsC.write_formula("C118", '=IF(AND(ISNUMBER(C100),N(C100)>0),ROUND(C116/C100*100,2),"")', F_CN)
wsC.write("A119", "Marge disponible avant limite (MAD)", F_L); wsC.write_formula("C119", '=IF(C117="","",MAX(0,C117-C116))', f(bg_color=GREY, border=1, num_format="#,##0"))
wsC.write("A120", "Limite dépassée ?", F_L); wsC.write_formula("C120", '=IF(AND(ISNUMBER(C100),N(C100)>0),C116>C117,"")', F_C)
wsC.write("A121", "Grand risque ?", F_L); wsC.write_formula("C121", '=IF(AND(ISNUMBER(C100),N(C100)>0),C116>=C100*C102/100,"")', F_C)
# --- E arrêt de chantier (même règle que le journal d'événements de l'application)
wsC.write("A124", "E. Arrêt de chantier", F_HS)
wsC.write("A125", "Date de début de l'arrêt en cours", F_L); wsC.write_blank("C125", None, f(bg_color="#FFF2CC", border=1, num_format="dd/mm/yyyy", locked=False))
wsC.write("A126", "Date de reprise effective (vide si toujours à l'arrêt)", F_L); wsC.write_blank("C126", None, f(bg_color="#FFF2CC", border=1, num_format="dd/mm/yyyy", locked=False))
wsC.write("A127", "Date d'évaluation (vide = aujourd'hui)", F_L); wsC.write_blank("C127", None, f(bg_color="#FFF2CC", border=1, num_format="dd/mm/yyyy", locked=False))
wsC.write("A128", "Durée de l'arrêt en cours (mois)", F_L)
wsC.write_formula("C128", '=IF(OR(NOT(ISNUMBER(C125)),ISNUMBER(C126)),"",MAX(0,INT((IF(ISNUMBER(C127),C127,TODAY())-C125)/30.4375)))', F_CN)
wsC.write("D128", "≥ 12 mois : alerte bloquante « projet à l'arrêt » (souffrance automatique). Un arrêt terminé n'alimente plus la donnée.", f(font_size=8, italic=True))
# --- F à H : modèle v5 (mêmes règles que lib/domain/programmeV5.ts)
NOTE = f(font_size=8, italic=True)
F_DATE = f(bg_color="#FFF2CC", border=1, num_format="dd/mm/yyyy", locked=False)
F_MAD = f(bg_color=GREY, border=1, num_format="#,##0")
wsC.write("A131", "F. Déblocages selon l'avancement et le calendrier (v5)", F_HS)
wsC.write("A132", "Montant autorisé des crédits de travaux (MAD)", F_L); wsC.write_blank("C132", None, F_IN)
wsC.write("A133", "Cumul débloqué sur ces crédits (MAD)", F_L); wsC.write_blank("C133", None, F_IN)
wsC.write("A134", "Avancement certifié (%) — situation visée, sinon tranches, sinon visite", F_L); wsC.write_blank("C134", None, F_IN)
wsC.write("A135", "Déblocages vs avancement certifié (%)", F_L)
wsC.write_formula("C135", '=IF(AND(ISNUMBER(C132),ISNUMBER(C133),ISNUMBER(C134)),IF(N(C132)<=0,"",IF(C133<=0,0,IF(C132*C134/100<=0,999,MIN(999,ROUND(C133/(C132*C134/100)*100,2))))),"")', F_CN)
wsC.write("A136", "Tirages en avance sur les travaux ? (≥ 115 %)", F_L); wsC.write_formula("C136", '=IF(C135="","",C135>=115)', F_C)
wsC.write("A138", "Date d'évaluation du plan de tirage (vide = aujourd'hui)", F_L); wsC.write_blank("C138", None, F_DATE)
wsC.write_row("A139", ["Jalon du plan de tirage", "Date prévue", "Montant prévu (MAD)", "Débloqué (MAD)", "Prévu échu", "Débloqué retenu"], F_H)
for i in range(12):
    r = 140 + i
    wsC.write_blank(f"A{r}", None, F_IN); wsC.write_blank(f"B{r}", None, F_DATE); wsC.write_blank(f"C{r}", None, F_IN); wsC.write_blank(f"D{r}", None, F_IN)
    wsC.write_formula(f"E{r}", f'=IF(AND(ISNUMBER(B{r}),B{r}<=IF(ISNUMBER($C$138),$C$138,TODAY())),N(C{r}),0)', F_MAD)
    wsC.write_formula(f"F{r}", f'=IF(AND(ISNUMBER(B{r}),B{r}<=IF(ISNUMBER($C$138),$C$138,TODAY())),MIN(N(D{r}),N(C{r})),0)', F_MAD)
wsC.write("A153", "Montant prévu non débloqué à date (%)", F_L)
wsC.write_formula("C153", '=IF(SUM(E140:E151)<=0,"",ROUND((SUM(E140:E151)-SUM(F140:F151))/SUM(E140:E151)*100,2))', F_CN)
wsC.write("A154", "Plan de tirage en retard ? (≥ 25 %)", F_L); wsC.write_formula("C154", '=IF(C153="","",C153>=25)', F_C)

wsC.write("A157", "G. Équipements exigés (mosquée, école, voirie…) (v5)", F_HS)
wsC.write("A158", "Obligations déclarées", F_L); wsC.write_blank("C158", None, F_IN)
wsC.data_validation("C158", {"validate": "list", "source": ["Liste ci-dessous", "Aucun équipement exigé"], "ignore_blank": True})
wsC.write("D158", "vide = non déclarées : donnée absente (note plancher)", NOTE)
wsC.write("A159", "Coût total du programme (MAD)", F_L); wsC.write_blank("C159", None, F_IN)
wsC.write("A160", "Avancement du programme (%)", F_L); wsC.write_blank("C160", None, F_IN)
wsC.write("A161", "Date d'évaluation (vide = aujourd'hui)", F_L); wsC.write_blank("C161", None, F_DATE)
wsC.write_row("A163", ["Équipement", "Coût estimé (MAD)", "Financé par", "Budgété", "Conditionne la réception", "Échéance", "Avancement (%)", "Remis", "Non budgété", "Coût manquant", "En retard"], F_H)
for i in range(8):
    r = 164 + i
    for c in "ABCDEGH": wsC.write_blank(f"{c}{r}", None, F_IN)
    wsC.write_blank(f"F{r}", None, F_DATE)
    wsC.write_formula(f"I{r}", f'=IF(AND(A{r}<>"",C{r}<>"commune",D{r}<>"Oui"),MAX(0,N(B{r})),0)', F_MAD)
    wsC.write_formula(f"J{r}", f'=AND(A{r}<>"",C{r}<>"commune",D{r}<>"Oui",NOT(ISNUMBER(B{r})))', F_C)
    wsC.write_formula(f"K{r}", f'=AND(A{r}<>"",E{r}="Oui",H{r}<>"Oui",OR(AND(ISNUMBER(F{r}),F{r}<IF(ISNUMBER($C$161),$C$161,TODAY()),N(G{r})<100),AND(ISNUMBER($C$160),$C$160-N(G{r})>30)))', F_C)
wsC.data_validation("C164:C171", {"validate": "list", "source": ["promoteur", "banque", "commune", "autre"], "ignore_blank": True})
wsC.data_validation("D164:E171", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})
wsC.data_validation("H164:H171", {"validate": "list", "source": ["Oui", "Non"], "ignore_blank": True})
wsC.write("A173", "Équipements non budgétés à la charge du programme (% du coût)", F_L)
wsC.write_formula("C173", '=IF(COUNTIF(A164:A171,"?*")=0,IF(C158="","",0),IF(OR(NOT(ISNUMBER(C159)),N(C159)<=0,SUMPRODUCT((J164:J171=TRUE)*1)>0),"",ROUND(SUM(I164:I171)/C159*100,2)))', F_CN)
wsC.write("A174", "Équipement conditionnant la réception en retard ?", F_L)
wsC.write_formula("C174", '=IF(COUNTIF(A164:A171,"?*")=0,IF(C158="","",FALSE),SUMPRODUCT((K164:K171=TRUE)*1)>0)', F_C)
wsC.write("D174", "en retard : échéance passée avant achèvement, ou retard de plus de 30 points sur le programme", NOTE)

wsC.write("A177", "H. Programme mixte, désistements et coût à terminaison (v5)", F_HS)
wsC.write("A178", "CA résidentiel : appartements, villas, terrains (MAD)", F_L); wsC.write_blank("C178", None, F_IN)
wsC.write("A179", "CA commerces et bureaux (MAD)", F_L); wsC.write_blank("C179", None, F_IN)
wsC.write("A180", "CA hôtelier (MAD)", F_L); wsC.write_blank("C180", None, F_IN)
wsC.write("A181", "Part du CA à écoulement lent (%)", F_L)
wsC.write_formula("C181", '=IF(N(C178)+N(C179)+N(C180)>0,ROUND(ROUND(N(C179)/(N(C178)+N(C179)+N(C180))*100,2)+ROUND(N(C180)/(N(C178)+N(C179)+N(C180))*100,2),2),"")', F_CN)
wsC.write("A183", "Lots engagés : réservés, compromis, vendus, livrés", F_L); wsC.write_blank("C183", None, F_IN)
wsC.write("A184", "Lots désistés", F_L); wsC.write_blank("C184", None, F_IN)
wsC.write("A185", "Taux de désistement (%)", F_L)
wsC.write_formula("C185", '=IF(N(C183)+N(C184)>0,ROUND(N(C184)/(N(C183)+N(C184))*100,2),"")', F_CN)
wsC.write("A187", "Coût du budget initial (MAD)", F_L); wsC.write_blank("C187", None, F_IN)
wsC.write("A188", "Coût à terminaison estimé (MAD)", F_L); wsC.write_blank("C188", None, F_IN)
wsC.write("A189", "Dépassement du coût à terminaison (%)", F_L)
wsC.write_formula("C189", '=IF(AND(ISNUMBER(C187),ISNUMBER(C188),N(C187)>0),ROUND((C188-C187)/C187*100,2),"")', F_CN)
wsC.write("A190", "Périmètre : si la banque ne finance qu'une tranche, saisir ici les chiffres de cette seule tranche.", NOTE)
wsC.set_column("I:K", 13)
wsC.protect("", {"format_columns": True, "format_rows": True})
# Plages de saisie des calculateurs (vidées par la macro NouveauDossier ;
# les paramètres de l'établissement — fonds propres, limites — sont conservés).
for nm, ref_ in [("Calc_Auth", "$D$8:$D$31"), ("Calc_Valeur", "$C$39"), ("Calc_Lots", "$A$42:$D$81"),
                 ("Calc_Mainlevee", "$C$90:$C$92"), ("Calc_Concours", "$A$105:$E$114"), ("Calc_Arret", "$C$125:$C$127"),
                 ("Calc_Tirage", "$C$132:$C$134"), ("Calc_Plan", "$A$140:$D$151"), ("Calc_PlanDate", "$C$138"),
                 ("Calc_EquipParam", "$C$158:$C$161"), ("Calc_Equip", "$A$164:$H$171"), ("Calc_Mixte", "$C$178:$C$180"),
                 ("Calc_Desist", "$C$183:$C$184"), ("Calc_Cout", "$C$187:$C$188")]:
    wb.define_name(nm, f"=Calculateurs!{ref_}")
# ---- branchement des valeurs dérivées dans Saisie!F
def setF(key, formula):
    # Calc_Actif = FAUX pendant les traitements de masse : aucune valeur du dossier courant ne fuit.
    wsS.write_formula(f"F{SROW[key]}", f'=IF(Calc_Actif,{formula[1:]},"")', F_C)
setF("authorization_completeness_pct", '=IF(Calculateurs!C35,Calculateurs!C33,"")')
setF("works_authorization_blocked", '=IF(Calculateurs!C35,IF(Calculateurs!C34,"Oui","Non"),"")')
setF("secured_sales_rate", '=Calculateurs!C85')
setF("buyers_financing_at_risk", '=IF(Calculateurs!C86="","",IF(Calculateurs!C86,"Oui","Non"))')
setF("release_quotity_gap_pts", '=Calculateurs!C94')
setF("release_underpriced", '=IF(Calculateurs!C95="","",IF(Calculateurs!C95,"Oui","Non"))')
setF("division_limit_breach", '=IF(Calculateurs!C120="","",IF(Calculateurs!C120,"Oui","Non"))')
setF("project_stopped_months", '=Calculateurs!C128')
setF("drawdown_vs_progress_pct", '=Calculateurs!C135')
setF("drawdown_ahead_of_works", '=IF(Calculateurs!C136="","",IF(Calculateurs!C136,"Oui","Non"))')
setF("drawdown_schedule_late", '=IF(Calculateurs!C154="","",IF(Calculateurs!C154,"Oui","Non"))')
setF("equipment_unbudgeted_pct", '=Calculateurs!C173')
setF("equipment_delivery_at_risk", '=IF(Calculateurs!C174="","",IF(Calculateurs!C174,"Oui","Non"))')
setF("slow_liquidity_share_pct", '=Calculateurs!C181')
setF("cancellation_rate_pct", '=Calculateurs!C185')
setF("cost_overrun_pct", '=Calculateurs!C189')

# ============================================================ Resultat (MOTEUR)
DOM_H, DOM1, DOMN = 31, 32, 39
SEED = 43; CR1 = 44; CRN = CR1 + NCR - 1          # 44..103
AL_H = 107; AL1 = 108; ALN = AL1 + NAL - 1        # 108..137
wsR.hide_gridlines(2)
wsR.set_column("A:A", 30); wsR.set_column("B:B", 36); wsR.set_column("C:C", 48); wsR.set_column("D:D", 26)
wsR.set_column("E:E", 14); wsR.set_column("F:S", 12); wsR.set_column("G:G", 40)
wsR.write("A1", "Résultat du scoring", F_TITLE)
wsR.write_formula("A2", '="Modèle "&P_Version&" — "&Saisie!C4&" "&Saisie!C5', F_SUB)
summ = [
 (6, "Score final (0–100)", '=IF(E28,0,ROUND(MIN(100,MAX(0,C13*C14)),2))', F_BIG),
 (7, "Décision", '=IF(E28,"NO_GO",IF(E21,"NO_GO",IF(E22,"NO_GO",IF(E23,"DOSSIER_INCOMPLET",IF(E20,"NO_GO",IF(C6>=P_GO,"GO",IF(C6>=P_GWC,"GO_WITH_CONDITIONS",IF(C6>=P_WATCH,"WATCH_LIST","NO_GO"))))))))', F_BIGT),
 (8, "Classe interne", '=IF(E28,"Souffrance",IF(E21,"Souffrance",IF(E22,"Défaut avéré",IF(E23,"Dossier incomplet",IF(C6>=P_GO,"Sain",IF(C6>=P_GWC,"Surveillance",IF(C6>=P_WATCH,"Sensible probable","Sensible")))))))', F_BIGT),
 (9, "PD proxy (indicative, non calibrée)", '=IF(E23,"n/d",ROUND(1/(1+EXP(-(P_PDa-P_PDb*C6))),4))', F_CP),
 (10, "Score économique S_éco (avant ajustement)", '=IF(SUM(D32:D39)=0,0,ROUND(SUM(E32:E39)/SUM(D32:D39),2))', F_CN),
 (11, "Score ajusté S_adj = S_éco×(1+α+β)", '=ROUND(MIN(100,MAX(0,C10*(1+C17+C18))),2)', F_CN),
 (12, "Malus cumulés D5 (points)", f'=SUM(J{AL1}:J{ALN})', F_CN),
 (13, "Score après pénalités", '=ROUND(MIN(100,MAX(0,C11-C12)),2)', F_CN),
 (14, "Coefficient réglementaire BAM", '=IF(Saisie!C8="",1,IFERROR(VLOOKUP(Saisie!C8,P_Classes,5,FALSE),1))', F_CN),
 (15, "Note économique (capacité de remboursement)", f'=IFERROR(ROUND(SUMPRODUCT($Q${CR1}:$Q${CRN}*($N${CR1}:$N${CRN}<>"GUARANTEE")*$F${CR1}:$F${CRN})/SUMPRODUCT($Q${CR1}:$Q${CRN}*($N${CR1}:$N${CRN}<>"GUARANTEE"))/P_Scale*100,2),C10)', F_CN),
 (16, "Note de sûretés (perte en cas de défaut)", f'=IFERROR(ROUND(SUMPRODUCT($Q${CR1}:$Q${CRN}*($N${CR1}:$N${CRN}="GUARANTEE")*$F${CR1}:$F${CRN})/SUMPRODUCT($Q${CR1}:$Q${CRN}*($N${CR1}:$N${CRN}="GUARANTEE"))/P_Scale*100,2),"n/a")', F_CN),
 (17, "α segment", '=IF(Saisie!$D$6="",0,IFERROR(VLOOKUP(Saisie!$D$6,P_SegTbl,3,FALSE),0))', F_CP),
 (18, "β zone", '=IF(Saisie!$D$7="",0,IFERROR(VLOOKUP(Saisie!$D$7,P_ZoneTbl,3,FALSE),0))', F_CP),
 (19, "Segment / zone hors référentiel", '=IF(E19,"Oui — à signaler","Non")', F_C),
 (20, "Critère éliminatoire (gate) franchi", '=IF(E20,"Oui","Non")', F_C),
 (21, "Alerte bloquante (souffrance automatique)", '=IF(E21,"Oui","Non")', F_C),
 (22, "Défaut avéré (classe réglementaire)", '=IF(E22,"Oui","Non")', F_C),
 (23, "Dossier incomplet (donnée décisionnelle absente)", '=IF(E23,"Oui","Non")', F_C),
 (24, "Données décisionnelles manquantes", f'=IF(C6=C6,O{ALN},"")', F_C),
 (25, "Conditions (critères éliminatoires franchis)", f'=S{CRN}', F_C),
 (26, "Alertes déclenchées / non exclues", f'=N{ALN}', F_C),
 (27, "Retour en comité requis", '=IF(E27,"Oui","Non")', F_C),
 (28, "Classe bloquante (contentieux)", '=IF(E28,"Oui","Non")', F_C),
]
F_CW = f(bg_color=GREY, border=1, text_wrap=True, valign="top")
for r, lab_, fm, fmt in summ:
    wsR.write(f"A{r}", lab_, F_L); wsR.write_formula(f"C{r}", fm, F_CW if r in (24, 25, 26) else fmt)
for r in (24, 25, 26): wsR.set_row(r - 1, 32)
wsR.set_row(5, 30); wsR.set_row(6, 24); wsR.set_row(7, 24)
raw = {
 19: '=OR(AND(Saisie!$D$6<>"",ISNA(MATCH(Saisie!$D$6,P_SegCodes,0))),AND(Saisie!$D$7<>"",ISNA(MATCH(Saisie!$D$7,P_ZoneCodes,0))))',
 20: f'=OR(I{CR1}:I{CRN})',
 21: f'=SUMPRODUCT((C{AL1}:C{ALN}="BLOCKING")*(H{AL1}:H{ALN}=TRUE))>0',
 22: '=OR(IFERROR(VLOOKUP(Saisie!C8,P_Classes,3,FALSE)="Oui",FALSE),Saisie!C8="CTX")',
 23: f'=OR(Saisie!C8="",J{SEED},SUMPRODUCT((J{CR1}:J{CRN}=TRUE)*1)>0,SUMPRODUCT((L{AL1}:L{ALN}=TRUE)*1)>0)',
 27: f'=OR(K{AL1}:K{ALN})',
 28: '=OR(IFERROR(VLOOKUP(Saisie!C8,P_Classes,4,FALSE)="Oui",FALSE),Saisie!C8="CTX")',
}
wsR.write("E5", "(interne)", F_RAW)
for r, fm in raw.items(): wsR.write_formula(f"E{r}", fm, F_RAW)
# challenger
wsR.write("F5", "Challengers (indicatifs — score officiel inchangé)", F_HS); wsR.write("G5", "", F_HS)
ch = [(6, "Phase du projet", '=IF(Saisie!C9="","(non renseignée)",Saisie!C9)'),
      (7, "Score éco. avec pondération de phase", '=IF(Saisie!C9="","",IF(SUM(F32:F39)=0,"",ROUND(SUM(G32:G39)/SUM(F32:F39),2)))'),
      (8, "Écart vs score éco. officiel", '=IF(H7="","",ROUND(H7-C10,2))'),
      (9, "Score ajusté sans coefficients territoriaux", '=ROUND(MIN(100,MAX(0,C10)),2)'),
      (10, "Effet des coefficients segment / zone", '=ROUND(C11-H9,2)')]
for r, lab_, fm in ch:
    wsR.write(f"F{r}", lab_, F_C); wsR.write_formula(f"H{r}", fm, F_C)
wsR.set_column("H:H", 22)
# domaines
wsR.write("A30", "Scores par domaine", F_HS)
wsR.write_row(f"A{DOM_H}", ["Code", "Domaine", "Score /100", "Poids", "Contribution", "Poids phase", "Contribution phase"], F_H)
for i in range(8):
    r = DOM1 + i; d = 16 + i
    wsR.write_formula(f"A{r}", f'=IF(P_General!A{d}="","",P_General!A{d})', F_C)
    wsR.write_formula(f"B{r}", f'=IF($A{r}="","",P_General!B{d})', F_C)
    wsR.write_formula(f"C{r}", f'=IF($A{r}="",0,IF(SUMIF($B${CR1}:$B${CRN},$A{r},$G${CR1}:$G${CRN})>0,ROUND(SUMIF($B${CR1}:$B${CRN},$A{r},$H${CR1}:$H${CRN})/SUMIF($B${CR1}:$B${CRN},$A{r},$G${CR1}:$G${CRN})/P_Scale*100,2),0))', F_CN)
    wsR.write_formula(f"D{r}", f'=IF($A{r}="",0,P_General!C{d})', F_CN)
    wsR.write_formula(f"E{r}", f'=IF($A{r}="",0,ROUND(C{r}*D{r},2))', F_CN)
    wsR.write_formula(f"F{r}", f'=IF($A{r}="",0,IFERROR(INDEX(P_PhaseTbl,MATCH(Saisie!$C$9,P_PhaseCodes,0),MATCH($A{r},P_PhaseHdr,0)+1),0))', F_CN)
    wsR.write_formula(f"G{r}", f'=ROUND(C{r}*F{r},2)', F_CN)
# détail critères
wsR.write("A41", "Détail par critère (explicabilité)", F_HS)
hdr = ["Code", "Domaine", "Critère", "Clé", "Valeur", "Note /10", "Poids", "Pondéré", "Gate franchi", "Donnée critique manquante", "Note plancher", "Nb correspondances", "Note brute", "Famille", "Type", "Poids domaine", "Poids effectif", "Cumul manquantes", "Cumul conditions", "Libellés manquants", "Rang (lecture)", "Valeur en clair"]
wsR.write_row(f"A{AL_H - 65}", hdr, F_H)   # row 42
wsR.write(f"A{SEED}", "(clé additionnelle)", F_C)
wsR.write_formula(f"D{SEED}", "=P_ExtraKey", F_C)
wsR.write_formula(f"E{SEED}", f'=IF(D{SEED}="","",IFERROR(INDEX(In_Retenue,MATCH(D{SEED},In_Cles,0)),""))', F_C)
wsR.write_formula(f"J{SEED}", f'=AND(D{SEED}<>"",E{SEED}="")', F_C)
wsR.write_formula(f"R{SEED}", f'=IF(J{SEED},D{SEED},"")', F_C)
wsR.write_formula(f"S{SEED}", '=""', F_C)
wsR.write_formula(f"T{SEED}", f'=IF(J{SEED},IFERROR(INDEX(Saisie!$C$13:$C$92,MATCH(D{SEED},In_Cles,0)),D{SEED}),"")', F_C)
BA = "P_Baremes!$A$5:$A$400"; BB = "P_Baremes!$B$5:$B$400"; BC = "P_Baremes!$C$5:$C$400"
BD = "P_Baremes!$D$5:$D$400"; BE = "P_Baremes!$E$5:$E$400"; BH = "P_Baremes!$H$5:$H$400"; BF = "P_Baremes!$F$5:$F$400"
for i in range(NCR):
    r = CR1 + i; s = CR0 + i; p = r - 1
    W = lambda col, fm, fmt=F_C: wsR.write_formula(f"{col}{r}", fm, fmt)
    W("A", f'=IF(P_Criteres!A{s}="","",P_Criteres!A{s})')
    W("B", f'=IF($A{r}="","",P_Criteres!B{s})')
    W("C", f'=IF($A{r}="","",P_Criteres!C{s})')
    W("D", f'=IF($A{r}="","",P_Criteres!F{s})')
    W("E", f'=IF($A{r}="","",IFERROR(INDEX(In_Retenue,MATCH($D{r},In_Cles,0)),""))')
    W("O", f'=IF($A{r}="","",P_Criteres!D{s})')
    wsR.write_array_formula(f"K{r}:K{r}", f'{{=IF($A{r}="",0,MIN(IF({BA}=$A{r},{BH})))}}', F_CN)
    rng = f'({BA}=$A{r})*({BB}="PLAGE")*((({BD}="")+($E{r}>={BD}))>0)*((({BE}="")+($E{r}<{BE}))>0)'
    mod = f'({BA}=$A{r})*({BB}="MODALITE")*({BC}=$E{r})'
    W("L", f'=IF($A{r}="",0,IF($O{r}="NUM",IF(ISNUMBER($E{r}),SUMPRODUCT({rng}),0),SUMPRODUCT({mod})))', F_CN)
    W("M", f'=IF($A{r}="",0,IF($L{r}=0,0,IF($O{r}="NUM",SUMPRODUCT({rng}*{BH}),SUMPRODUCT({mod}*{BH}))))', F_CN)
    W("F", f'=IF($A{r}="",0,ROUND(MIN(P_Scale,MAX(0,IF($L{r}=0,$K{r},$M{r}))),2))', F_CN)
    W("G", f'=IF($A{r}="",0,P_Criteres!E{s})', F_CN)
    W("H", f'=ROUND(F{r}*G{r},2)', F_CN)
    W("I", f'=IF($A{r}="",FALSE,AND(P_Criteres!G{s}="Oui",ISNUMBER(P_Criteres!H{s}),F{r}<=N(P_Criteres!H{s})))')
    W("J", f'=IF($A{r}="",FALSE,AND(OR(P_Criteres!G{s}="Oui",P_Criteres!K{s}="Oui"),$E{r}=""))')
    W("N", f'=IF($A{r}="","",P_Criteres!J{s})')
    W("P", f'=IF($A{r}="",0,IFERROR(INDEX(P_DomPoids,MATCH($B{r},P_DomCodes,0)),0))', F_CN)
    W("Q", f'=P{r}*G{r}', F_CN)
    W("R", f'=IF(J{r},IF(ISNUMBER(SEARCH(","&D{r}&",",","&R{p}&",")),R{p},R{p}&IF(R{p}="","",",")&D{r}),R{p})')
    # Conditions (F15) : chaque critère éliminatoire franchi devient une condition nommée,
    # avec son jalon de levée (même libellé que l'application).
    W("S", f'=IF(I{r},S{p}&IF(S{p}="","","; ")&"Lever la condition « "&C{r}&" » avant "&SUBSTITUTE(LOWER(IF(P_Criteres!I{s}="","TIRAGE",P_Criteres!I{s})),"etude","étude"),S{p})')
    W("T", f'=IF(AND(J{r},NOT(ISNUMBER(SEARCH(","&D{r}&",",","&R{p}&",")))),T{p}&IF(T{p}="","",", ")&IFERROR(INDEX(Saisie!$C$13:$C$92,MATCH(D{r},In_Cles,0)),D{r}),T{p})')
    # Lecture (Fiche) : clé de classement des notes les plus basses (critères pondérés), valeur en clair.
    W("U", f'=IF(OR($A{r}="",N(G{r})<=0),"",F{r}+ROW()/1000000)', F_CN4)
    W("V", f'=IF($A{r}="","",IF($E{r}="","(non renseignée)",IF($O{r}="QUAL",IFERROR(INDEX({BF},SUMPRODUCT(MAX(({BA}=$A{r})*({BB}="MODALITE")*({BC}=$E{r})*(ROW({BA})-4)))),$E{r}),$E{r})))')
# détail alertes
wsR.write("A106", "Détail des alertes D5", F_HS)
wsR.write_row(f"A{AL_H}", ["Code", "Libellé", "Sévérité", "Opérateur", "Clé", "Valeur", "Valeur réf.", "Déclenchée", "Non exclue (donnée absente)", "Malus appliqué", "Comité", "Clé numérique manquante", "Cumul manquantes", "Cumul alertes", "Libellés manquants", "Cumul libellés alertes"], F_H)
for i in range(NAL):
    r = AL1 + i; s = AL0 + i
    W = lambda col, fm, fmt=F_C: wsR.write_formula(f"{col}{r}", fm, fmt)
    pm = f"R{CRN}" if i == 0 else f"M{r-1}"; pn = '""' if i == 0 else f"N{r-1}"; po = f"T{CRN}" if i == 0 else f"O{r-1}"
    W("A", f'=IF(P_Alertes!A{s}="","",P_Alertes!A{s})')
    W("B", f'=IF($A{r}="","",P_Alertes!B{s})')
    W("C", f'=IF($A{r}="","",P_Alertes!C{s})')
    W("D", f'=IF($A{r}="","",P_Alertes!G{s})')
    W("E", f'=IF($A{r}="","",P_Alertes!F{s})')
    W("F", f'=IF($A{r}="","",IFERROR(INDEX(In_Retenue,MATCH($E{r},In_Cles,0)),""))')
    W("G", f'=IF($A{r}="","",IF(P_Alertes!H{s}="","",P_Alertes!H{s}))')
    W("H", f'=IF($A{r}="",FALSE,IF(D{r}="isTrue",F{r}=TRUE,IF(D{r}="isFalse",F{r}=FALSE,IF(D{r}="eq",F{r}=G{r},IF(D{r}="neq",F{r}<>G{r},IF(D{r}="gt",AND(ISNUMBER(F{r}),ISNUMBER(G{r}),N(F{r})>N(G{r})),IF(D{r}="gte",AND(ISNUMBER(F{r}),ISNUMBER(G{r}),N(F{r})>=N(G{r})),IF(D{r}="lt",AND(ISNUMBER(F{r}),ISNUMBER(G{r}),N(F{r})<N(G{r})),IF(D{r}="lte",AND(ISNUMBER(F{r}),ISNUMBER(G{r}),N(F{r})<=N(G{r})),FALSE)))))))))')
    W("L", f'=IF($A{r}="",FALSE,AND(OR(D{r}="gt",D{r}="gte",D{r}="lt",D{r}="lte"),F{r}=""))')
    W("I", f'=IF($A{r}="",FALSE,AND(NOT(H{r}),C{r}<>"BLOCKING",L{r}))')
    W("J", f'=IF(OR(H{r},I{r}),N(P_Alertes!D{s}),0)', F_CN)
    W("K", f'=IF($A{r}="",FALSE,AND(OR(H{r},I{r}),P_Alertes!I{s}="Oui"))')
    W("M", f'=IF(L{r},IF(ISNUMBER(SEARCH(","&E{r}&",",","&{pm}&",")),{pm},{pm}&IF({pm}="","",",")&E{r}),{pm})')
    W("N", f'=IF(OR(H{r},I{r}),{pn}&IF({pn}="","",", ")&A{r},{pn})')
    W("O", f'=IF(AND(L{r},NOT(ISNUMBER(SEARCH(","&E{r}&",",","&{pm}&",")))),{po}&IF({po}="","",", ")&IFERROR(INDEX(Saisie!$C$13:$C$92,MATCH(E{r},In_Cles,0)),E{r}),{po})')
    pq = '""' if i == 0 else f"P{r-1}"
    W("P", f'=IF(OR(H{r},I{r}),{pq}&IF({pq}="","","; ")&B{r}&IF(I{r}," (donnée absente)",""),{pq})')
# mise en forme conditionnelle
wsR.conditional_format("C7", {"type": "cell", "criteria": "==", "value": '"GO"', "format": F_OK})
wsR.conditional_format("C7", {"type": "cell", "criteria": "==", "value": '"GO_WITH_CONDITIONS"', "format": f(bg_color="#E2EFDA", font_color="#375623")})
wsR.conditional_format("C7", {"type": "cell", "criteria": "==", "value": '"WATCH_LIST"', "format": F_WA})
wsR.conditional_format("C7", {"type": "cell", "criteria": "==", "value": '"NO_GO"', "format": F_KO})
wsR.conditional_format("C7", {"type": "cell", "criteria": "==", "value": '"DOSSIER_INCOMPLET"', "format": F_GR})
wsR.conditional_format(f"H{AL1}:H{ALN}", {"type": "cell", "criteria": "==", "value": "TRUE", "format": F_KO})
wsR.conditional_format(f"I{CR1}:J{CRN}", {"type": "cell", "criteria": "==", "value": "TRUE", "format": F_KO})
wsR.freeze_panes(4, 0)
for nm, cell_ in [("Res_ScoreFinal", "C6"), ("Res_Decision", "C7"), ("Res_ClasseInt", "C8"), ("Res_PD", "C9"), ("Res_ScoreEco", "C10"),
                  ("Res_Adj", "C11"), ("Res_Malus", "C12"), ("Res_EcoScore", "C15"), ("Res_GuarScore", "C16"), ("Res_Incomplet", "E23"),
                  ("Res_Manquantes", "C24"), ("Res_Conditions", "C25"), ("Res_Alertes", "C26"), ("Res_Comite", "E27")]:
    wb.define_name(nm, f"=Resultat!${cell_[0]}${cell_[1:]}")
wb.define_name("Res_DomCodes", f"=Resultat!$A${DOM1}:$A${DOMN}"); wb.define_name("Res_DomScores", f"=Resultat!$C${DOM1}:$C${DOMN}")
wb.define_name("Res_AlertesLib", f"=Resultat!$P${ALN}")
wsR.set_column("U:V", 16)
wsR.write("A3", "Calcul pas à pas (lecture seule). La synthèse lisible est dans l'onglet Fiche.", F_SUB)
wsR.protect("", {"format_columns": True, "format_rows": True})


# ============================================================ Fiche (synthèse lisible, imprimable)
F_FT = f(bold=True, font_size=16, font_color=NAVY)
F_FBOX = f(bold=True, font_size=10, font_color="#595959", align="center", valign="vcenter", border=1, bg_color=LIGHT)
F_FBIG = f(bold=True, font_size=24, align="center", valign="vcenter", border=1, num_format="0.00")
F_FBIGT = f(bold=True, font_size=15, align="center", valign="vcenter", border=1, text_wrap=True)
F_FL = f(bold=True, valign="top", border=1, bg_color=GREY)
F_FV = f(valign="top", border=1, text_wrap=True)
F_FN = f(border=1, num_format="0.0"); F_FNT = f(border=1, num_format="0.0", valign="top", align="center", bold=True); F_FP = f(border=1, num_format="0%"); F_FT1 = f(border=1, text_wrap=True, valign="top")
wsFi.hide_gridlines(2)
wsFi.set_column("A:A", 30); wsFi.set_column("B:D", 19); wsFi.set_column("E:F", 13); wsFi.set_column("H:I", 10, None, {"hidden": True})
wsFi.write_formula("A1", '="Fiche de scoring — "&IF(Saisie!C4="","(dossier sans référence)",Saisie!C4)', F_FT)
wsFi.write_formula("A2", '=IF(Saisie!C5="","",Saisie!C5)', f(bold=True, font_size=12))
wsFi.write_formula("A3", f'="Modèle PI_PROMOTION "&P_Version&" · outil {TOOL_VERSION}"', F_SUB)
wsFi.write("E3", "Calculé le", f(align="right", font_color="#595959")); wsFi.write_formula("F3", "=TODAY()", f(num_format="dd/mm/yyyy", font_color="#595959"))
wsFi.write("A5", "Score final / 100", F_FBOX); wsFi.merge_range("B5:C5", "Décision", F_FBOX); wsFi.merge_range("D5:F5", "Classe interne", F_FBOX)
wsFi.merge_range("A6:A7", "", F_FBIG); wsFi.write_formula("A6", "=Res_ScoreFinal", F_FBIG)
wsFi.merge_range("B6:C7", "", F_FBIGT); wsFi.write_formula("B6", '=IFERROR(VLOOKUP(Res_Decision,P_DecTbl,2,FALSE),Res_Decision)', F_FBIGT)
wsFi.merge_range("D6:F7", "", F_FBIGT); wsFi.write_formula("D6", "=Res_ClasseInt", F_FBIGT)
wsFi.set_row(5, 26); wsFi.set_row(6, 26)
DEC_FMT = [("GO", "#C6EFCE", "#006100"), ("GO_WITH_CONDITIONS", "#E2EFDA", "#375623"), ("WATCH_LIST", "#FFEB9C", "#7F6000"),
           ("NO_GO", "#FFC7CE", "#9C0006"), ("DOSSIER_INCOMPLET", "#D9D9D9", "#404040")]
for code_, bg_, fg_ in DEC_FMT:
    for rng_ in ("A6:A7", "B6:C7", "D6:F7"):
        wsFi.conditional_format(rng_, {"type": "formula", "criteria": f'=Res_Decision="{code_}"', "format": wb.add_format({"bg_color": bg_, "font_color": fg_})})
wsFi.merge_range("A9:F9", "Principaux éléments", F_HS)
facts = [
 ("Segment · zone", '=IF(Saisie!C6="","(segment non renseigné)",Saisie!C6)&" · "&IF(Saisie!C7="","(zone non renseignée)",Saisie!C7)'),
 ("Classe réglementaire BAM", '=IF(Saisie!C8="","(non renseignée — dossier incomplet)",IFERROR(VLOOKUP(Saisie!C8,P_Classes,2,FALSE),Saisie!C8))'),
 ("Note économique · note de sûretés", '=FIXED(Res_EcoScore,1)&" / 100   ·   sûretés : "&IF(ISNUMBER(Res_GuarScore),FIXED(Res_GuarScore,1)&" / 100","n/a")'),
 ("Malus des alertes", '=FIXED(Res_Malus,0)&" point(s)"'),
 ("PD indicative (non calibrée)", '=IF(ISNUMBER(Res_PD),FIXED(Res_PD*100,1)&" %","n/d (dossier incomplet)")'),
 ("Critères renseignés", "=Saisie!I7"),
 ("Données décisionnelles manquantes", '=IF(Res_Manquantes="","Aucune",Res_Manquantes)'),
 ("Conditions à lever", '=IF(Res_Conditions="","Aucune",Res_Conditions)'),
 ("Alertes déclenchées", '=IF(Res_AlertesLib="","Aucune",Res_AlertesLib)'),
 ("Retour en comité requis", '=IF(Res_Comite,"Oui","Non")'),
]
for i, (lab_, fm) in enumerate(facts):
    r = 10 + i
    wsFi.write(f"A{r}", lab_, F_FL); wsFi.merge_range(f"B{r}:F{r}", "", F_FV); wsFi.write_formula(f"B{r}", fm, F_FV)
    if lab_ in ("Données décisionnelles manquantes", "Conditions à lever", "Alertes déclenchées"): wsFi.set_row(r - 1, 44)
for r in (16, 17, 18):
    wsFi.conditional_format(f"B{r}:F{r}", {"type": "formula", "criteria": f'=$B${r}<>"Aucune"', "format": wb.add_format({"font_color": "#9C0006"})})
wsFi.conditional_format("B19:F19", {"type": "formula", "criteria": '=$B$19="Oui"', "format": wb.add_format({"font_color": "#9C0006", "bold": True})})
wsFi.merge_range("A21:F21", "Scores par domaine", F_HS)
wsFi.write_row("A22", ["Domaine", "Score / 100", "Poids", "Contribution"], F_H)
for i in range(8):
    r = 23 + i; q = DOM1 + i
    wsFi.write_formula(f"A{r}", f'=IF(Resultat!$A${q}="","",Resultat!$A${q}&" — "&Resultat!$B${q})', F_FT1)
    wsFi.write_formula(f"B{r}", f'=IF(Resultat!$A${q}="","",Resultat!$C${q})', F_FN)
    wsFi.write_formula(f"C{r}", f'=IF(Resultat!$A${q}="","",Resultat!$D${q})', F_FP)
    wsFi.write_formula(f"D{r}", f'=IF(Resultat!$A${q}="","",Resultat!$E${q})', F_FN)
wsFi.conditional_format("B23:B30", {"type": "data_bar", "bar_color": "#5B9BD5", "min_type": "num", "min_value": 0, "max_type": "num", "max_value": 100, "bar_solid": True})
wsFi.merge_range("A32:F32", "Points d'attention — les 5 notes les plus basses", F_HS)
wsFi.write_row("A33", ["Critère", "Domaine", "Valeur retenue", "", "Note / 10", ""], F_H)
wsFi.merge_range("C33:D33", "Valeur retenue", F_H); wsFi.merge_range("E33:F33", "Note / 10", F_H)
U_ = f"Resultat!$U${CR1}:$U${CRN}"
for k_ in range(5):
    r = 34 + k_
    wsFi.write_formula(f"H{r}", f'=IFERROR(SMALL({U_},{k_ + 1}),"")', F_C)
    wsFi.write_formula(f"I{r}", f'=IF(H{r}="","",MATCH(H{r},{U_},0))', F_C)
    wsFi.write_formula(f"A{r}", f'=IF(I{r}="","",INDEX(Resultat!$C${CR1}:$C${CRN},I{r}))', F_FT1)
    wsFi.write_formula(f"B{r}", f'=IF(I{r}="","",IFERROR(INDEX(P_DomNoms,MATCH(INDEX(Resultat!$B${CR1}:$B${CRN},I{r}),P_DomCodes,0)),""))', F_FT1)
    wsFi.merge_range(f"C{r}:D{r}", "", F_FT1); wsFi.write_formula(f"C{r}", f'=IF(I{r}="","",INDEX(Resultat!$V${CR1}:$V${CRN},I{r}))', F_FT1)
    wsFi.merge_range(f"E{r}:F{r}", "", F_FNT); wsFi.write_formula(f"E{r}", f'=IF(I{r}="","",INDEX(Resultat!$F${CR1}:$F${CRN},I{r}))', F_FNT)
    wsFi.set_row(r - 1, 30)
wsFi.conditional_format("E34:F38", {"type": "cell", "criteria": "<", "value": 5, "format": F_KO})
wsFi.conditional_format("E34:F38", {"type": "cell", "criteria": "between", "minimum": 5, "maximum": 6.99, "format": F_WA})
wsFi.merge_range("A40:F40", "Outil indicatif. La décision officielle se prend dans l'application (circuit de validation, comité). Détail du calcul : onglet Resultat.", f(italic=True, font_size=8, font_color="#7F7F7F", text_wrap=True))
wsFi.set_row(39, 24)
wsFi.print_area("A1:F40"); wsFi.fit_to_pages(1, 1); wsFi.set_paper(9); wsFi.set_portrait(); wsFi.center_horizontally()
wsFi.set_margins(left=0.5, right=0.5, top=0.6, bottom=0.6)
wsFi.set_footer("&L&8Scoring PI — promotion immobilière&R&8&D")
wsFi.protect("", {"format_columns": True, "format_rows": True})

# ============================================================ Accueil
F_AH = f(bold=True, font_color="white", bg_color=NAVY, font_size=11)
F_AL = f(bold=True, valign="top", text_wrap=True)
F_AT = f(valign="top", text_wrap=True)
wsAc.hide_gridlines(2); wsAc.set_column("A:A", 2); wsAc.set_column("B:B", 34); wsAc.set_column("C:C", 92)
wsAc.write("B1", "Outil de scoring — Promotion immobilière", f(bold=True, font_size=20, font_color=NAVY))
wsAc.write_formula("B2", f'="Modèle PI_PROMOTION "&P_Version&" (publié le "&P_Date&") · outil {TOOL_VERSION} du {TOOL_DATE}"', F_SUB)
wsAc.merge_range("B4:C4", "Dossier en cours", F_AH)
cur = [("Référence · projet", '=IF(Saisie!C4="","(aucun dossier — commencez par l\'onglet Saisie)",Saisie!C4&" — "&Saisie!C5)', F_C),
       ("Score final / 100", "=Res_ScoreFinal", f(bold=True, font_size=14, bg_color=GREY, border=1, num_format="0.00", align="left")),
       ("Décision", '=IFERROR(VLOOKUP(Res_Decision,P_DecTbl,2,FALSE),Res_Decision)', f(bold=True, font_size=12, border=1, bg_color=GREY)),
       ("Classe interne", "=Res_ClasseInt", F_C),
       ("Critères renseignés", "=Saisie!I7", F_C),
       ("Données décisionnelles manquantes", "=Saisie!I8", F_C)]
for i, (lab_, fm, fmt_) in enumerate(cur):
    wsAc.write(f"B{5+i}", lab_, F_L); wsAc.write_formula(f"C{5+i}", fm, fmt_)
for code_, bg_, fg_ in DEC_FMT:
    wsAc.conditional_format("C7", {"type": "formula", "criteria": f'=Res_Decision="{code_}"', "format": wb.add_format({"bg_color": bg_, "font_color": fg_})})
wsAc.conditional_format("C10", {"type": "cell", "criteria": ">", "value": 0, "format": F_KO})
wsAc.write_url("C11", "internal:Fiche!A1", string="→ Ouvrir la fiche de résultat")
wsAc.merge_range("B13:C13", "Comment faire", F_AH)
steps = [("1. Nouveau dossier", "Saisie!C4", "Ruban « Scoring PI » › Nouveau dossier : vide la saisie et les calculateurs. Sans macros : effacez les cellules jaunes de l'onglet Saisie."),
         ("2. Renseigner la saisie", "Saisie!E13", "Identité du dossier puis données, dans les cellules jaunes (listes en clair). Laissez vide une donnée inconnue. La colonne « État » signale ce qui manque ; le résultat se met à jour en direct en haut de la feuille."),
         ("3. Calculateurs (facultatif)", "Calculateurs!A4", "Autorisations, ventes sécurisées, mainlevée, division des risques, arrêt de chantier, déblocages, équipements exigés, programme mixte : ils calculent 16 données de la saisie (votre saisie directe prime)."),
         ("4. Lire et imprimer la fiche", "Fiche!A1", "Décision, notes, données manquantes, conditions à lever, alertes, points d'attention. Imprimable sur une page (Ctrl+P) ; ruban › Exporter la fiche en PDF."),
         ("5. Enregistrer le dossier", "Portefeuille!A5", "Ruban › Enregistrer le dossier : il est rangé dans l'onglet Portefeuille (même référence = mise à jour). Ruban › Ouvrir un dossier pour le recharger."),
         ("6. Aller plus loin", "Stress!A1", "Stress test (7 scénarios), scoring de tout le portefeuille, journal des calculs (onglet Historique), aide détaillée (onglet Aide).")]
for i, (lab_, target, txt) in enumerate(steps):
    r = 14 + i
    wsAc.write_url(f"B{r}", f"internal:{target}", f(bold=True, font_color="#0563C1", underline=1, valign="top"), string=lab_)
    wsAc.write(f"C{r}", txt, F_AT); wsAc.set_row(r - 1, 32)
wsAc.merge_range("B21:C21", "Macros et ruban « Scoring PI »", F_AH)
mac = [("Fichier .xlsm", "Les macros et l'onglet de ruban « Scoring PI » sont intégrés : rien à installer. Si Excel indique que les macros sont bloquées (fichier reçu par e-mail ou téléchargé) : fermez le fichier, clic droit › Propriétés › cochez « Débloquer » › OK, rouvrez-le puis cliquez « Activer le contenu »."),
       ("Sans macros", "Le calcul (saisie, fiche, résultat) fonctionne sans macros, y compris dans le fichier .xlsx : seules les actions du ruban (nouveau dossier, enregistrer, PDF, stress, portefeuille) sont indisponibles.")]
for i, (lab_, txt) in enumerate(mac):
    wsAc.write(f"B{22+i}", lab_, F_AL); wsAc.write(f"C{22+i}", txt, F_AT); wsAc.set_row(21 + i, 44)
wsAc.merge_range("B25:C25", "Bon à savoir", F_AH)
tips = [("Vide ≠ 0", "Une donnée vide est « absente » : note plancher, ou « dossier incomplet » si elle est décisionnelle. Ne saisissez jamais 0 ou « Non » à la place d'une donnée inconnue."),
        ("Pourcentages", "Saisir les pourcentages en points : 62 pour 62 %. Une valeur comme 0,62 est signalée dans la colonne « État »."),
        ("Feuilles protégées", "Seules les cellules jaunes sont modifiables (protection sans mot de passe : Révision › Ôter la protection si besoin)."),
        ("Paramètres du modèle", "Onglets P_* masqués : ruban › Paramètres (afficher / masquer). Toute modification : Valider le modèle, puis informer le propriétaire du modèle."),
        ("Décision officielle", "Ce classeur est un outil d'aide (simulation, préparation de comité, formation). La décision officielle se prend dans l'application.")]
for i, (lab_, txt) in enumerate(tips):
    wsAc.write(f"B{26+i}", lab_, F_AL); wsAc.write(f"C{26+i}", txt, F_AT); wsAc.set_row(25 + i, 30)
wsAc.protect("", {"format_columns": True, "format_rows": True})

# ============================================================ résultats batch / tests
RES_COLS = ["Score final", "Décision", "Classe interne", "Malus D5", "Dossier complet", "D1", "D2", "D3", "D4", "Score éco.", "Note sûretés", "PD indicative", "Alertes", "Données manquantes", "Conditions"]
def conv(v):
    if v is None: return None
    if isinstance(v, bool): return "Oui" if v else "Non"
    return v
def head_inputs(ws, first_two):
    ws.write("A3", "Identité", F_HS); ws.write(2, 5, "Données d'entrée (mêmes clés que l'onglet Saisie)", F_HS)
    ws.write_row("A4", first_two + ["Segment", "Zone", "Classe BAM"], F_H)
    for j, (_, k, lb, _) in enumerate(KEYS): ws.write(3, 5 + j, k, F_H)
    ws.set_row(3, 42)
# Portefeuille
wsP.write("A1", "Scoring de portefeuille", F_TITLE)
wsP.write("A2", "Une ligne par dossier (ruban › Enregistrer le dossier ajoute ou met à jour la ligne du dossier en cours ; Ouvrir un dossier le recharge). Ruban › Scorer le portefeuille remplit les colonnes de résultat à droite. Booléens : Oui / Non.", F_SUB)
head_inputs(wsP, ["Référence", "Nom du projet"])
PR0 = 5; PRN = 204
for j, t in enumerate(RES_COLS): wsP.write(3, 5 + NK + j, t, f(bold=True, font_color="white", bg_color="#548235", border=1, text_wrap=True))
for i, vi in enumerate([0, 2, 11]):
    v = vec[vi]; r = PR0 + i - 1
    wsP.write(r, 0, f"EXEMPLE-{i+1}", F_IN); wsP.write(r, 1, v["desc"], F_IN); wsP.write(r, 2, v["segment"] or None, F_IN)
    wsP.write(r, 3, v["zone"] or None, F_IN); wsP.write(r, 4, v["cls"] or None, F_IN)
    for j, (_, k, _, _) in enumerate(KEYS):
        val = conv(v["inputs"].get(k))
        if val is None: wsP.write_blank(r, 5 + j, None, F_IN)
        else: wsP.write(r, 5 + j, val, F_IN)
wsP.set_column("A:A", 14); wsP.set_column("B:B", 36); wsP.set_column("C:E", 14); wsP.set_column(5, 5 + NK - 1, 13); wsP.set_column(5 + NK, 5 + NK + len(RES_COLS) - 1, 14)
wsP.freeze_panes(4, 2)
wsP.data_validation(f"C{PR0}:C{PRN}", {"validate": "list", "source": "=P_SegCodes", "ignore_blank": True, "error_type": "warning"})
wsP.data_validation(f"D{PR0}:D{PRN}", {"validate": "list", "source": "=P_ZoneCodes", "ignore_blank": True, "error_type": "warning"})
wsP.data_validation(f"E{PR0}:E{PRN}", {"validate": "list", "source": "=P_ClsCodes", "ignore_blank": True})
# Tests
wsT.write("A1", "Autotests — cas de référence issus du moteur de production", F_TITLE)
wsT.write("A2", "Les résultats attendus proviennent de l'exécution du moteur de l'application sur le modèle " + meta["version"] + ". Macro : ExecuterAutotests (tolérance 0,02 point).", F_SUB)
head_inputs(wsT, ["Cas", "Description"])
EXP = ["Attendu : score final", "Attendu : décision", "Attendu : classe interne", "Attendu : malus", "Attendu : incomplet", "Attendu : score éco.", "Attendu : D1", "Attendu : D2", "Attendu : D3", "Attendu : D4", "Attendu : note sûretés"]
ACT = ["Obtenu : score final", "Obtenu : décision", "Statut"]
for j, t in enumerate(EXP): wsT.write(3, 5 + NK + j, t, F_H)
for j, t in enumerate(ACT): wsT.write(3, 5 + NK + len(EXP) + j, t, f(bold=True, font_color="white", bg_color="#548235", border=1, text_wrap=True))
for i, v in enumerate(vec):
    r = 4 + i
    wsT.write(r, 0, v["id"], F_C); wsT.write(r, 1, v["desc"], F_C); wsT.write(r, 2, v["segment"] or None, F_IN)
    wsT.write(r, 3, v["zone"] or None, F_IN); wsT.write(r, 4, v["cls"] or None, F_IN)
    for j, (_, k, _, _) in enumerate(KEYS):
        val = conv(v["inputs"].get(k))
        if val is None: wsT.write_blank(r, 5 + j, None, F_IN)
        else: wsT.write(r, 5 + j, val, F_IN)
    e = v["expected"]
    ex = [e["scoreFinal"], e["decision"], e["internalClass"], e["totalMalus"], "Oui" if e["dataIncomplete"] else "Non", e["scoreEco"],
          e["domains"]["D1"], e["domains"]["D2"], e["domains"]["D3"], e["domains"]["D4"], e["guaranteeScore"] if e["guaranteeScore"] is not None else "n/a"]
    for j, x in enumerate(ex): wsT.write(r, 5 + NK + j, x, F_P)
wsT.set_column("A:A", 8); wsT.set_column("B:B", 52); wsT.set_column("C:E", 14); wsT.set_column(5, 5 + NK + 14, 13)
wsT.freeze_panes(4, 2)
# Stress
wsX.write("A1", "Stress test sur le dossier courant (onglet Saisie)", F_TITLE)
wsX.write("A2", "Chocs appliqués aux données primitives par identités comptables (marge, LTV, LTC) — mêmes règles que l'application. Macro : LancerStress.", F_SUB)
wsX.write("A3", "Score de base", F_L); wsX.write_blank("C3", None, F_C); wsX.write("D3", "Décision de base", F_L); wsX.write_blank("E3", None, F_C)
wsX.write_row("A4", ["Scénario", "Libellé", "Prix −%", "Coût +%", "Retard (mois)", "Ventes −%", "Taux +bps", "Préventes −pts", "Retard paiement +j", "Score final", "Décision", "Δ vs base"], F_H)
SC = [("price10", "Prix −10 %", 10, 0, 0, 0, 0, 0, 0), ("price15", "Prix −15 %", 15, 0, 0, 0, 0, 0, 0), ("cost10", "Coût +10 %", 0, 10, 0, 0, 0, 0, 0),
      ("delay6", "Retard +6 mois", 0, 0, 6, 0, 0, 0, 0), ("sales20", "Ventes −20 %", 0, 0, 0, 20, 0, 0, 0), ("rate200", "Taux +200 bps", 0, 0, 0, 0, 200, 0, 0),
      ("severe", "Sévère combiné", 15, 10, 6, 20, 200, 0, 0)]
for i in range(10):
    r = 5 + i - 1
    for j in range(9):
        v = SC[i][j] if i < len(SC) else None
        if v is None: wsX.write_blank(r, j, None, F_P)
        else: wsX.write(r, j, v, F_P if j < 2 else F_PN)
    for j in range(9, 12): wsX.write_blank(r, j, None, F_C)
wsX.set_column("A:A", 12); wsX.set_column("B:B", 22); wsX.set_column("C:L", 14)
for lab_, fmt_ in (("Défavorable", F_KO), ("Favorable", F_OK), ("Favorable sous conditions", f(bg_color="#E2EFDA", font_color="#375623")),
                   ("Surveillance (watch list)", F_WA), ("Dossier incomplet", F_GR)):
    wsX.conditional_format("K5:K14", {"type": "cell", "criteria": "==", "value": f'"{lab_}"', "format": fmt_})
# Historique
wsH.write("A1", "Historique des calculs (journal)", F_TITLE)
wsH.write("A2", "Alimenté par les macros (ScorerDossier, ScorerPortefeuille). La version du modèle est tracée sur chaque ligne.", F_SUB)
wsH.write_row("A4", ["Date / heure", "Utilisateur", "Dossier", "Version du modèle", "Score final", "Décision", "Classe interne", "Malus D5", "Dossier complet"], F_H)
wsH.set_column("A:A", 20); wsH.set_column("B:D", 22); wsH.set_column("E:I", 16)

# ============================================================ Aide
wsL.hide_gridlines(2); wsL.set_column("A:A", 3); wsL.set_column("B:B", 30); wsL.set_column("C:C", 110)
wsL.write("B1", "Aide — outil de scoring de la promotion immobilière", F_TITLE)
wsL.write_formula("B2", f'="Modèle PI_PROMOTION "&P_Version&" — publié le "&P_Date&" · outil {TOOL_VERSION} ({TOOL_DATE})"', F_SUB)
rows = [
 ("À quoi sert ce classeur", "Calculer le score, la décision et la classe interne d'un dossier de promotion immobilière selon le modèle publié, hors de l'application : simulation, préparation de comité, agence, dépannage, formation. Il reproduit le moteur de production (vérifié sur " + str(len(vec)) + " cas de référence)."),
 ("Principe", "Le MOTEUR est en formules Excel (onglet Resultat) : chaque note est traçable cellule par cellule et les barèmes se modifient sans code. Les macros AUTOMATISENT : nouveau dossier, enregistrer / ouvrir un dossier, export PDF, stress test, scoring de portefeuille, autotests, validation du modèle, journal."),
 ("Parcours", "Accueil → Saisie (cellules jaunes, résultat en direct) → Fiche (synthèse imprimable). Calculateurs, Portefeuille, Stress et Historique au besoin. Resultat = calcul pas à pas."),
 ("Ruban « Scoring PI »", "Dossier : Nouveau, Enregistrer, Ouvrir, Exporter la fiche en PDF. Analyse : Stress test, Scorer le portefeuille. Outil : Autotests, Valider le modèle, Paramètres (afficher / masquer), Aide. Sans ruban : Alt+F8 et choisir la macro (NouveauDossier, EnregistrerDossier, OuvrirDossier, ExporterPDF, LancerStress, ScorerPortefeuille, ExecuterAutotests, ValiderModele, BasculerParametres)."),
 ("Fichier sans macros", "Le fichier .xlsx calcule tout (saisie, fiche, résultat). Pour y ajouter les macros : Alt+F11 › Fichier › Importer les 6 fichiers .bas du dossier « vba », puis enregistrer au format .xlsm ; InstallerBoutons ajoute des boutons sur l'Accueil."),
 ("Saisie", "Vide = donnée absente (jamais 0, jamais « Non »). Pourcentages en points (62 pour 62 %). Listes en clair : le code technique est déduit automatiquement. La colonne « État » indique : ✔ renseigné, ⚠ manquant — décisionnel (le dossier sera incomplet), ○ non renseigné (note plancher), ⚠ valeur à vérifier."),
 ("Enregistrer les dossiers", "Enregistrer le dossier range les valeurs utilisées (y compris celles des calculateurs) dans le Portefeuille, avec le résultat. Ouvrir un dossier : sélectionnez sa ligne dans le Portefeuille (ou tapez sa référence) ; la saisie et les calculateurs du dossier courant sont d'abord vidés."),
 ("Vérifier", "Ruban › Autotests : attendu « " + str(len(vec)) + " / " + str(len(vec)) + " cas conformes ». Valider le modèle après toute modification des paramètres."),
 ("Invariants de décision", "Donnée manquante ≠ amélioration (note plancher ; alerte « non exclue » si sa donnée numérique manque) · Défaut avéré → NO_GO · Classe non renseignée → dossier incomplet · Aucun malus pour la division des risques (retour en comité)."),
 ("Ce que le classeur ne fait pas", "Classification BAM complète (déclencheurs qualitatifs 1/W, restructuration, effet de groupe) : la classe est saisie ; seule une suggestion fondée sur le retard est affichée. Trésorerie mensuelle, LGD, IFRS 9, workflow d'approbation, historisation multi-utilisateurs : dans l'application."),
 ("Limites d'usage", "Classeur individuel : pas de contrôle d'accès ni de piste d'audit opposable. La décision officielle se prend dans l'application. La PD affichée est INDICATIVE et non calibrée (non affichée si le dossier est incomplet). Les grilles par phase et l'effet des coefficients territoriaux sont des challengers."),
 ("Paramétrage", "Onglets P_* (masqués ; ruban › Paramètres) : critères, barèmes, alertes, ajustements, référentiels, seuils, libellés des décisions. Modifier = Valider le modèle + Instantané du modèle + information du propriétaire du modèle. Après ajout d'une modalité : Rafraîchir les listes."),
 ("Version de l'outil", f"Outil {TOOL_VERSION} du {TOOL_DATE} : classeur .xlsm prêt à l'emploi (macros intégrées, ruban), page d'accueil, fiche de résultat imprimable, saisie en clair avec état des données et résultat en direct, enregistrement des dossiers dans le portefeuille, feuilles protégées, valeurs visibles même en aperçu. Correction : les calculateurs du dossier courant ne faussent plus le scoring du portefeuille ni les autotests."),
]
for i, (a_, b_) in enumerate(rows):
    r = 4 + i
    wsL.write(f"B{r}", a_, F_WB); wsL.write(f"C{r}", b_, F_W); wsL.set_row(r - 1, 48)
TR = 4 + len(rows) + 1
wsL.write(f"B{TR}", "Onglets", F_HS); wsL.write(f"C{TR}", "", F_HS)
tabs = [("Accueil", "Dossier en cours et mode d'emploi"), ("Saisie", "Données du dossier (cellules jaunes) et résultat en direct"),
        ("Fiche", "Synthèse lisible et imprimable"), ("Calculateurs", "Données dérivées : autorisations, ventes sécurisées, mainlevée, division des risques, arrêt de chantier, déblocages, équipements, programme mixte"),
        ("Portefeuille", "Dossiers enregistrés et scoring de masse"), ("Stress", "Chocs sur le dossier courant"), ("Resultat", "Calcul pas à pas (moteur)"),
        ("Historique", "Journal des calculs"), ("Tests, P_* (masqués)", f"{len(vec)} cas de référence ; paramètres du modèle")]
for i, (a_, b_) in enumerate(tabs): wsL.write(f"B{TR+1+i}", a_, F_L); wsL.write(f"C{TR+1+i}", b_)
wsAc.activate(); wsAc.set_first_sheet()
wb.close()
print("Classeur généré :", OUT)
