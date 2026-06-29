import { describe, it, expect } from "vitest";
import { TEMPLATE_COLUMNS, buildTemplateAoa } from "@/lib/domain/importTemplate";
import { mapImportRows } from "@/lib/domain/importMapping";
import { INPUT_LABELS } from "@/lib/inputLabels";

// Clés booléennes reconnues par l'import (miroir de server/actions/imports.ts).
const BOOLS = [
  "funding_gap_persistent", "equity_negative", "commercialization_below_50_1y",
  "construction_delay_over_1y", "project_stopped_over_1y", "finished_2y_no_sales",
  "judicial_recovery", "admin_problems_over_1y", "bp_significant_gap",
  "seizure_notice", "financials_late_7m", "negative_credit_bureau", "financials_unavailable",
  "restructuring_viable", "second_restructuring_in_observation",
];

const META_HEADERS = new Set([
  "Référence", "Nom du projet", "Promoteur", "Ville", "Région", "Type de projet",
  "Segment", "Zone", "Crédit", "Coût total", "Fonds propres",
]);

describe("modèle de fichier d'import", () => {
  it("chaque colonne d'entrée correspond à une clé reconnue par l'import", () => {
    const known = new Set(Object.keys(INPUT_LABELS));
    const inputCols = TEMPLATE_COLUMNS.filter((c) => !META_HEADERS.has(c.header));
    expect(inputCols.length).toBeGreaterThan(0);
    for (const col of inputCols) expect(known.has(col.header)).toBe(true);
  });

  it("la feuille Projets a une ligne d'exemple alignée sur les en-têtes", () => {
    const { projets } = buildTemplateAoa();
    expect(projets).toHaveLength(2);
    expect(projets[1]!.length).toBe(projets[0]!.length);
    expect(projets[0]!.length).toBe(TEMPLATE_COLUMNS.length);
  });

  it("la ligne d'exemple passe le mapping d'import sans erreur", () => {
    const { projets } = buildTemplateAoa();
    const [headers, example] = projets;
    const raw = Object.fromEntries(headers!.map((h, i) => [h, String(example![i])]));
    const { rows, errors } = mapImportRows([raw], Object.keys(INPUT_LABELS), BOOLS);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.reference).toBe("PI-2026-001");
    expect(rows[0]!.promoterName).toBe("Promoteur Exemple SARL");
    // KPI numériques et catégoriels correctement coercés.
    expect(rows[0]!.inputs.pre_sale_rate).toBe(45);
    expect(rows[0]!.inputs.first_rank).toBe("oui");
    expect(rows[0]!.inputs.equity_negative).toBe(false);
    expect(rows[0]!.inputs.seizure_notice).toBe(false);
  });
});
