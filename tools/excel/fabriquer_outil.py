# -*- coding: utf-8 -*-
"""Fabrique l'outil Excel prêt à l'emploi (depuis tools/excel) :
  PI_Promotion_Modele_v5.xlsm  — macros intégrées et onglet de ruban « Scoring PI » ;
  PI_Promotion_Modele_v5.xlsx  — même classeur sans macros (le calcul fonctionne).
Étapes : classeur de base (build_workbook.py) → LibreOffice (valeurs calculées en
cache, projet VBA exporté depuis vba/*.bas) → classeur final (xlsxwriter) → ruban.
Prérequis : python3-uno et LibreOffice (paquets libreoffice-calc, python3-uno)."""
import os, subprocess, sys, tempfile, zipfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "_build")
XLSM = os.path.join(HERE, "PI_Promotion_Modele_v5.xlsm")
XLSX = os.path.join(HERE, "PI_Promotion_Modele_v5.xlsx")
RUBAN = os.path.join(B, "ruban", "customUI14.xml")
REL_UI = "http://schemas.microsoft.com/office/2007/relationships/ui/extensibility"

def run(*cmd):
    print("→", " ".join(os.path.basename(c) if c.endswith(".py") else c for c in cmd), flush=True)
    subprocess.run(cmd, check=True)

def ajouter_ruban(path):
    """Ajoute customUI/customUI14.xml et sa relation au paquet .xlsm."""
    tmp = path + ".tmp"
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "_rels/.rels":
                rel = f'<Relationship Id="rIdCustomUI14" Type="{REL_UI}" Target="customUI/customUI14.xml"/>'
                data = data.decode("utf-8").replace("</Relationships>", rel + "</Relationships>").encode("utf-8")
            zout.writestr(item, data)
        zout.write(RUBAN, "customUI/customUI14.xml")
    os.replace(tmp, path)

def main():
    work = tempfile.mkdtemp(prefix="outil_pi_")
    base, cache, vba = (os.path.join(work, n) for n in ("base.xlsx", "cache.json", "vbaProject.bin"))
    py = sys.executable
    run(py, os.path.join(HERE, "build_workbook.py"), base)
    run(py, os.path.join(B, "libreoffice", "preparer_xlsm.py"), base, os.path.join(HERE, "vba"), cache, vba)
    run(py, os.path.join(HERE, "build_workbook.py"), XLSM, "--cache", cache, "--vba", vba)
    run(py, os.path.join(HERE, "build_workbook.py"), XLSX, "--cache", cache)
    ajouter_ruban(XLSM)
    shutil.rmtree(work, ignore_errors=True)
    print("Outil fabriqué :", os.path.basename(XLSM), "et", os.path.basename(XLSX))

if __name__ == "__main__":
    main()
