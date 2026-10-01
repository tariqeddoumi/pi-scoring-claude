// =====================================================================
//  programmeV5.ts — Dérivations du modèle PI_PROMOTION v5 (diagnostic du
//  1er octobre 2026). Cinq thèmes demandés par le métier :
//
//   1. Régionalité : tension du marché immobilier de la RÉGION du programme,
//      appréciée et datée dans un référentiel administrable (aucune valeur
//      inventée : sans appréciation, la donnée reste absente).
//   2. Financement d'une TRANCHE (lot) et non du programme entier : les
//      indicateurs de commercialisation, de tirage et de désengagement sont
//      calculés sur le PÉRIMÈTRE FINANCÉ ; la dépendance de la tranche à des
//      ouvrages communs est notée.
//   3. Programme MIXTE (appartements, villas, commerces, bureaux, hôtel…) :
//      part du chiffre d'affaires en produits à écoulement lent.
//   4. ÉQUIPEMENTS exigés par la commune ou le cahier des charges (mosquée,
//      école, voirie…) : coût non budgété et retard d'un équipement qui
//      conditionne la réception.
//   5. Suivi des DÉBLOCAGES selon le calendrier : tirages en avance sur
//      l'avancement certifié, plan de tirage en retard.
//  + taux de désistement des réservations.
//
//  Logique PURE et déterministe : aucune dépendance base. Une donnée non
//  calculable n'est PAS renvoyée (invariant « une omission n'améliore jamais
//  la décision » : le moteur applique alors la note plancher).
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;
const toTime = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : null);

// ---------------------------------------------------------------------
//  1. Régionalité
// ---------------------------------------------------------------------

/** Codes des 12 régions administratives (découpage 2015) et libellés. */
export const REGION_CODES: Record<string, string> = {
  tanger_tetouan_al_hoceima: "Tanger-Tétouan-Al Hoceïma",
  oriental: "L'Oriental",
  fes_meknes: "Fès-Meknès",
  rabat_sale_kenitra: "Rabat-Salé-Kénitra",
  beni_mellal_khenifra: "Béni Mellal-Khénifra",
  casablanca_settat: "Casablanca-Settat",
  marrakech_safi: "Marrakech-Safi",
  draa_tafilalet: "Drâa-Tafilalet",
  souss_massa: "Souss-Massa",
  guelmim_oued_noun: "Guelmim-Oued Noun",
  laayoune_sakia_el_hamra: "Laâyoune-Sakia El Hamra",
  dakhla_oued_ed_dahab: "Dakhla-Oued Ed-Dahab",
};

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Ramène une région saisie (code ou libellé, avec ou sans accents) à son code ; null si inconnue. */
export function normalizeRegion(value: string | null | undefined): string | null {
  if (!value) return null;
  const f = fold(value);
  if (f in REGION_CODES) return f;
  for (const [code, label] of Object.entries(REGION_CODES)) if (fold(label) === f) return code;
  return null;
}

export type MarketTension = "porteur" | "equilibre" | "surstock";
export const MARKET_TENSIONS: { value: MarketTension; label: string }[] = [
  { value: "surstock", label: "Marché en surstock (écoulement lent, prix sous pression)" },
  { value: "equilibre", label: "Marché équilibré" },
  { value: "porteur", label: "Marché porteur (demande soutenue)" },
];

/** Appréciation d'une région dans le référentiel REGIONAL_MARKET (config JSON). */
export interface RegionalMarketDef {
  region: string;
  /** Appréciation par segment du modèle (social, intermediaire, moyen_haut…). */
  segments: Partial<Record<string, MarketTension>>;
  /** Appréciation par défaut quand le segment n'est pas renseigné. */
  default?: MarketTension;
  /** Date de l'appréciation (AAAA-MM ou AAAA-MM-JJ). */
  assessedAt?: string;
  source?: string;
}

const isTension = (v: unknown): v is MarketTension => v === "porteur" || v === "equilibre" || v === "surstock";

