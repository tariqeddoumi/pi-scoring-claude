# Banc d'essai LibreOffice (UNO) : démarrage sans affichage, chargement, recalcul.
# Utilisé par verifier_formules.py et verifier_macros.py.
import os, sys, time, subprocess, uno, tempfile
from pathlib import Path

def get_soffice_env():
    """Environnement de LibreOffice sans affichage. Dans un bac à sable où les
    sockets Unix sont bloqués, définir LO_ENV_HELPER vers un module fournissant
    get_soffice_env() (cale LD_PRELOAD)."""
    helper = os.environ.get("LO_ENV_HELPER")
    if helper:
        sys.path.insert(0, os.path.dirname(helper))
        return __import__(os.path.basename(helper).rsplit(".", 1)[0]).get_soffice_env()
    env = os.environ.copy(); env["SAL_USE_VCLPLUGIN"] = "svp"; return env
from com.sun.star.beans import PropertyValue

import random
PORT = random.randint(20000, 40000)
_proc = None

def pv(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p

def start():
    global _proc
    prof = tempfile.mkdtemp(prefix="lo_prof_")
    _proc = subprocess.Popen(["soffice", f"-env:UserInstallation={Path(prof).as_uri()}", "--headless", "--invisible",
        "--norestore", "--nologo", f"--accept=socket,host=127.0.0.1,port={PORT};urp;"],
        env=get_soffice_env(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(60):
        try:
            ctx = resolver.resolve(f"uno:socket,host=127.0.0.1,port={PORT};urp;StarOffice.ComponentContext")
            smgr = ctx.ServiceManager
            return ctx, smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        except Exception:
            time.sleep(1)
    raise RuntimeError("LibreOffice ne répond pas")

def stop():
    if _proc:
        _proc.terminate()
        try: _proc.wait(10)
        except Exception: _proc.kill()

def load(desktop, path, macros=False):
    props = (pv("Hidden", os.environ.get("LO_VISIBLE") != "1"),)
    if macros: props += (pv("MacroExecutionMode", 4),)  # ALWAYS_EXECUTE_NO_WARN
    return desktop.loadComponentFromURL(Path(path).absolute().as_uri(), "_blank", 0, props)
