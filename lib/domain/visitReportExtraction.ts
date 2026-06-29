// =====================================================================
//  visitReportExtraction.ts — Extraction de champs structurés depuis le
//  TEXTE d'un rapport de visite (collé ou issu d'un OCR). Première brique de
//  la chaîne « scanner → extraire → charger ».
//
//  Implémentation par défaut : déterministe (heuristiques regex/mots-clés FR),
//  sans dépendance réseau, donc fiable et testable. Elle est volontairement
//  conçue comme un POINT D'INSERTION : tout extracteur respectant l'interface
//  `ReportExtractor` (par ex. un extracteur propulsé par Claude pour les cas
//  complexes / la lecture d'images) peut remplacer ou compléter l'heuristique
//  sans modifier le reste du module. Les champs extraits sont des CANDIDATS à
//  valider par l'utilisateur avant chargement.
// =====================================================================

export interface ExtractedReportFields {
  visitDate: string | null; // ISO (yyyy-mm-dd) si détectée
  observedProgressPct: number | null;
  workforceCount: number | null;
  weatherImpact: boolean;
  qualityIssue: boolean;
  safetyIssue: boolean;
  delayRisk: boolean;
  trancheCode: string | null;
  summary: string | null;
  /** Champs réellement détectés (utile pour signaler la confiance à l'UI). */
  detected: string[];
}

export interface ReportExtractor {
  /** Nom de la stratégie (affiché à l'utilisateur). */
  readonly name: string;
  extract(rawText: string): ExtractedReportFields;
}

/** Une pièce jointe à extraire (rapport scanné : image ou PDF). */
export interface ReportDocument {
  /** Données encodées en base64 (sans préfixe data:). */
  base64: string;
  /** Type MIME, ex. "image/png", "image/jpeg", "application/pdf". */
  mediaType: string;
}

/**
 * Extracteur asynchrone : même contrat que `ReportExtractor` mais capable de
 * lire des documents scannés (images/PDF) en plus du texte, et de s'appuyer
 * sur un service externe (ex. Claude). C'est le point d'insertion de
 * l'extraction IA — l'implémentation vit côté serveur (server/services) pour
 * garder ce module pur et utilisable côté client.
 */
export interface AsyncReportExtractor {
  readonly name: string;
  extract(input: { rawText?: string; documents?: ReportDocument[] }): Promise<ExtractedReportFields>;
}

const EMPTY = (): ExtractedReportFields => ({
  visitDate: null,
  observedProgressPct: null,
  workforceCount: null,
  weatherImpact: false,
  qualityIssue: false,
  safetyIssue: false,
  delayRisk: false,
  trancheCode: null,
  summary: null,
  detected: [],
});

// Mots-clés FR par catégorie d'anomalie (insensible à la casse/accents).
const KEYWORDS = {
  weather: ["intemperie", "intemperies", "pluie", "pluies", "inondation", "tempete", "neige", "canicule"],
  quality: ["malfacon", "non conforme", "non-conforme", "nonconformite", "non conformite", "fissure", "defaut", "reprise", "infiltration"],
  safety: ["securite", "hse", "accident", "epi", "chute", "incident", "danger"],
  delay: ["retard", "decalage", "report", "glissement", "arret de chantier", "arret du chantier", "interruption"],
};

const deaccent = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function detectDate(text: string): string | null {
  // dd/mm/yyyy ou dd-mm-yyyy
  const m1 = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (m1) {
    const [, d, mo, y] = m1;
    const iso = `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
    if (!isNaN(new Date(iso).getTime())) return iso;
  }
  // yyyy-mm-dd
  const m2 = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m2 && !isNaN(new Date(m2[0]).getTime())) return m2[0];
  return null;
}

function detectProgress(text: string): number | null {
  const t = deaccent(text);
  // Cherche un % à proximité d'un terme d'avancement, sinon le premier %.
  const near = t.match(/(?:avancement|progression|realisation|taux)[^%\d]{0,30}(\d{1,3}(?:[.,]\d+)?)\s*%/);
  const generic = t.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  const raw = (near?.[1] ?? generic?.[1]);
  if (raw == null) return null;
  const v = parseFloat(raw.replace(",", "."));
  return v >= 0 && v <= 100 ? v : null;
}

function detectWorkforce(text: string): number | null {
  const t = deaccent(text);
  const m = t.match(/(?:effectif|ouvriers?|personnes?|equipe)[^.\d]{0,20}(\d{1,4})|(\d{1,4})\s*(?:ouvriers?|personnes?)/);
  const raw = m?.[1] ?? m?.[2];
  return raw != null ? parseInt(raw, 10) : null;
}

function detectTranche(text: string): string | null {
  const m = text.match(/\b(?:tranche|phase)\s*[:#]?\s*([A-Za-z]?\d{1,3})\b/i) ?? text.match(/\b(T\d{1,3})\b/);
  return m ? (m[1] ?? m[0]).toUpperCase().replace(/\s+/g, "") : null;
}

function hasAny(t: string, words: string[]): boolean {
  return words.some((w) => t.includes(w));
}

function firstSentence(text: string): string | null {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const m = cleaned.match(/^.{1,200}?[.!?](?:\s|$)/);
  return (m ? m[0] : cleaned.slice(0, 200)).trim();
}

/** Extracteur déterministe par heuristiques (par défaut). */
export const heuristicExtractor: ReportExtractor = {
  name: "Heuristique (mots-clés)",
  extract(rawText: string): ExtractedReportFields {
    const out = EMPTY();
    if (!rawText || !rawText.trim()) return out;
    const t = deaccent(rawText);
    const detected: string[] = [];

    out.visitDate = detectDate(rawText);
    if (out.visitDate) detected.push("visitDate");

    out.observedProgressPct = detectProgress(rawText);
    if (out.observedProgressPct != null) detected.push("observedProgressPct");

    out.workforceCount = detectWorkforce(rawText);
    if (out.workforceCount != null) detected.push("workforceCount");

    out.trancheCode = detectTranche(rawText);
    if (out.trancheCode) detected.push("trancheCode");

    out.weatherImpact = hasAny(t, KEYWORDS.weather);
    if (out.weatherImpact) detected.push("weatherImpact");
    out.qualityIssue = hasAny(t, KEYWORDS.quality);
    if (out.qualityIssue) detected.push("qualityIssue");
    out.safetyIssue = hasAny(t, KEYWORDS.safety);
    if (out.safetyIssue) detected.push("safetyIssue");
    out.delayRisk = hasAny(t, KEYWORDS.delay);
    if (out.delayRisk) detected.push("delayRisk");

    out.summary = firstSentence(rawText);
    if (out.summary) detected.push("summary");

    out.detected = detected;
    return out;
  },
};

/** Point d'entrée : extrait les champs candidats d'un rapport collé/scanné. */
export function extractReportFields(
  rawText: string,
  extractor: ReportExtractor = heuristicExtractor,
): ExtractedReportFields {
  return extractor.extract(rawText);
}