export function parseRegionalMarket(code: string, config: unknown): RegionalMarketDef | null {
  const region = normalizeRegion(code);
  if (!region) return null;
  const c = config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
  const segs: Partial<Record<string, MarketTension>> = {};
  const raw = c.segments && typeof c.segments === "object" ? (c.segments as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(raw)) if (isTension(v)) segs[k] = v;
  return {
    region,
    segments: segs,
    default: isTension(c.default) ? c.default : undefined,
    assessedAt: typeof c.assessedAt === "string" ? c.assessedAt : undefined,
    source: typeof c.source === "string" ? c.source : undefined,
  };
}

export interface RegionalTensionResult {
  tension?: MarketTension;
  region: string | null;
  assessedAt?: string;
  /** Appréciation de plus de 12 mois (à actualiser). */
  stale: boolean;
  reason: string;
}

/** Tension du marché régional pour un projet (région + segment). */
export function regionalTensionFor(
  regionValue: string | null | undefined,
  segment: string | null | undefined,
  defs: readonly RegionalMarketDef[],
  now: Date = new Date(),
): RegionalTensionResult {
  const region = normalizeRegion(regionValue);
  if (!region) return { region: null, stale: false, reason: "Région du projet non renseignée ou non reconnue." };
  const def = defs.find((d) => d.region === region);
  if (!def) return { region, stale: false, reason: `Aucune appréciation du marché pour ${REGION_CODES[region]} dans le référentiel.` };
  const tension = (segment ? def.segments[segment] : undefined) ?? def.default;
  const at = def.assessedAt ? toTime(def.assessedAt.length === 7 ? `${def.assessedAt}-01` : def.assessedAt) : null;
  const stale = at != null && now.getTime() - at > 365 * 24 * 3600 * 1000;
  if (!tension) return { region, assessedAt: def.assessedAt, stale, reason: `Pas d'appréciation pour le segment « ${segment ?? "—"} » en ${REGION_CODES[region]}.` };
  return {
    tension, region, assessedAt: def.assessedAt, stale,
    reason: `${REGION_CODES[region]}${segment ? ` · ${segment}` : ""} : ${MARKET_TENSIONS.find((t) => t.value === tension)!.label}` +
      `${def.assessedAt ? ` (appréciation ${def.assessedAt}${stale ? ", à actualiser" : ""})` : ""}.`,
  };
}

// ---------------------------------------------------------------------
//  2. Périmètre financé (tranche / lot)
// ---------------------------------------------------------------------

export interface TrancheView {
  id: string;
  financed: boolean;
  progressPct?: number | null;
  budget?: number | null;
}

export interface FinancedPerimeter {
  /** Tranches financées ; null = programme entier. */
  trancheIds: Set<string> | null;
  wholeProgramme: boolean;
  label: string;
}

/**
 * Périmètre financé : tranches marquées « financée » ou rattachées à une
 * facilité. Sans aucune indication, le programme entier est financé
 * (comportement historique, rétro-compatible).
 */
export function financedPerimeter(tranches: TrancheView[], facilityTrancheIds: (string | null | undefined)[]): FinancedPerimeter {
  const ids = new Set<string>([
    ...tranches.filter((t) => t.financed).map((t) => t.id),
    ...facilityTrancheIds.filter((x): x is string => !!x),
  ]);
  if (ids.size === 0 || ids.size === tranches.length) {
    return { trancheIds: null, wholeProgramme: true, label: "Programme entier" };
  }
  return { trancheIds: ids, wholeProgramme: false, label: `${ids.size} tranche(s) financée(s) sur ${tranches.length}` };
}

export const inPerimeter = (p: FinancedPerimeter, trancheId: string | null | undefined) =>
  p.trancheIds === null || (!!trancheId && p.trancheIds.has(trancheId));

export type TrancheDependency = "programme_entier" | "autonome" | "dependante_financee" | "dependante_non_financee";
export const TRANCHE_DEPENDENCIES: { value: TrancheDependency; label: string }[] = [
  { value: "dependante_non_financee", label: "Tranche dépendante d'ouvrages communs NON financés (VRD, accès, raccordements)" },
  { value: "dependante_financee", label: "Tranche dépendante d'ouvrages communs financés ou réalisés" },
  { value: "autonome", label: "Tranche autonome (accès, VRD et raccordements propres)" },
  { value: "programme_entier", label: "Financement du programme entier" },
];

