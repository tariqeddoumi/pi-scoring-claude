// Préparation des pièces dans le navigateur, avant lecture : chaque fichier
// devient une ou plusieurs parties envoyées une par une au serveur (sous la
// limite de taille d'une requête). Gros PDF découpés par groupes de pages,
// photos réduites, tableurs convertis en texte. Aucun fichier n'est stocké.

import type { DocumentPart } from "@/server/services/claudeDocumentReader";

export interface PreparedPart {
  part: DocumentPart;
  /** « pages 41 à 80 » quand le PDF est découpé. */
  label?: string;
  /** Première page de la partie dans le document d'origine. */
  firstPage: number;
}

export type Prepared = { parts: PreparedPart[] } | { unsupported: string };

const PART_BYTES = 3 * 1024 * 1024; // ≈ 4 Mo une fois encodé
const MAX_PAGES = 90;
const IMAGE_MAX_SIDE = 2000;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

async function preparePdf(file: File): Promise<Prepared> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { PDFDocument } = await import("pdf-lib");
  let src;
  try {
    src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    if (bytes.length <= PART_BYTES) return { parts: [{ part: { kind: "pdf", base64: toBase64(bytes) }, firstPage: 1 }] };
    return { unsupported: "PDF illisible ou protégé, trop volumineux pour être envoyé tel quel" };
  }
  const total = src.getPageCount();
  if (bytes.length <= PART_BYTES && total <= MAX_PAGES) {
    return { parts: [{ part: { kind: "pdf", base64: toBase64(bytes) }, firstPage: 1 }] };
  }
  const parts: PreparedPart[] = [];
  const build = async (from: number, to: number): Promise<void> => {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, Array.from({ length: to - from }, (_, i) => from + i));
    pages.forEach((p) => out.addPage(p));
    const saved = await out.save();
    if (saved.length > PART_BYTES * 1.3 && to - from > 1) {
      const mid = from + Math.floor((to - from) / 2);
      await build(from, mid);
      await build(mid, to);
      return;
    }
    if (saved.length > PART_BYTES * 1.4) throw new Error(`page ${from + 1} trop volumineuse`);
    parts.push({ part: { kind: "pdf", base64: toBase64(saved) }, firstPage: from + 1, label: `pages ${from + 1} à ${to} sur ${total}` });
  };
  const perPart = Math.max(1, Math.min(MAX_PAGES, Math.floor(PART_BYTES / (bytes.length / total))));
  try {
    for (let from = 0; from < total; from += perPart) await build(from, Math.min(total, from + perPart));
  } catch (e) {
    return { unsupported: e instanceof Error ? e.message : "découpage impossible" };
  }
  return { parts };
}

async function prepareImage(file: File): Promise<Prepared> {
  const types = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
  const type = types.find((t) => t === file.type);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { unsupported: "image illisible (format HEIC ? exportez en JPEG)" };
  const side = Math.max(bitmap.width, bitmap.height);
  if (type && file.size <= 1.5 * 1024 * 1024 && side <= IMAGE_MAX_SIDE) {
    return { parts: [{ part: { kind: "image", mediaType: type, base64: toBase64(new Uint8Array(await file.arrayBuffer())) }, firstPage: 1 }] };
  }
  const scale = Math.min(1, IMAGE_MAX_SIDE / side);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) return { unsupported: "image illisible" };
  return { parts: [{ part: { kind: "image", mediaType: "image/jpeg", base64: toBase64(new Uint8Array(await blob.arrayBuffer())) }, firstPage: 1 }] };
}

async function prepareSheet(file: File): Promise<Prepared> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const text = wb.SheetNames.map((n) => `## Feuille « ${n} »\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!, { FS: ";", blankrows: false })}`).join("\n\n");
  return { parts: [{ part: { kind: "text", text: text.slice(0, 400_000) }, firstPage: 1 }] };
}

/** Découpe / convertit un fichier en parties lisibles. */
export async function prepareDocument(file: File): Promise<Prepared> {
  const e = ext(file.name);
  if (file.type === "application/pdf" || e === "pdf") return preparePdf(file);
  if (file.type.startsWith("image/")) return prepareImage(file);
  if (["xlsx", "xlsm", "xls", "ods", "csv"].includes(e)) return prepareSheet(file);
  if (["txt", "md"].includes(e) || file.type.startsWith("text/")) {
    return { parts: [{ part: { kind: "text", text: (await file.text()).slice(0, 400_000) }, firstPage: 1 }] };
  }
  if (["doc", "docx", "odt"].includes(e)) return { unsupported: "document Word : contenu non lu (enregistrez-le en PDF pour le faire lire)" };
  return { unsupported: "format non lu" };
}
