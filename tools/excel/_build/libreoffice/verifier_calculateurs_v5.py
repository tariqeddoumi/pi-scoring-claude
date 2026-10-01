# Vérifie les calculateurs v5 (onglet Calculateurs, sections F à H) contre les
# valeurs du moteur de l'application (tests/programmeV5.test.ts, mêmes données),
# et qu'un calculateur vide n'injecte aucune valeur dans la Saisie.
import sys, datetime
sys.path.insert(0, sys.argv[0].rsplit("/", 1)[0])
import lo
X = sys.argv[1]
ctx, desk = lo.start()
def serial(d): return (datetime.date.fromisoformat(d) - datetime.date(1899, 12, 30)).days
try:
    doc = lo.load(desk, X)
    C = doc.Sheets.getByName("Calculateurs"); S = doc.Sheets.getByName("Saisie")
    rowof = {S.getCellByPosition(1, r - 1).getString(): r for r in range(13, 93) if S.getCellByPosition(1, r - 1).getString()}
    def setv(a, v):
        c = C.getCellRangeByName(a)
        if isinstance(v, (int, float)): c.setValue(float(v))
        else: c.setString(v)
    def F(k):
        c = S.getCellRangeByName(f"F{rowof[k]}")
        return c.getString() if int(c.FormulaResultType2) == 2 else c.getValue()
    KEYS = ["drawdown_vs_progress_pct", "drawdown_ahead_of_works", "drawdown_schedule_late", "equipment_unbudgeted_pct",
            "equipment_delivery_at_risk", "slow_liquidity_share_pct", "cancellation_rate_pct", "cost_overrun_pct"]
    doc.calculateAll()
    vide = {k: F(k) for k in KEYS}
    ok_vide = all(v == "" for v in vide.values())
    print("Calculateurs vides → aucune valeur injectée :", "OK" if ok_vide else f"ÉCART {vide}")
    # F. déblocages
    setv("C132", 100); setv("C133", 60); setv("C134", 40)
    setv("C138", serial("2026-10-01"))
    for i, (d, p, r) in enumerate([("2026-03-01", 100, 100), ("2026-08-01", 100, 20), ("2027-01-01", 100, 0)]):
        setv(f"A{140+i}", f"J{i+1}"); setv(f"B{140+i}", serial(d)); setv(f"C{140+i}", p); setv(f"D{140+i}", r)
    # G. équipements
    setv("C158", "Liste ci-dessous"); setv("C159", 100e6); setv("C160", 20); setv("C161", serial("2026-10-01"))
    for i, row in enumerate([("Mosquée", 3e6, "promoteur", "Non", "Oui", serial("2026-06-30"), 10, "Non"),
                             ("École", 5e6, "commune", "Non", "Oui", serial("2026-06-30"), 10, "Non")]):
        for col, v in zip("ABCDEFGH", row): setv(f"{col}{164+i}", v)
    # H. mixte, désistements, coût
    setv("C178", 800); setv("C179", 100); setv("C180", 100)
    setv("C183", 2); setv("C184", 1)
    setv("C187", 100); setv("C188", 112)
    doc.calculateAll()
    att = {"drawdown_vs_progress_pct": 150, "drawdown_ahead_of_works": "Oui", "drawdown_schedule_late": "Oui", "equipment_unbudgeted_pct": 3,
           "equipment_delivery_at_risk": "Oui", "slow_liquidity_share_pct": 20, "cancellation_rate_pct": 33.33, "cost_overrun_pct": 12}
    ok = 0
    for k, e in att.items():
        v = F(k); good = (abs(v - e) <= 0.01) if isinstance(e, (int, float)) and not isinstance(v, str) else v == e
        ok += good; print(f"{k:28s} {'OK   ' if good else 'ÉCART'} obtenu={v} attendu={e}")
    # « Aucun équipement exigé » déclaré, liste vide → 0 et Non
    for i in range(2):
        for col in "ABCDEFGH": C.getCellRangeByName(f"{col}{164+i}").setString("")
    setv("C158", "Aucun équipement exigé"); doc.calculateAll()
    g2 = F("equipment_unbudgeted_pct") == 0 and F("equipment_delivery_at_risk") == "Non"
    print("Aucun équipement exigé → 0 % et Non :", "OK" if g2 else "ÉCART")
    print(f"BILAN calculateurs v5 : {ok + ok_vide + g2}/{len(att) + 2}")
    doc.close(True)
finally:
    import glob, os
    for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(X)), '.~lock.*')): os.remove(f)
    lo.stop()