/** Avancement physique du périmètre (moyenne pondérée par budget, sinon simple). */
export function perimeterProgress(tranches: TrancheView[], p: FinancedPerimeter): number | null {
  const ts = tranches.filter((t) => inPerimeter(p, t.id) && t.progressPct != null);
  if (ts.length === 0) return null;
  const wsum = ts.reduce((s, t) => s + (t.budget && t.budget > 0 ? t.budget : 0), 0);
  if (wsum > 0) return round2(ts.reduce((s, t) => s + (t.progressPct ?? 0) * (t.budget && t.budget > 0 ? t.budget : 0), 0) / wsum);
  return round2(ts.reduce((s, t) => s + (t.progressPct ?? 0), 0) / ts.length);
}

// ---------------------------------------------------------------------
//  3. Programme mixte et 6. désistements
// ---------------------------------------------------------------------

export type ProductClass = "RESIDENTIEL" | "COMMERCIAL" | "HOTELIER" | "AUTRE";
export const PRODUCT_CLASS_OF: Record<string, ProductClass> = {
  APPARTEMENT: "RESIDENTIEL", VILLA: "RESIDENTIEL", TERRAIN: "RESIDENTIEL",
  COMMERCE: "COMMERCIAL", BUREAU: "COMMERCIAL", HOTEL: "HOTELIER", AUTRE: "AUTRE",
};
export const PRODUCT_CLASS_LABELS: Record<ProductClass, string> = {
  RESIDENTIEL: "Résidentiel (appartements, villas, lots de terrain)",
  COMMERCIAL: "Commerces et bureaux",
  HOTELIER: "Hôtelier (cession en bloc ou exploitation)",
  AUTRE: "Autres",
};

export interface UnitMixView {
  type: string;
  status: string;
  price: number | null | undefined;
  trancheId?: string | null;
}

export interface ProgrammeComposition {
  totalValue: number;
  byClass: Record<ProductClass, { units: number; value: number; sharePct: number }>;
  /** Part du CA en produits à écoulement lent (commerces, bureaux, hôtel). */
  slowLiquiditySharePct?: number;
  mixed: boolean;
}

export function programmeComposition(units: UnitMixView[]): ProgrammeComposition {
  const by = { RESIDENTIEL: { units: 0, value: 0, sharePct: 0 }, COMMERCIAL: { units: 0, value: 0, sharePct: 0 }, HOTELIER: { units: 0, value: 0, sharePct: 0 }, AUTRE: { units: 0, value: 0, sharePct: 0 } };
  for (const u of units) {
    const k = PRODUCT_CLASS_OF[u.type] ?? "AUTRE";
    by[k].units += 1;
    by[k].value += Math.max(0, u.price ?? 0);
  }
  const total = Object.values(by).reduce((s, x) => s + x.value, 0);
  for (const x of Object.values(by)) { x.value = round2(x.value); x.sharePct = total > 0 ? round2((x.value / total) * 100) : 0; }
  const classes = (Object.keys(by) as ProductClass[]).filter((k) => by[k].units > 0 && k !== "AUTRE");
  return {
    totalValue: round2(total),
    byClass: by,
    slowLiquiditySharePct: total > 0 ? round2(by.COMMERCIAL.sharePct + by.HOTELIER.sharePct) : undefined,
    mixed: classes.length > 1,
  };
}

const ENGAGED = new Set(["RESERVE", "COMPROMIS", "VENDU", "LIVRE"]);
/** Désistements / (engagements + désistements) ; absent si aucun engagement. */
export function cancellationRatePct(units: { status: string }[]): number | undefined {
  const des = units.filter((u) => u.status === "DESISTE").length;
  const eng = units.filter((u) => ENGAGED.has(u.status)).length;
  return eng + des > 0 ? round2((des / (eng + des)) * 100) : undefined;
}

// ---------------------------------------------------------------------
//  4. Équipements exigés (mosquée, école, voirie…)
// ---------------------------------------------------------------------

