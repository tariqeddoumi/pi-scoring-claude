import { describe, it, expect } from "vitest";
import { mapImportRows } from "@/lib/domain/importMapping";

const KNOWN = ["pre_sale_rate", "cash_coverage", "restructured"];
const BOOLS = ["restructured"];

describe("mapping d'import de portefeuille", () => {
  it("mappe les champs canoniques (alias FR) et les KPI reconnus", () => {
    const { rows, errors } = mapImportRows([
      {
        "Référence": "PI-2026-900", "Nom du projet": "Test Résidence", "Promoteur": "Alpha SARL",
        "Ville": "Casablanca", "segment": "moyen_haut", "Crédit": "12 000 000",
        "pre_sale_rate": "42", "cash_coverage": "1,3", "restructured": "non",
      },
    ], KNOWN, BOOLS);
    expect(errors).toHaveLength(0);
    expect(rows[0]!.reference).toBe("PI-2026-900");
    expect(rows[0]!.name).toBe("Test Résidence");
    expect(rows[0]!.promoterName).toBe("Alpha SARL");
    expect(rows[0]!.city).toBe("Casablanca");
    expect(rows[0]!.segment).toBe("moyen_haut");
    expect(rows[0]!.loanAmount).toBe(12_000_000);
    expect(rows[0]!.inputs.pre_sale_rate).toBe(42);
    expect(rows[0]!.inputs.cash_coverage).toBe(1.3);
    expect(rows[0]!.inputs.restructured).toBe(false);
  });

  it("reporte les lignes sans référence/nom/promoteur", () => {
    const { rows, errors } = mapImportRows([{ "Nom": "Sans réf" }], KNOWN);
    expect(rows).toHaveLength(0);
    expect(errors[0]!.message).toMatch(/obligatoires/);
  });

  it("détecte les références en double dans le fichier", () => {
    const r = mapImportRows([
      { reference: "X1", name: "A", promoter_name: "P" },
      { reference: "X1", name: "B", promoter_name: "P" },
    ], KNOWN);
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0]!.message).toMatch(/double/);
  });

  it("ignore les colonnes d'input non reconnues", () => {
    const r = mapImportRows([{ reference: "X1", name: "A", promoter_name: "P", colonne_inconnue: "42" }], KNOWN);
    expect(r.rows[0]!.inputs.colonne_inconnue).toBeUndefined();
  });
});
