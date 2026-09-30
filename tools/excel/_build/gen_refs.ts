// Exporte les référentiels métier de l'application (valeurs par défaut du code)
// pour le classeur Excel : une seule source, pas de copie manuelle.
import fs from "node:fs";
import { AUTHORIZATION_CHAIN, BUYER_FINANCING_STATUSES, FACILITY_NATURES, BUYER_AID_SCHEMES } from "@/lib/domain/morocco";

const out = {
  auth: AUTHORIZATION_CHAIN.map((a) => ({
    code: a.code, label: a.label, stage: a.stage, appliesTo: a.appliesTo,
    blocksWorks: a.blocksWorks === true, blocksDelivery: a.blocksDelivery === true, regRef: a.regRef ?? "",
  })),
  financing: BUYER_FINANCING_STATUSES.map((f) => ({ code: f.value, label: f.label, factor: f.securityFactor })),
  natures: FACILITY_NATURES.map((n) => ({ code: n.value, label: n.label, requiresWorksCertificate: n.requiresWorksCertificate === true })),
  aid: BUYER_AID_SCHEMES.map((a) => ({ code: a.value, label: a.label })),
};
fs.writeFileSync("tools/excel/_build/referentiels.json", JSON.stringify(out, null, 1));
console.log(`référentiels : ${out.auth.length} autorisations, ${out.financing.length} statuts de financement`);