export const EQUIPMENT_KINDS: { value: string; label: string }[] = [
  { value: "mosquee", label: "Mosquée / salle de prière" },
  { value: "ecole", label: "École / établissement d'enseignement" },
  { value: "dispensaire", label: "Dispensaire / centre de santé" },
  { value: "espace_vert", label: "Espaces verts / aires de jeux" },
  { value: "voirie_vrd", label: "Voirie et réseaux divers (hors programme)" },
  { value: "equipement_sportif", label: "Équipement sportif" },
  { value: "poste_electrique", label: "Poste de transformation / raccordement" },
  { value: "equipement_administratif", label: "Équipement administratif ou de sécurité" },
  { value: "autre", label: "Autre équipement" },
];
export const EQUIPMENT_ORIGINS: { value: string; label: string }[] = [
  { value: "cahier_des_charges", label: "Cahier des charges du lotissement" },
  { value: "convention_commune", label: "Convention avec la commune" },
  { value: "permis", label: "Prescription de l'autorisation (permis / lotir)" },
  { value: "convention_etat", label: "Convention avec l'État (logement aidé, zone d'aménagement)" },
  { value: "autre", label: "Autre" },
];
export const EQUIPMENT_FUNDERS: { value: string; label: string }[] = [
  { value: "promoteur", label: "Promoteur (sur le budget du programme)" },
  { value: "banque", label: "Financé par la banque (inclus dans le crédit)" },
  { value: "commune", label: "Commune / État" },
  { value: "autre", label: "Autre financeur" },
];

export interface EquipmentView {
  label: string;
  kind: string;
  estimatedCost: number | null;
  budgeted: boolean;
  fundedBy: string | null;
  progressPct: number | null;
  dueDate: Date | string | null;
  conditionsDelivery: boolean;
  handedOver: boolean;
  trancheId?: string | null;
}

export interface EquipmentAssessment {
  /** Coût non budgété à la charge du programme / coût total (%). */
  unbudgetedPct?: number;
  unbudgetedCost: number;
  totalCost: number;
  /** Un équipement qui conditionne la réception est en retard. */
  deliveryAtRisk?: boolean;
  atRisk: string[];
  reason: string;
}

/**
 * declared : true = obligations déclarées (la liste fait foi, éventuellement
 * vide) ; false = « aucun équipement exigé » déclaré ; null = non déclaré.
 */
export function assessEquipments(
  list: EquipmentView[],
  opts: { declared: boolean | null; programmeCost: number | null; programmeProgressPct: number | null; now?: Date },
): EquipmentAssessment {
  const now = (opts.now ?? new Date()).getTime();
  if (list.length === 0) {
    if (opts.declared === false || opts.declared === true) {
      return { unbudgetedPct: 0, unbudgetedCost: 0, totalCost: 0, deliveryAtRisk: false, atRisk: [], reason: "Aucun équipement exigé déclaré." };
    }
    return { unbudgetedCost: 0, totalCost: 0, atRisk: [], reason: "Obligations d'équipements non déclarées : donnée absente." };
  }
  const chargeable = list.filter((e) => e.fundedBy !== "commune");
  const unbudgetedCost = round2(chargeable.filter((e) => !e.budgeted).reduce((s, e) => s + Math.max(0, e.estimatedCost ?? 0), 0));
  const totalCost = round2(list.reduce((s, e) => s + Math.max(0, e.estimatedCost ?? 0), 0));
  const atRisk = list
    .filter((e) => e.conditionsDelivery && !e.handedOver)
    .filter((e) => {
      const p = e.progressPct ?? 0;
      const due = toTime(e.dueDate);
      const late = due != null && due < now && p < 100;
      const lag = opts.programmeProgressPct != null && opts.programmeProgressPct - p > 30;
      return late || lag;
    })
    .map((e) => e.label);
  const cost = opts.programmeCost && opts.programmeCost > 0 ? opts.programmeCost : null;
  const missingCost = chargeable.some((e) => !e.budgeted && e.estimatedCost == null);
  return {
    unbudgetedPct: cost != null && !missingCost ? round2((unbudgetedCost / cost) * 100) : undefined,
    unbudgetedCost,
    totalCost,
    deliveryAtRisk: atRisk.length > 0,
    atRisk,
    reason:
      `${list.length} équipement(s) exigé(s), ${totalCost.toLocaleString("fr-FR")} MAD dont ${unbudgetedCost.toLocaleString("fr-FR")} MAD non budgétés à la charge du programme.` +
      (missingCost ? " Coût estimé manquant pour un équipement non budgété : part non calculable." : "") +
      (cost == null ? " Coût total du programme non renseigné : part non calculable." : "") +
      (atRisk.length ? ` En retard et conditionnant la réception : ${atRisk.join(", ")}.` : ""),
  };
}

