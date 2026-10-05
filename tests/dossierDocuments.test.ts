import { describe, it, expect } from "vitest";
import {
  DOSSIER_DOCUMENTS, DOSSIER_DOC_DEFS, buildChecklist, classifyByFileName, dossierStage,
  formatMissingList, mergeExtractions, type PieceRecord,
} from "@/lib/domain/dossierDocuments";
import { WIZARD_STEPS } from "@/lib/wizardFields";

const piece = (docType: string, status: PieceRecord["status"] = "RECU"): PieceRecord => ({
  id: docType, docType, status, fileName: `${docType}.pdf`, source: "manuel", createdAt: new Date(0),
});

describe("référentiel des pièces", () => {
  it("codes uniques", () => {
    expect(DOSSIER_DOC_DEFS.size).toBe(DOSSIER_DOCUMENTS.length);
  });
  it("chaque donnée renseignée existe dans la saisie ou la fiche projet", () => {
    const wizard = new Set(WIZARD_STEPS.flatMap((s) => s.fields.map((f) => f.key)));
    const project = new Set(["loanAmount", "totalCost", "ownEquity", "totalUnits", "landAreaSqm", "builtAreaSqm", "landTitleRef", "buildPermitRef", "buildPermitDate", "startDate", "expectedDeliveryDate"]);
    for (const d of DOSSIER_DOCUMENTS) for (const k of d.informs) expect(wizard.has(k) || project.has(k), `${d.code} → ${k}`).toBe(true);
  });
});

describe("classement par nom de fichier", () => {
  it.each([
    ["Business_Plan_Residence_Atlas.pdf", "business_plan"],
    ["Permis de construire - lot 3.pdf", "permis_construire"],
    ["certificat-de-propriété TF 12345.pdf", "certificat_propriete"],
    ["etat des réservations sept.xlsx", "etat_preventes"],
    ["Bilans 2023 2024.pdf", "etats_financiers"],
    ["Statuts SARL.pdf", "statuts"],
    ["Rapport d'expertise.pdf", "expertise_terrain"],
    ["Note de renseignement.pdf", "note_renseignement"],
    ["Situation de travaux n°4.pdf", "situation_travaux"],
  ])("%s → %s", (name, code) => {
    expect(classifyByFileName(name)).toBe(code);
  });
  it("aucun indice → null", () => {
    expect(classifyByFileName("scan_0001.pdf")).toBeNull();
  });
  it("ne confond pas un mot contenu dans un autre", () => {
    expect(classifyByFileName("tfrance.pdf")).toBeNull();
  });
});

describe("jalon du dossier", () => {
  it("dépend du circuit et des tirages", () => {
    expect(dossierStage("DRAFT")).toBe("ETUDE");
    expect(dossierStage("COMMITTEE")).toBe("OCTROI");
    expect(dossierStage("APPROVED")).toBe("SIGNATURE");
    expect(dossierStage("APPROVED", 1)).toBe("TIRAGE");
  });
});

describe("liste des pièces", () => {
  it("manquantes à l'étude, à prévoir ensuite, reçues et non applicables", () => {
    const c = buildChecklist([piece("business_plan"), piece("etude_marche", "NON_APPLICABLE")], { programKind: "CONSTRUCTION", stage: "ETUDE" });
    const st = (code: string) => c.items.find((i) => i.def.code === code)?.state;
    expect(st("business_plan")).toBe("recu");
    expect(st("etude_marche")).toBe("non_applicable");
    expect(st("statuts")).toBe("manquant");
    expect(st("marche_travaux")).toBe("a_prevoir");
    expect(st("permis_habiter")).toBe("a_prevoir");
    expect(st("structure_groupe")).toBe("facultatif");
    expect(st("autorisation_lotir")).toBeUndefined(); // lotissement seulement
    expect(c.missingNow.every((i) => i.def.stage === "ETUDE")).toBe(true);
    expect(c.received).toBe(1);
  });
  it("au tirage, toutes les pièces non reçues avant le tirage sont manquantes", () => {
    const c = buildChecklist([], { programKind: "LOTISSEMENT", stage: "TIRAGE" });
    const codes = c.missingNow.map((i) => i.def.code);
    expect(codes).toContain("assurance_trc");
    expect(codes).toContain("autorisation_lotir");
    expect(codes).not.toContain("permis_construire");
    expect(codes).not.toContain("reception_provisoire");
  });
  it("texte à copier", () => {
    const c = buildChecklist([], { programKind: "CONSTRUCTION", stage: "ETUDE" });
    const t = formatMissingList(c, { reference: "PI-001", name: "Atlas" });
    expect(t).toMatch(/^Dossier PI-001 — Atlas/);
    expect(t).toContain("Pièces à fournir pour l'étude :");
    expect(t).toContain("- Statuts de la société");
    expect(t).toContain("Pièces à prévoir pour la suite :");
    expect(t).not.toContain("Permis d'habiter");
  });
});

describe("fusion des valeurs lues", () => {
  it("regroupe les sources, signale les conflits et la valeur inchangée", () => {
    const c = mergeExtractions([
      { fileName: "bp.pdf", docType: "business_plan", fields: [{ key: "gross_margin_pct", value: 22, page: 4, quote: "marge 22 %" }, { key: "ltc", value: 65, page: 5, quote: "LTC 65 %" }] },
      { fileName: "note.pdf", docType: "note_presentation", fields: [{ key: "gross_margin_pct", value: 22.001, page: 1, quote: "22 %" }, { key: "ltc", value: 70, page: 2, quote: "70 %" }] },
      { fileName: "prev.xlsx", docType: "etat_preventes", fields: [{ key: "ltc", value: 70, page: null, quote: "" }] },
    ], { gross_margin_pct: 22 }, ["ltc", "gross_margin_pct"]);
    expect(c.map((x) => x.key)).toEqual(["ltc", "gross_margin_pct"]);
    expect(c[0]).toMatchObject({ conflict: true, proposed: 70, unchanged: false });
    expect(c[0]!.options[0]!.sources).toHaveLength(2);
    expect(c[1]).toMatchObject({ conflict: false, proposed: 22, unchanged: true });
    expect(c[1]!.options[0]!.sources.map((s) => s.fileName)).toEqual(["bp.pdf", "note.pdf"]);
  });
});
