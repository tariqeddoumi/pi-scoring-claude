import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prepareDocument } from "@/lib/client/documentParts";
import { coerceValue } from "@/server/services/claudeDocumentReader";
import { WIZARD_STEPS } from "@/lib/wizardFields";

async function pdf(pages: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) doc.addPage().drawText(`Page ${i}`, { x: 50, y: 700, font });
  return new File([(await doc.save()) as Uint8Array<ArrayBuffer>], "bp.pdf", { type: "application/pdf" });
}

describe("préparation des pièces", () => {
  it("PDF court : une seule partie, fichier d'origine", async () => {
    const r = await prepareDocument(await pdf(3));
    expect("parts" in r && r.parts.length).toBe(1);
  });
  it("PDF long : découpé par groupes de pages, numérotation conservée", async () => {
    const r = await prepareDocument(await pdf(200));
    if (!("parts" in r)) throw new Error("non découpé");
    expect(r.parts.length).toBe(3);
    expect(r.parts.map((p) => p.firstPage)).toEqual([1, 91, 181]);
    expect(r.parts[1]!.label).toBe("pages 91 à 180 sur 200");
    const second = await PDFDocument.load(Buffer.from((r.parts[1]!.part as { base64: string }).base64, "base64"));
    expect(second.getPageCount()).toBe(90);
  });
  it("tableur : converti en texte, feuille par feuille", async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Lot", "Prix"], ["A1", 850000]]), "Préventes");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const r = await prepareDocument(new File([buf], "etat des ventes.xlsx"));
    if (!("parts" in r) || r.parts[0]!.part.kind !== "text") throw new Error("non converti");
    expect(r.parts[0]!.part.text).toContain("## Feuille « Préventes »");
    expect(r.parts[0]!.part.text).toContain("A1;850000");
  });
  it("Word : non lu, signalé", async () => {
    const r = await prepareDocument(new File(["x"], "note.docx"));
    expect("unsupported" in r).toBe(true);
  });
});

describe("contrôle des valeurs lues", () => {
  const fields = WIZARD_STEPS.flatMap((s) => s.fields);
  it.each([
    ["pre_sale_rate", "62", 62],
    ["pre_sale_rate", "62,5 %", 62.5],
    ["equity_negative", "true", true],
    ["equity_negative", "oui", null], ["first_rank", "oui", "oui"],
    ["governance_quality", "claire", "claire"],
    ["governance_quality", "excellente", null],
    ["loanAmount", "45 000 000", 45_000_000],
    ["loanAmount", "-3", null],
    ["totalUnits", "120.4", 120],
    ["buildPermitDate", "2026-03-15", "2026-03-15"],
    ["buildPermitDate", "15/03/2026", null],
    ["inconnu", "1", null],
  ])("%s ← %s", (key, raw, expected) => {
    expect(coerceValue(key, raw, fields)).toBe(expected);
  });
});
