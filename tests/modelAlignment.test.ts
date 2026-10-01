import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runScoring } from "@/server/engines/scoringEngine";
import { CURRENT_PROMOTION_MODEL } from "@/lib/domain/models/current";
import { PROMOTION_SCORING_MODEL_V4 } from "@/lib/domain/models/piPromotionV4";
import { modelInputFields, extendSchemaWithModel, uncoveredModelFields } from "@/lib/modelInputs";
import { WIZARD_STEPS } from "@/lib/wizardFields";
import { INPUT_LABELS } from "@/lib/inputLabels";
import { scoringInputsSchema } from "@/lib/validation";
import { TEMPLATE_COLUMNS } from "@/lib/domain/importTemplate";
import type { ProjectInputs, RegulatoryClassCode, ScoringModelConfig } from "@/lib/domain/types";

// Alignement base ↔ code ↔ écrans pour le modèle PUBLIÉ (version courante, v5.0.0).
// L'instantané prisma/models/PI_PROMOTION_v5.0.0.json est celui publié en base
// de production : si le modèle publié évolue, l'instantané et ces tests
// doivent évoluer avec lui.

const M = CURRENT_PROMOTION_MODEL;
const fields = modelInputFields(M);
const wizardFields = WIZARD_STEPS.flatMap((s) => s.fields);
const wizardKeys = new Set(wizardFields.map((f) => f.key));

describe("Modèle courant versionné (instantané de la base)", () => {
  it("structure publiée : 4 domaines, 37 critères, 18 alertes, poids à 100 %", () => {
    expect(M.version).toBe("v5.0.0");
    expect(M.scoreScale).toBe(10);
    expect(M.domains.map((d) => d.code)).toEqual(["D1", "D2", "D3", "D4"]);
    expect(M.domains.flatMap((d) => d.criteria)).toHaveLength(37);
    expect(M.redFlags).toHaveLength(18);
    const total = M.domains.reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(1, 9);
    for (const d of M.domains) {
      expect(d.criteria.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 9);
    }
    expect(M.decisionThresholds).toEqual({ go: 75, goWithConditions: 65, watchList: 50 });
  });

  it("reproduit les 26 cas de référence de l'outil Excel (même moteur, même modèle)", () => {
    const file = path.resolve(__dirname, "../tools/excel/_build/vectors.json");
    const vectors = JSON.parse(fs.readFileSync(file, "utf8")) as {
      id: string; inputs: ProjectInputs; segment: string; zone: string; cls: string;
      expected: Record<string, any>;
    }[];
    expect(vectors).toHaveLength(26);
    const DEFAULT = ["PRE_DOUTEUX", "DOUTEUX", "COMPROMIS", "CTX"];
    for (const v of vectors) {
      const cls = (v.cls || undefined) as RegulatoryClassCode | undefined;
      const r = runScoring({
        model: M, inputs: v.inputs, segment: v.segment || null, zone: v.zone || null,
        regulatoryClass: cls, classBlocksGo: cls === "CTX", isDefault: cls ? DEFAULT.includes(cls) : false,
        dataQualityBlocking: !cls, extraCriticalKeys: ["dpd_days"],
      });
      const e = v.expected;
      expect(r.scoreFinal, v.id).toBeCloseTo(e.scoreFinal, 2);
      expect(r.decision, v.id).toBe(e.decision);
      expect(r.internalClass, v.id).toBe(e.internalClass);
      expect(r.totalMalus, v.id).toBe(e.totalMalus);
      expect(r.dataIncomplete, v.id).toBe(e.dataIncomplete);
      expect(r.economicScore, v.id).toBeCloseTo(e.economicScore, 2);
      expect(r.guaranteeScore, v.id).toBe(e.guaranteeScore);
      expect(r.redFlags.map((f) => f.code).sort(), v.id).toEqual([...e.flags].sort());
      for (const d of r.domains) expect(d.score, `${v.id} ${d.domainCode}`).toBeCloseTo(e.domains[d.domainCode], 2);
    }
  });
});

describe("v5 = v4 enrichie (aucune règle v4 modifiée hors poids)", () => {
  it("conserve les barèmes, modalités et alertes de la v4", () => {
    const v4 = PROMOTION_SCORING_MODEL_V4;
    for (const d of v4.domains) for (const c of d.criteria) {
      const n = M.domains.find((x) => x.code === d.code)!.criteria.find((x) => x.code === c.code)!;
      expect(n.inputKey, c.code).toBe(c.inputKey);
      expect(n.ranges, c.code).toEqual(c.ranges);
      expect(n.options, c.code).toEqual(c.options);
      expect(n.isGate, c.code).toBe(c.isGate);
    }
    for (const r of v4.redFlags) expect(M.redFlags.find((x) => x.code === r.code), r.code).toEqual(r);
    expect(M.domains.map((d) => d.weight)).toEqual(v4.domains.map((d) => d.weight));
  });
});

