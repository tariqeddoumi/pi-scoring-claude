# Étape LibreOffice de la fabrication du classeur .xlsm (voir fabriquer_outil.py) :
#  1. recalcule le classeur et relève le résultat de chaque formule (valeurs mises en
#     cache dans le fichier final : l'aperçu sans recalcul — mode protégé, messagerie,
#     téléphone — affiche alors le vrai résultat du dossier d'exemple) ;
#  2. charge les modules VBA (.bas) et exporte le projet VBA (xl/vbaProject.bin),
#     intégré ensuite au classeur par xlsxwriter.
# Usage : preparer_xlsm.py base.xlsx dossier_vba cache.json vbaProject.bin
import sys, os, glob, json, zipfile, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lo, uno
from pathlib import Path
from com.sun.star.table.CellContentType import FORMULA

SRC, VBADIR, CACHE_OUT, BIN_OUT = sys.argv[1:5]
ERR = {532: "#DIV/0!", 525: "#NAME?", 524: "#REF!", 503: "#NUM!", 32767: "#N/A"}

ctx, desk = lo.start()
try:
    # Export VBA de LibreOffice : réservé au mode expérimental.
    cp = ctx.ServiceManager.createInstanceWithContext("com.sun.star.configuration.ConfigurationProvider", ctx)
    upd = cp.createInstanceWithArguments("com.sun.star.configuration.ConfigurationUpdateAccess",
                                         (lo.pv("nodepath", "/org.openoffice.Office.Common/Misc"),))
    upd.setPropertyValue("ExperimentalMode", True); upd.commitChanges()
    doc = lo.load(desk, SRC, macros=True)
    if doc is None:
        raise SystemExit("Chargement impossible (fichier verrouillé ?) : " + SRC)
    doc.calculateAll()
    cache = {}
    for sh in doc.Sheets.ElementNames:
        ws = doc.Sheets.getByName(sh)
        cur = ws.createCursor(); cur.gotoEndOfUsedArea(False)
        R, C = cur.RangeAddress.EndRow, cur.RangeAddress.EndColumn
        vals = {}
        for r in range(R + 1):
            for c in range(C + 1):
                cell = ws.getCellByPosition(c, r)
                if cell.Type != FORMULA: continue
                e = cell.getError()
                if e:
                    v = ERR.get(e, "#VALUE!")
                elif int(cell.FormulaResultType2) == 2:          # texte
                    v = cell.getString()
                else:
                    x = cell.getValue(); t = cell.getString()
                    v = (x != 0) if t in ("TRUE", "FALSE", "VRAI", "FAUX") else x
                vals[f"{r},{c}"] = v
        cache[sh] = vals
    json.dump(cache, open(CACHE_OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("valeurs en cache :", sum(len(v) for v in cache.values()), "formules")

    libs = doc.BasicLibraries
    libs.VBACompatibilityMode = True
    libs.ProjectName = "Standard"
    lib = libs.getByName("Standard")
    for f in sorted(glob.glob(os.path.join(VBADIR, "*.bas"))):
        name = os.path.basename(f)[:-4]
        src = open(f, encoding="ascii").read().replace("\r\n", "\n")
        mi = uno.createUnoStruct("com.sun.star.script.ModuleInfo")
        mi.ModuleType = uno.getConstantByName("com.sun.star.script.ModuleType.NORMAL")
        lib.insertModuleInfo(name, mi)
        lib.insertByName(name, "Option VBASupport 1\n" + "\n".join(l for l in src.split("\n") if not l.startswith("Attribute VB_")))
    tmp = tempfile.mkdtemp(prefix="xlsm_")
    out = os.path.join(tmp, "vba.xlsm")
    doc.storeToURL(Path(out).as_uri(), (lo.pv("FilterName", "Calc MS Excel 2007 VBA XML"),))
    doc.close(True)
    with zipfile.ZipFile(out) as z:
        data = z.read("xl/vbaProject.bin")
    if len(data) < 4096:
        raise SystemExit("Projet VBA vide : export LibreOffice non effectué")
    open(BIN_OUT, "wb").write(data)
    print("projet VBA :", len(data), "octets,", len(glob.glob(os.path.join(VBADIR, "*.bas"))), "modules")
finally:
    lo.stop()
    for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(SRC)), ".~lock.*")): os.remove(f)
