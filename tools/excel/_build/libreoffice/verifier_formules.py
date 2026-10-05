# Recalcule le classeur dans LibreOffice Calc sur les cas de référence (vectors.json).
import json, sys, time
sys.path.insert(0, sys.argv[0].rsplit("/", 1)[0])
import lo
X = sys.argv[1]; VEC = sys.argv[2]
# « libelles » : les modalités, le segment et la zone sont saisis par leur libellé en clair
# (listes déroulantes de l'outil 5.1) au lieu du code ; les résultats doivent être identiques.
LIBELLES = len(sys.argv) > 3 and sys.argv[3] == "libelles"
vec = json.load(open(VEC, encoding="utf-8"))
ctx, desk = lo.start()
try:
    doc = lo.load(desk, X)
    sh = doc.Sheets
    S = sh.getByName("Saisie"); R = sh.getByName("Resultat")
    rowof = {}
    for r in range(13, 93):
        k = S.getCellByPosition(1, r - 1).getString()
        if k: rowof[k] = r
    OUT = {"final": "C6", "dec": "C7", "cls": "C8", "malus": "C12", "inc": "E23", "eco": "C10", "guar": "C16", "econ": "C15",
           "d1": "C32", "d2": "C33", "d3": "C34", "d4": "C35", "miss": "C24", "cond": "C25"}
    def setv(sheet, addr, v):
        c = sheet.getCellRangeByName(addr)
        if v is None or v == "": c.setString(""); c.setFormula("")
        elif isinstance(v, bool): c.setString("Oui" if v else "Non")
        elif isinstance(v, (int, float)): c.setValue(float(v))
        else: c.setString(str(v))
    def getv(sheet, addr):
        c = sheet.getCellRangeByName(addr)
        from com.sun.star.table.CellContentType import TEXT, VALUE, FORMULA
        if c.getError(): return f"#ERR{c.getError()}"
        t = c.getType()
        if t.value == "FORMULA":
            return c.getString() if int(c.FormulaResultType2) == 2 else c.getValue()
        return c.getValue() if t.value == "VALUE" else c.getString()
    lab = {}
    if LIBELLES:
        K, B, F, J = (sh.getByName(n) for n in ("P_Criteres", "P_Baremes", "P_Referentiels", "P_Ajustements"))
        code_of_key = {K.getCellByPosition(5, r).getString(): K.getCellByPosition(0, r).getString() for r in range(4, 64) if K.getCellByPosition(5, r).getString()}
        opt = {(B.getCellByPosition(0, r).getString(), B.getCellByPosition(2, r).getString()): B.getCellByPosition(5, r).getString()
               for r in range(4, 400) if B.getCellByPosition(1, r).getString() == "MODALITE"}
        for k, c in code_of_key.items():
            for (cc, v), l in opt.items():
                if cc == c: lab[(k, v)] = l
        for r in range(65, 75):
            if F.getCellByPosition(0, r).getString(): lab[(F.getCellByPosition(0, r).getString(), F.getCellByPosition(1, r).getString())] = F.getCellByPosition(2, r).getString()
        for r in range(4, 24):
            for c0 in (0, 4):
                if J.getCellByPosition(c0, r).getString(): lab[("@", J.getCellByPosition(c0, r).getString())] = J.getCellByPosition(c0 + 1, r).getString()
        print(f"Saisie par libellés : {len(lab)} correspondances code → libellé")
    def L(k, v):
        return lab.get((k, v), v) if LIBELLES and isinstance(v, str) else v
    ok = 0
    for case in vec:
        for k, r in rowof.items(): setv(S, f"E{r}", L(k, case["inputs"].get(k)))
        setv(S, "C6", L("@", case["segment"])); setv(S, "C7", L("@", case["zone"])); setv(S, "C8", case["cls"])
        doc.calculateAll()
        res = {n: getv(R, a) for n, a in OUT.items()}
        e = case["expected"]
        def num(x):
            try: return float(x)
            except: return float("nan")
        checks = {
          "final": abs(num(res["final"]) - e["scoreFinal"]) <= 0.02, "dec": str(res["dec"]) == e["decision"], "cls": str(res["cls"]) == e["internalClass"],
          "malus": abs(num(res["malus"]) - e["totalMalus"]) <= 0.001,
          "inc": (str(res["inc"]).upper() in ("TRUE", "1", "1.0", "VRAI")) == e["dataIncomplete"],
          "eco": abs(num(res["eco"]) - e["scoreEco"]) <= 0.02,
          "d": all(abs(num(res[f"d{i}"]) - e["domains"][f"D{i}"]) <= 0.02 for i in range(1, 5)),
          "econ": abs(num(res["econ"]) - e["economicScore"]) <= 0.02,
          "guar": (str(res["guar"]) == "n/a") if e["guaranteeScore"] is None else abs(num(res["guar"]) - e["guaranteeScore"]) <= 0.02,
        }
        good = all(checks.values()); ok += good
        if case['id'] in ('T07','T11','T14','T18'): print("    manquantes:", res["miss"], "| conditions:", res["cond"])
        print(f"{case['id']} {'OK   ' if good else 'ÉCART'} final={res['final']} (att {e['scoreFinal']}) {res['dec']} {res['cls']}" + ("" if good else f"  écarts={[k for k,v in checks.items() if not v]} {res}"), flush=True)
    print(f"BILAN LibreOffice : {ok}/{len(vec)}")
    doc.close(True)
finally:
    import glob, os
    for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(X)), '.~lock.*')): os.remove(f)
    lo.stop()
