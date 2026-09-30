// Résultats attendus du stress test sur le dossier d'exemple du classeur (cas T06,
// segment moyen_haut, zone casa_centre, classe SAIN), calculés par les moteurs
// de l'application : sert à vérifier le portage VBA des chocs (modStress).
import fs from "node:fs";
import { runScoring } from "@/server/engines/scoringEngine";
import { applyStress, STRESS_SCENARIOS } from "@/lib/domain/stress";
import { PROMOTION_SCORING_MODEL_V4 } from "@/lib/domain/models/piPromotionV4";

const D = "tools/excel/_build/";
const vec = JSON.parse(fs.readFileSync(D + "vectors.json", "utf8")) as { id: string; inputs: Record<string, any> }[];
const inputs = vec.find((v) => v.id === "T06")!.inputs;
const score = (i: Record<string, any>) =>
  runScoring({ model: PROMOTION_SCORING_MODEL_V4, inputs: i, segment: "moyen_haut", zone: "casa_centre",
    regulatoryClass: "SAIN", classBlocksGo: false, isDefault: false, extraCriticalKeys: ["dpd_days"] });
const base = score(inputs);
const out = { base: { scoreFinal: base.scoreFinal, decision: base.decision },
  scenarios: STRESS_SCENARIOS.map((s) => { const r = score(applyStress(inputs, s.shock)); return { key: s.key, scoreFinal: r.scoreFinal, decision: r.decision }; }) };
fs.writeFileSync(D + "stress_expected.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
