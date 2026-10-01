# Exécute les macros VBA du classeur dans LibreOffice (compatibilité VBA) et
# contrôle leurs effets : autotests, portefeuille, stress (vs moteur de l'app),
# journal, validation, instantané, nouveau dossier.
import sys, glob, time, os, json
sys.path.insert(0, sys.argv[0].rsplit("/", 1)[0])
import lo
X, VBADIR, STRESS = sys.argv[1], sys.argv[2], sys.argv[3]
MACROS = ["modModele.ValiderModele", "modScoring.ExecuterAutotests", "modScoring.ScorerDossier",
          "modScoring.ScorerPortefeuille", "modStress.LancerStress", "modModele.RafraichirListes",
          "modModele.SnapshotModele", "modScoring.ViderDossier", "modSetup.InstallerBoutons"]
ctx, desk = lo.start()
ok_all = True
try:
    doc = lo.load(desk, X, macros=True)
    libs = doc.BasicLibraries; libs.VBACompatibilityMode = True
    lib = libs.getByName("Standard")
    for f in sorted(glob.glob(os.path.join(VBADIR, "*.bas"))):
        src = open(f, encoding="ascii").read().replace("\r\n", "\n")
        lib.insertByName(os.path.basename(f)[:-4], "Option VBASupport 1\n" + "\n".join(l for l in src.split("\n") if not l.startswith("Attribute VB_")))
    wrap = ["Option VBASupport 1"]
    for i, m in enumerate(MACROS):
        wrap += [f"Sub R{i}()", "  On Error GoTo E", f"  {m.split('.')[1]}",
                 f'  ThisComponent.Sheets.getByName("LisezMoi").getCellByPosition(30,{i}).setString("OK")', "  Exit Sub", "E:",
                 f'  ThisComponent.Sheets.getByName("LisezMoi").getCellByPosition(30,{i}).setString("ERR " & Err.Number & " : " & Err.Description)', "End Sub"]
    lib.insertByName("zRun", chr(10).join(wrap))
    sp = doc.getScriptProvider()
    Sh = doc.Sheets.getByName
    stress_rows = None
    for i, m in enumerate(MACROS):
        try: sp.getScript(f"vnd.sun.star.script:Standard.zRun.R{i}?language=Basic&location=document").invoke((), (), ())
        except Exception as e: pass
        st = Sh("LisezMoi").getCellByPosition(30, i).getString() or "NON EXÉCUTÉ"
        print(f"{st[:110]:<40} {m}", flush=True)
        if m.endswith("LancerStress"):
            x = Sh("Stress")
            stress_rows = [(x.getCellByPosition(0, r).getString(), x.getCellByPosition(9, r).getValue(), x.getCellByPosition(10, r).getString()) for r in range(4, 11)]
            base = (x.getCellRangeByName("C3").getValue(), x.getCellRangeByName("E3").getString())
    t = Sh("Tests"); hdr = [t.getCellByPosition(c, 3).getString() for c in range(0, 160)]; sc = hdr.index("Statut")
    nCas = sum(1 for r in range(4, 200) if t.getCellByPosition(0, r).getString())
    stat = [t.getCellByPosition(sc, r).getString() for r in range(4, 4 + nCas)]
    print(f"Autotests VBA : {sum(1 for s in stat if s == 'OK')}/{nCas}", [s for s in stat if s != "OK"])
    ok_all &= all(s == "OK" for s in stat)
    exp = json.load(open(STRESS))
    print(f"Stress base : VBA {base} | app {exp['base']}")
    ok_all &= abs(base[0] - exp["base"]["scoreFinal"]) <= 0.02 and base[1] == exp["base"]["decision"]
    for (k, v, d), e in zip(stress_rows, exp["scenarios"]):
        good = k == e["key"] and abs(v - e["scoreFinal"]) <= 0.02 and d == e["decision"]
        ok_all &= good
        print(f"  {'OK   ' if good else 'ÉCART'} {k:<8} VBA {v:6.2f} {d:<20} app {e['scoreFinal']:6.2f} {e['decision']}")
    p = Sh("Portefeuille"); ph = [p.getCellByPosition(c, 3).getString() for c in range(0, 200)]
    c0 = ph.index("Score final")
    for r in range(4, 7):
        print("  Portefeuille", p.getCellByPosition(0, r).getString(), [p.getCellByPosition(c0 + j, r).getString() for j in (0, 1, 2, 13, 14)])
    h = Sh("Historique"); print("  Journal :", [h.getCellByPosition(2, r).getString() for r in range(4, 9)])
    s = Sh("Saisie"); vide = all(s.getCellByPosition(4, r).getString() == "" for r in range(12, 92)) and s.getCellRangeByName("C4").getString() == ""
    print("  Nouveau dossier (saisie vidée) :", vide); ok_all &= vide
    v = Sh("Validation"); errs = [v.getCellByPosition(1, r).getString() for r in range(0, 400) if v.getCellByPosition(0, r).getString() == "ERREUR"]
    print("  ValiderModele : erreurs =", len(errs), errs[:3]); ok_all &= not errs
    print("BILAN MACROS :", "CONFORME" if ok_all else "ÉCARTS")
    doc.close(True)
finally:
    lo.stop()
    for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(X)), ".~lock.*")): os.remove(f)