// ---------------------------------------------------------------------
//  5. Déblocages selon le calendrier
// ---------------------------------------------------------------------

export interface DrawFacilityView {
  authorizedAmount: number;
  drawnAmount: number;
  /** La nature du concours exige une situation de travaux (crédit de travaux). */
  worksFinancing: boolean | null;
}

export interface DrawdownAssessment {
  /** Cumul débloqué / (autorisé × avancement certifié) × 100. */
  drawdownVsProgressPct?: number;
  aheadOfWorks?: boolean;
  progressPct: number | null;
  progressSource: string;
  reason: string;
}

/** Seuil au-delà duquel les tirages devancent l'avancement certifié. */
export const DRAWDOWN_AHEAD_THRESHOLD = 115;

export function assessDrawdown(
  facilities: DrawFacilityView[],
  progress: { pct: number | null; source: string },
): DrawdownAssessment {
  const anyNature = facilities.some((f) => f.worksFinancing !== null);
  const works = anyNature ? facilities.filter((f) => f.worksFinancing === true) : facilities;
  const authorized = works.reduce((s, f) => s + Math.max(0, f.authorizedAmount), 0);
  const drawn = works.reduce((s, f) => s + Math.max(0, f.drawnAmount), 0);
  if (works.length === 0 || authorized <= 0) {
    return { progressPct: progress.pct, progressSource: progress.source, reason: "Aucun crédit de travaux saisi : rapport non calculable." };
  }
  if (progress.pct == null) {
    return { progressPct: null, progressSource: progress.source, reason: "Avancement certifié inconnu : rapport non calculable." };
  }
  const expected = authorized * (progress.pct / 100);
  const pct = drawn <= 0 ? 0 : expected <= 0 ? 999 : Math.min(999, round2((drawn / expected) * 100));
  return {
    drawdownVsProgressPct: pct,
    aheadOfWorks: pct >= DRAWDOWN_AHEAD_THRESHOLD,
    progressPct: progress.pct,
    progressSource: progress.source,
    reason:
      `Débloqué ${drawn.toLocaleString("fr-FR")} MAD sur ${authorized.toLocaleString("fr-FR")} MAD de crédits de travaux ; ` +
      `avancement ${progress.pct} % (${progress.source}) : ${pct} % de l'attendu.` +
      (anyNature ? "" : " Natures de concours non renseignées : toutes les facilités sont comptées."),
  };
}

/** Avancement de référence : situation visée > tranches du périmètre > visite. */
export function certifiedProgress(input: {
  certifiedPcts: (number | null | undefined)[];
  perimeterProgressPct: number | null;
  visitProgressPct: number | null | undefined;
}): { pct: number | null; source: string } {
  const cert = input.certifiedPcts.filter((x): x is number => typeof x === "number");
  if (cert.length) return { pct: Math.max(...cert), source: "dernière situation de travaux visée" };
  if (input.perimeterProgressPct != null) return { pct: input.perimeterProgressPct, source: "avancement des tranches financées" };
  if (input.visitProgressPct != null) return { pct: input.visitProgressPct, source: "dernière visite de chantier" };
  return { pct: null, source: "aucune mesure d'avancement" };
}

export interface ScheduleMilestone { plannedDate: Date | string | null; plannedAmount: number; realizedAmount: number }

/** Plan de tirage en retard : ≥ 25 % du montant prévu à date non débloqué. */
export function drawdownScheduleLate(rows: ScheduleMilestone[], now: Date = new Date()): { late?: boolean; gapPct?: number; reason: string } {
  const due = rows.filter((r) => { const t = toTime(r.plannedDate); return t != null && t <= now.getTime(); });
  const planned = due.reduce((s, r) => s + r.plannedAmount, 0);
  if (planned <= 0) return { reason: "Aucun jalon de tirage échu : retard non mesurable." };
  const realized = due.reduce((s, r) => s + Math.min(r.realizedAmount, r.plannedAmount), 0);
  const gapPct = round2(((planned - realized) / planned) * 100);
  return { late: gapPct >= 25, gapPct, reason: `${gapPct} % du montant prévu à date non débloqué (${due.length} jalon(s) échu(s)).` };
}
