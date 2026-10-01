import warnings; warnings.filterwarnings("ignore")
import formulas, openpyxl
X = "PI_Promotion_Modele_v5.xlsx"; fn = X.split("/")[-1]
ws = openpyxl.load_workbook(X)["Saisie"]
rowof = {ws.cell(row=r, column=2).value: r for r in range(13, 93) if ws.cell(row=r, column=2).value}
xl = formulas.ExcelModel().loads(X).finish()
R = lambda sh, c: f"'[{fn}]{sh.upper()}'!{c}"
inp = {R("Calculateurs", "B5"): "CONSTRUCTION", R("Calculateurs", "D9"): "Oui", R("Calculateurs", "D11"): "Non",
       R("Calculateurs", "B42"): "credit_debloque", R("Calculateurs", "C42"): 100, R("Calculateurs", "D42"): "Oui",
       R("Calculateurs", "B43"): "credit_en_cours", R("Calculateurs", "C43"): 100, R("Calculateurs", "D43"): "Oui",
       R("Calculateurs", "B44"): "credit_refuse", R("Calculateurs", "C44"): 100, R("Calculateurs", "D44"): "Oui",
       R("Calculateurs", "C90"): 50, R("Calculateurs", "C91"): 800, R("Calculateurs", "C92"): 1000,
       R("Calculateurs", "C100"): 300000000, R("Calculateurs", "C105"): 60000000, R("Calculateurs", "D105"): 40000000, R("Calculateurs", "E105"): 0.5,
       R("Calculateurs", "C106"): 20000000, R("Saisie", "C8"): "SAIN"}
outs = {"auth_pct": R("Calculateurs", "C33"), "works_blocked": R("Calculateurs", "C34"), "secured_rate": R("Calculateurs", "C85"),
        "at_risk": R("Calculateurs", "C86"), "gap": R("Calculateurs", "C94"), "underpriced": R("Calculateurs", "C95"),
        "reco": R("Calculateurs", "C96"), "div_expo": R("Calculateurs", "C116"), "div_ratio": R("Calculateurs", "C118"), "div_breach": R("Calculateurs", "C120"),
        "hdr_class": R("Saisie", "E8"),
        "G_auth": R("Saisie", f"G{rowof['authorization_completeness_pct']}"), "G_works": R("Saisie", f"G{rowof['works_authorization_blocked']}"),
        "G_sec": R("Saisie", f"G{rowof['secured_sales_rate']}"), "G_risk": R("Saisie", f"G{rowof['buyers_financing_at_risk']}"),
        "G_gap": R("Saisie", f"G{rowof['release_quotity_gap_pts']}"), "G_under": R("Saisie", f"G{rowof['release_underpriced']}"),
        "G_div": R("Saisie", f"G{rowof['division_limit_breach']}"), "malus": R("Resultat", "C12"), "alertes": R("Resultat", "C26")}
sol = xl.calculate(inputs=inp, outputs=list(outs.values()))
exp = {"auth_pct": 14.29, "works_blocked": True, "secured_rate": 46.67, "at_risk": True, "gap": -30.0, "underpriced": True, "reco": 88.0,
       "div_expo": 100000000, "div_ratio": 33.33, "div_breach": True, "G_works": True, "G_risk": True, "G_under": True, "G_div": True}
for k, c in outs.items():
    v = sol[c].value; v = v[0][0] if hasattr(v, "__getitem__") else v
    e = exp.get(k); flag = ""
    if e is not None:
        ok = (abs(float(v) - float(e)) < 0.011) if not isinstance(e, bool) else (bool(v) == e)
        flag = "OK" if ok else f"ÉCART (attendu {e})"
    print(f"{k:14} {str(v)[:55]:55} {flag}")
