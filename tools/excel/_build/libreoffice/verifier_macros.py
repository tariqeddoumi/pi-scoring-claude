# Exécute les macros VBA du classeur dans LibreOffice (compatibilité VBA) et
# contrôle leurs effets.
# Usage : verifier_macros.py classeur dossier_vba|integre stress_expected.json vectors.json
#   « integre » : macros du projet VBA intégré au .xlsm (aucun module importé) ;
#   sinon       : les modules .bas du dossier sont importés dans le classeur.
# Contrôles : validation du modèle, stress (vs moteur de l'application), autotests et
# portefeuille AVEC un calculateur rempli sur le dossier courant (il ne doit pas fuir
# dans les lignes scorées), aller-retour enregistrer / ouvrir un dossier, paramètres,
# listes, ruban, instantané, nouveau dossier, boutons.
import sys, glob, os, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lo
X, VBADIR, STRESS, VEC = sys.argv[1:5]
INTEGRE = VBADIR == "integre"
MODULES = ["modDossier", "modModele", "modOutils", "modRuban", "modScoring", "modSetup", "modStress"]
STEPS = [
    "ValiderModele", "LancerStress",
    "PoserCalculateur", "ExecuterAutotests", "ScorerPortefeuille", "RetirerCalculateur",
    "EcrireDossierLigne 30", "ViderDossier", "OuvrirLigne 30",
    "BasculerParametres", "BasculerParametres", "RafraichirListes", "ExecuterAction \"btnAccueil\"",
    "SnapshotModele", "ViderDossier", "InstallerBoutons",
]
ctx, desk = lo.start()
ok_all = True
def check(label, cond, detail=""):
    global ok_all
    ok_all &= bool(cond)
    print(f"  {'OK   ' if cond else 'ÉCART'} {label}" + (f" — {detail}" if detail else ""), flush=True)