describe("Saisie alignée sur le modèle publié", () => {
  it("toute clé du modèle (critère ou alerte) est saisissable dans le wizard", () => {
    const missing = fields.filter((f) => !wizardKeys.has(f.key)).map((f) => `${f.code}:${f.key}`);
    expect(missing).toEqual([]);
    expect(uncoveredModelFields(M, wizardKeys)).toEqual([]);
  });

  it("toute clé du modèle a un libellé, un contrôle de validation et une colonne d'import", () => {
    const headers = new Set(TEMPLATE_COLUMNS.map((c) => c.header));
    for (const f of fields) {
      expect(INPUT_LABELS[f.key], `libellé ${f.key}`).toBeTruthy();
      expect(f.key in scoringInputsSchema.shape, `validation ${f.key}`).toBe(true);
      expect(headers.has(f.key), `import ${f.key}`).toBe(true);
    }
  });

  it("les modalités des critères qualitatifs sont identiques partout (base, wizard, validation, import)", () => {
    for (const f of fields.filter((x) => x.kind === "select")) {
      const expected = f.options!.map((o) => o.value).sort();
      const wiz = wizardFields.find((w) => w.key === f.key)!;
      expect(wiz.type, f.key).toBe("select");
      expect(wiz.options!.map((o) => o.value).sort(), `wizard ${f.key}`).toEqual(expected);
      for (const v of expected) {
        expect(scoringInputsSchema.shape[f.key as keyof typeof scoringInputsSchema.shape].safeParse(v).success, `zod ${f.key}=${v}`).toBe(true);
      }
      expect(scoringInputsSchema.shape[f.key as keyof typeof scoringInputsSchema.shape].safeParse("valeur_inconnue").success).toBe(false);
      const col = TEMPLATE_COLUMNS.find((c) => c.header === f.key)!;
      expect(col.allowed.split(" | ").sort(), `import ${f.key}`).toEqual(expected);
    }
  });

  it("les clés booléennes des alertes sont des booléens à la saisie", () => {
    for (const f of fields.filter((x) => x.kind === "bool")) {
      expect(wizardFields.find((w) => w.key === f.key)!.type, f.key).toBe("bool");
    }
  });
});

describe("Validation : une omission n'est jamais convertie en valeur favorable", () => {
  it("champ vide → absent (null), jamais 0 ni « Non »", () => {
    const r = scoringInputsSchema.safeParse({ funding_gap_pct: "", construction_delay_months: "", equity_negative: "", governance_quality: "" });
    expect(r.success).toBe(true);
    expect(r.data!.funding_gap_pct).toBeNull();
    expect(r.data!.construction_delay_months).toBeNull();
    expect(r.data!.equity_negative).toBeNull();
    expect(r.data!.governance_quality).toBeNull();
  });

  it("brouillon partiel accepté ; aucune valeur par défaut fabriquée", () => {
    const r = scoringInputsSchema.safeParse({ cash_coverage: 1.2 });
    expect(r.success).toBe(true);
    expect(r.data!.construction_delay_months).toBeNull();
    expect(r.data!.project_stopped_months).toBeNull();
    expect(r.data!.funding_gap_persistent).toBeNull();
  });

  it("booléens : « false » n'est plus lu comme vrai ; oui/non acceptés", () => {
    const r = scoringInputsSchema.safeParse({ restructuring_viable: "false", equity_negative: "oui", release_underpriced: "non" });
    expect(r.success).toBe(true);
    expect(r.data!.restructuring_viable).toBe(false);
    expect(r.data!.equity_negative).toBe(true);
    expect(r.data!.release_underpriced).toBe(false);
  });

  it("nombres : virgule décimale acceptée, texte non numérique refusé", () => {
    expect(scoringInputsSchema.safeParse({ cash_coverage: "1,15" }).data?.cash_coverage).toBe(1.15);
    expect(scoringInputsSchema.safeParse({ cash_coverage: "abc" }).success).toBe(false);
  });
});

describe("Modèle administrable : une clé ajoutée devient saisissable sans redéploiement", () => {
  const extended: ScoringModelConfig = {
    ...M,
    domains: M.domains.map((d, i) =>
      i === 0
        ? {
            ...d,
            criteria: [
              ...d.criteria,
              {
                code: "D1C9", name: "Nouveau critère", type: "QUAL", weight: 0, inputKey: "new_governance_flag",
                isGate: false, options: [{ value: "a", label: "A", score: 1 }, { value: "b", label: "B", score: 10 }],
              },
            ],
          }
        : d,
    ),
    redFlags: [
      ...M.redFlags,
      { code: "RF_NEW", name: "Nouvelle alerte", rule: { clause: { key: "new_alert_flag", op: "isTrue" } }, severity: "LOW", impactDomains: ["D5"], malus: 0, mitigable: true },
    ],
  };

  it("les nouvelles clés sont détectées et validées selon leur type", () => {
    const extra = uncoveredModelFields(extended, wizardKeys);
    expect(extra.map((f) => f.key)).toEqual(["new_governance_flag", "new_alert_flag"]);
    const schema = extendSchemaWithModel(scoringInputsSchema, extended);
    expect(schema.safeParse({ new_governance_flag: "b", new_alert_flag: "oui" }).success).toBe(true);
    expect(schema.safeParse({ new_governance_flag: "z" }).success).toBe(false);
  });
});
