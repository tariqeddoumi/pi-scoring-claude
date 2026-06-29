// =====================================================================
//  importMapping.ts — Mapping & validation PURS d'un import de portefeuille
//  (lignes de fichier Excel/CSV → projets + entrées de scoring). Aucune IO :
//  prend des lignes déjà parsées (objets clé→valeur) et renvoie des lignes
//  structurées + un rapport d'erreurs par ligne. Testable unitairement.
// =====================================================================

const deaccent = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Alias d'en-têtes (normalisés) → champ canonique du projet.
const FIELD_ALIASES: Record<string, string[]> = {
  reference: ["reference", "ref", "reference projet", "code projet"],
  name: ["name", "nom", "nom projet", "nom du projet", "projet"],
  promoterName: ["promoter_name", "promoteur", "nom promoteur", "nom du promoteur"],
  city: ["city", "ville"],
  region: ["region"],
  projectType: ["project_type", "type", "type projet", "type de projet"],
  segment: ["segment"],
  zone: ["zone"],
  loanAmount: ["loan_amount", "credit", "montant credit", "montant du credit", "pret"],
  totalCost: ["total_cost", "cout total", "cout", "budget"],
  ownEquity: ["own_equity", "fonds propres", "apport"],
};

const CANON_BY_ALIAS = new Map<string, string>();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const a of aliases) CANON_BY_ALIAS.set(deaccent(a), field);
}

export interface MappedProjectRow {
  rowIndex: number; // 1-based (hors en-tête)
  reference: string;
  name: string;
  promoterName: string;
  city: string | null;
  region: string | null;
  projectType: string | null;
  segment: string | null;
  zone: string | null;
  loanAmount: number | null;
  totalCost: number | null;
  ownEquity: number | null;
  inputs: Record<string, number | string | boolean>;
}

export interface ImportError {
  rowIndex: number;
  message: string;
}

export interface ImportMappingResult {
  rows: MappedProjectRow[];
  errors: ImportError[];
}

const TRUE_SET = new Set(["oui", "yes", "true", "1", "vrai"]);
const FALSE_SET = new Set(["non", "no", "false", "0", "faux"]);

const toStr = (v: unknown): string => (v == null ? "" : String(v).trim());
const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Coerce une cellule d'input selon la clé (booléenne connue, numérique, sinon texte). */
function coerceInput(value: unknown, boolKeys: Set<string>, key: string): number | string | boolean | null {
  const s = toStr(value);
  if (s === "") return null;
  if (boolKeys.has(key)) {
    const d = deaccent(s);
    if (TRUE_SET.has(d)) return true;
    if (FALSE_SET.has(d)) return false;
    return null;
  }
  const n = toNum(s);
  return n !== null ? n : s;
}

/**
 * Mappe des lignes brutes (objets en-tête→valeur) vers des lignes projet
 * structurées. `knownInputKeys` restreint les colonnes d'entrée reconnues
 * (clés du modèle de scoring) ; `boolInputKeys` indique celles à coercer en
 * booléen. Les lignes invalides (réf./nom/promoteur manquants) sont reportées.
 */
export function mapImportRows(
  rawRows: Record<string, unknown>[],
  knownInputKeys: string[],
  boolInputKeys: string[] = [],
): ImportMappingResult {
  const knownSet = new Set(knownInputKeys);
  const boolSet = new Set(boolInputKeys);
  const rows: MappedProjectRow[] = [];
  const errors: ImportError[] = [];
  const seenRefs = new Set<string>();

  rawRows.forEach((raw, i) => {
    const rowIndex = i + 1;
    // Indexe la ligne par champ canonique + collecte les inputs reconnus.
    const fields: Record<string, unknown> = {};
    const inputs: Record<string, number | string | boolean> = {};
    for (const [header, value] of Object.entries(raw)) {
      const norm = deaccent(header);
      const canon = CANON_BY_ALIAS.get(norm);
      if (canon) { fields[canon] = value; continue; }
      if (knownSet.has(header.trim())) {
        const c = coerceInput(value, boolSet, header.trim());
        if (c !== null) inputs[header.trim()] = c;
      } else if (knownSet.has(norm)) {
        const c = coerceInput(value, boolSet, norm);
        if (c !== null) inputs[norm] = c;
      }
    }

    const reference = toStr(fields.reference);
    const name = toStr(fields.name);
    const promoterName = toStr(fields.promoterName);

    if (!reference || !name || !promoterName) {
      errors.push({ rowIndex, message: "Référence, nom et promoteur sont obligatoires." });
      return;
    }
    if (seenRefs.has(reference)) {
      errors.push({ rowIndex, message: `Référence en double dans le fichier : ${reference}.` });
      return;
    }
    seenRefs.add(reference);

    rows.push({
      rowIndex, reference, name, promoterName,
      city: toStr(fields.city) || null,
      region: toStr(fields.region) || null,
      projectType: toStr(fields.projectType) || null,
      segment: toStr(fields.segment) || null,
      zone: toStr(fields.zone) || null,
      loanAmount: toNum(fields.loanAmount),
      totalCost: toNum(fields.totalCost),
      ownEquity: toNum(fields.ownEquity),
      inputs,
    });
  });

  return { rows, errors };
}