try:
    doc = lo.load(desk, X, macros=True)
    libs = doc.BasicLibraries; libs.VBACompatibilityMode = True
    lib = libs.getByName("Standard")
    if INTEGRE:
        present = sorted(n for n in lib.ElementNames)
        check("projet VBA intégré chargé (7 modules)", all(m in present for m in MODULES), str(present))
    else:
        for f in sorted(glob.glob(os.path.join(VBADIR, "*.bas"))):
            src = open(f, encoding="ascii").read().replace("\r\n", "\n")
            lib.insertByName(os.path.basename(f)[:-4], "Option VBASupport 1\n" + "\n".join(l for l in src.split("\n") if not l.startswith("Attribute VB_")))
    # Étapes utilitaires du banc (remplir / vider un calculateur du dossier courant)
    arret = (datetime.date.today() - datetime.date(1899, 12, 30)).days - 730   # arrêt commencé il y a 2 ans
    wrap = ["Option VBASupport 1",
            "Sub PoserCalculateur()", f'  ThisWorkbook.Worksheets("Calculateurs").Range("C125").Value = {arret}', "  Application.Calculate", "End Sub",
            "Sub RetirerCalculateur()", '  ThisWorkbook.Worksheets("Calculateurs").Range("C125").ClearContents', "  Application.Calculate", "End Sub"]
    for i, m in enumerate(STEPS):
        wrap += [f"Sub R{i}()", "  On Error GoTo E", f"  {m}",
                 f'  ThisComponent.Sheets.getByName("Historique").getCellByPosition(40,{i}).setString("OK")', "  Exit Sub", "E:",
                 f'  ThisComponent.Sheets.getByName("Historique").getCellByPosition(40,{i}).setString("ERR " & Err.Number & " : " & Err.Description)', "End Sub"]
    lib.insertByName("zBanc", chr(10).join(wrap))
    sp = doc.getScriptProvider()
    Sh = doc.Sheets.getByName
    S, R, P, C = Sh("Saisie"), Sh("Resultat"), Sh("Portefeuille"), Sh("Calculateurs")
    dec_code = {Sh("P_General").getCellByPosition(1, r).getString(): Sh("P_General").getCellByPosition(0, r).getString() for r in range(51, 56)}
    vec = json.load(open(VEC, encoding="utf-8"))
    exp = json.load(open(STRESS, encoding="utf-8"))
    def run(i):
        try: sp.getScript(f"vnd.sun.star.script:Standard.zBanc.R{i}?language=Basic&location=document").invoke((), (), ())
        except Exception as e:
            if os.environ.get("LO_DEBUG"): print("     exception :", str(e)[:300])
        return Sh("Historique").getCellByPosition(40, i).getString() or "NON EXÉCUTÉ"
    score0 = R.getCellRangeByName("C6").getValue(); dec0 = R.getCellRangeByName("C7").getString()
    for i, m in enumerate(STEPS):
        st = run(i)
        check(f"{m:<28} {st[:90]}", st == "OK")
        if m == "LancerStress":
            x = Sh("Stress")
            base = (x.getCellRangeByName("C3").getValue(), dec_code.get(x.getCellRangeByName("E3").getString(), "?"))
            check("stress : score de base identique à l'application", abs(base[0] - exp["base"]["scoreFinal"]) <= 0.02 and base[1] == exp["base"]["decision"], str(base))
            for r, e in zip(range(4, 11), exp["scenarios"]):
                k, v, d = x.getCellByPosition(0, r).getString(), x.getCellByPosition(9, r).getValue(), dec_code.get(x.getCellByPosition(10, r).getString(), "?")
                check(f"stress {k:<8} {v:6.2f} {d}", k == e["key"] and abs(v - e["scoreFinal"]) <= 0.02 and d == e["decision"], f"app {e['scoreFinal']} {e['decision']}")
        if m == "PoserCalculateur":
            row = {S.getCellByPosition(1, r).getString(): r for r in range(12, 92)}["project_stopped_months"]
            check("calculateur rempli → donnée du dossier courant", S.getCellByPosition(5, row).getValue() >= 23, S.getCellByPosition(5, row).getString())
        if m == "ExecuterAutotests":
            t = Sh("Tests"); hdr = [t.getCellByPosition(c, 3).getString() for c in range(0, 160)]; sc = hdr.index("Statut")
            n = sum(1 for r in range(4, 200) if t.getCellByPosition(0, r).getString())
            stat = [t.getCellByPosition(sc, r).getString() for r in range(4, 4 + n)]
            check(f"autotests avec un calculateur rempli : {sum(s == 'OK' for s in stat)}/{n}", all(s == "OK" for s in stat), str([s for s in stat if s != "OK"][:3]))
        if m == "ScorerPortefeuille":
            ph = [P.getCellByPosition(c, 3).getString() for c in range(0, 200)]; c0 = ph.index("Score final")
            for r, vi in zip(range(4, 7), (0, 2, 11)):
                got, d = P.getCellByPosition(c0, r).getValue(), dec_code.get(P.getCellByPosition(c0 + 1, r).getString(), "?")
                e = vec[vi]["expected"]
                check(f"portefeuille {P.getCellByPosition(0, r).getString()} {got:6.2f} {d}", abs(got - e["scoreFinal"]) <= 0.02 and d == e["decision"], f"att {e['scoreFinal']} {e['decision']}")
            check("calculateurs réactivés après le traitement", Sh("P_General").getCellRangeByName("E4").getValue() == 1)
        if m == "OuvrirLigne 30":
            doc.calculateAll()
            s1, d1 = R.getCellRangeByName("C6").getValue(), R.getCellRangeByName("C7").getString()
            check("enregistrer puis ouvrir : même score et même décision", abs(s1 - score0) <= 0.001 and d1 == dec0, f"{s1} {d1} / {score0} {dec0}")
            gov = {S.getCellByPosition(1, r).getString(): r for r in range(12, 92)}["governance_quality"]
            check("dossier rouvert affiché en clair", S.getCellByPosition(4, gov).getString() == "Claire / structurée" and S.getCellRangeByName("C6").getString() == "Moyen-haut standing",
                  f"{S.getCellByPosition(4, gov).getString()} · {S.getCellRangeByName('C6').getString()}")
        if m == "BasculerParametres":
            vis = Sh("P_General").IsVisible
            print(f"         P_General visible : {vis}")
        if m == "RafraichirListes":
            check("Saisie toujours protégée après la mise à jour des listes", S.isProtected())
    check("paramètres masqués à nouveau après deux bascules", not Sh("P_General").IsVisible and not Sh("Tests").IsVisible)
    vide = all(S.getCellByPosition(4, r).getString() == "" for r in range(12, 92)) and S.getCellRangeByName("C4").getString() == ""
    check("nouveau dossier : saisie vidée", vide)
    etats = [S.getCellByPosition(8, r).getString() for r in range(12, 92)]
    check("dossier vide : données décisionnelles signalées", sum(e.startswith("⚠ Manquant") for e in etats) >= 3, f"{sum(e.startswith('⚠ Manquant') for e in etats)} signalées")
    check("dossier vide : décision « Dossier incomplet »", R.getCellRangeByName("C7").getString() == "DOSSIER_INCOMPLET")
    v = Sh("Validation"); errs = [v.getCellByPosition(1, r).getString() for r in range(0, 400) if v.getCellByPosition(0, r).getString() == "ERREUR"]
    check("ValiderModele : aucune erreur", not errs, str(errs[:3]))
    check("boutons installés sur l'Accueil", Sh("Accueil").DrawPage.Count >= 7, f"{Sh('Accueil').DrawPage.Count} objets")
    print("BILAN MACROS :", "CONFORME" if ok_all else "ÉCARTS")
    doc.close(True)
finally:
    lo.stop()
    for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(X)), ".~lock.*")): os.remove(f)
