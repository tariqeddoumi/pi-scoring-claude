// =====================================================================
//  commercialisation.ts — Suivi de commercialisation d'un projet de
//  promotion immobilière. Logique PURE et testable (aucune dépendance
//  Prisma/IO) : agrégats de ventes par tranche / type / standing, chiffre
//  d'affaires (réalisé, réservé, prévu), décalage par rapport au business
//  plan (calendrier + prix), détection des déclassements de standing, et
//  suivi des mainlevées (lots vendus dont l'hypothèque n'est pas levée).
//
//  Le périmètre temporel va d'avant le démarrage (lots PLANIFIEE/DISPONIBLE)
//  jusqu'à la clôture (LIVRE + mainlevée). Les entrées sont des structures
//  simples afin que la couche serveur puisse les alimenter depuis Prisma.
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;
const pct = (num: number, den: number) => (den > 0 ? round2((num / den) * 100) : 0);

export type StandingCode =
  | "TRES_HAUT"
  | "HAUT"
  | "MOYEN_HAUT"
  | "MOYEN"
  | "ECONOMIQUE"
  | "SOCIAL";

export type UnitTypeCode = "APPARTEMENT" | "VILLA" | "COMMERCE" | "BUREAU" | "TERRAIN" | "AUTRE";

export type UnitStatusCode = "DISPONIBLE" | "RESERVE" | "COMPROMIS" | "VENDU" | "LIVRE" | "DESISTE";

// Sévérité croissante du standing : un indice plus élevé = standing inférieur.
// Sert à détecter un déclassement (ex. TRES_HAUT → MOYEN).
const STANDING_RANK: Record<StandingCode, number> = {
  TRES_HAUT: 0,
  HAUT: 1,
  MOYEN_HAUT: 2,
  MOYEN: 3,
  ECONOMIQUE: 4,
  SOCIAL: 5,
};

const STANDING_LABELS: Record<StandingCode, string> = {
  TRES_HAUT: "Très haut standing",
  HAUT: "Haut standing",
  MOYEN_HAUT: "Moyen-haut standing",
  MOYEN: "Moyen standing",
  ECONOMIQUE: "Économique",
  SOCIAL: "Social",
};

export function standingLabel(s: StandingCode): string {
  return STANDING_LABELS[s] ?? s;
}

/** Un lot tel que consommé par les agrégats (sous-ensemble du modèle Unit). */
export interface UnitView {
  reference: string;
  trancheCode: string;
  type: UnitTypeCode;
  status: UnitStatusCode;
  plannedStanding: StandingCode;
  standing: StandingCode;
  plannedPrice: number | null;
  listPrice: number | null;
  soldPrice: number | null;
  plannedSaleDate: Date | string | null;
  soldAt: Date | string | null;
  mortgageReleased: boolean;
  releasedAmount: number | null;
}

// Un lot est « engagé » commercialement dès qu'il est réservé/compromis/vendu/livré.
const COMMITTED: UnitStatusCode[] = ["RESERVE", "COMPROMIS", "VENDU", "LIVRE"];
// Une vente est « ferme » au stade vendu/livré (compromis/réservation = pré-vente).
const FIRM: UnitStatusCode[] = ["VENDU", "LIVRE"];

const isCommitted = (s: UnitStatusCode) => COMMITTED.includes(s);
const isFirm = (s: UnitStatusCode) => FIRM.includes(s);
const isActive = (s: UnitStatusCode) => s !== "DESISTE"; // un désistement sort du parc commercialisable

const toDate = (d: Date | string | null): Date | null => {
  if (d == null) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

/** Valeur d'un lot pour le CA : prix de vente si vendu, sinon prix affiché, sinon prix BP. */
const realizedValue = (u: UnitView): number => u.soldPrice ?? u.listPrice ?? u.plannedPrice ?? 0;
const plannedValue = (u: UnitView): number => u.plannedPrice ?? u.listPrice ?? 0;

export interface SalesAggregate {
  totalUnits: number; // lots actifs (hors désistements)
  available: number;
  reserved: number; // réservés
  compromised: number; // compromis signés
  sold: number; // vendus
  delivered: number; // livrés
  withdrawn: number; // désistements
  committedUnits: number; // réservés + compromis + vendus + livrés
  firmUnits: number; // vendus + livrés
  preSaleRatePct: number; // engagés / parc actif
  firmSaleRatePct: number; // ventes fermes / parc actif
}

/** Agrège des compteurs de statut sur un ensemble de lots. */
export function aggregateSales(units: UnitView[]): SalesAggregate {
  const active = units.filter((u) => isActive(u.status));
  const count = (s: UnitStatusCode) => units.filter((u) => u.status === s).length;
  const committedUnits = active.filter((u) => isCommitted(u.status)).length;
  const firmUnits = active.filter((u) => isFirm(u.status)).length;
  const totalUnits = active.length;
  return {
    totalUnits,
    available: count("DISPONIBLE"),
    reserved: count("RESERVE"),
    compromised: count("COMPROMIS"),
    sold: count("VENDU"),
    delivered: count("LIVRE"),
    withdrawn: count("DESISTE"),
    committedUnits,
    firmUnits,
    preSaleRatePct: pct(committedUnits, totalUnits),
    firmSaleRatePct: pct(firmUnits, totalUnits),
  };
}

export interface RevenueAggregate {
  caPrevu: number; // CA prévu (business plan) sur le parc actif
  caRealise: number; // CA des ventes fermes (vendus + livrés)
  caReserve: number; // CA additionnel sécurisé (réservés + compromis)
  caEngage: number; // réalisé + réservé
  tauxRealisationPct: number; // caRealise / caPrevu
}

/** Chiffre d'affaires réalisé / réservé / prévu. */
export function aggregateRevenue(units: UnitView[]): RevenueAggregate {
  let caPrevu = 0;
  let caRealise = 0;
  let caReserve = 0;
  for (const u of units) {
    if (!isActive(u.status)) continue;
    caPrevu += plannedValue(u);
    if (isFirm(u.status)) caRealise += realizedValue(u);
    else if (isCommitted(u.status)) caReserve += realizedValue(u);
  }
  return {
    caPrevu: round2(caPrevu),
    caRealise: round2(caRealise),
    caReserve: round2(caReserve),
    caEngage: round2(caRealise + caReserve),
    tauxRealisationPct: pct(caRealise, caPrevu),
  };
}

/** Ventilation générique par clé (type, tranche, standing). */
export interface Breakdown {
  key: string;
  label: string;
  totalUnits: number;
  firmUnits: number;
  committedUnits: number;
  firmSaleRatePct: number;
  caRealise: number;
  caPrevu: number;
}

function breakdownBy(
  units: UnitView[],
  keyOf: (u: UnitView) => string,
  labelOf: (k: string) => string,
): Breakdown[] {
  const groups = new Map<string, UnitView[]>();
  for (const u of units) {
    const k = keyOf(u);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(u);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sa = aggregateSales(list);
      const rev = aggregateRevenue(list);
      return {
        key,
        label: labelOf(key),
        totalUnits: sa.totalUnits,
        firmUnits: sa.firmUnits,
        committedUnits: sa.committedUnits,
        firmSaleRatePct: sa.firmSaleRatePct,
        caRealise: rev.caRealise,
        caPrevu: rev.caPrevu,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export const breakdownByType = (units: UnitView[]) =>
  breakdownBy(units, (u) => u.type, (k) => k);
export const breakdownByTranche = (units: UnitView[]) =>
  breakdownBy(units, (u) => u.trancheCode, (k) => k);
export const breakdownByStanding = (units: UnitView[]) =>
  breakdownBy(units, (u) => u.standing, (k) => standingLabel(k as StandingCode));

/** Un lot en retard de commercialisation par rapport au business plan. */
export interface ScheduleSlip {
  reference: string;
  trancheCode: string;
  plannedSaleDate: Date;
  daysLate: number; // jours de retard à la date d'observation
}

/** Un écart de prix par rapport au business plan (vendu sous le prix prévu). */
export interface PriceDeviation {
  reference: string;
  trancheCode: string;
  plannedPrice: number;
  soldPrice: number;
  deltaAmount: number; // soldPrice - plannedPrice (négatif = décote)
  deltaPct: number;
}

export interface BusinessPlanDeviation {
  /** Lots dont la date de vente prévue est dépassée sans vente ferme. */
  scheduleSlips: ScheduleSlip[];
  /** Lots vendus dont le prix s'écarte du business plan. */
  priceDeviations: PriceDeviation[];
  unitsLate: number;
  caRealise: number;
  caPrevu: number;
  /** Décalage global de CA réalisé vs prévu (négatif = en retard/sous le BP). */
  caDeltaAmount: number;
  caDeltaPct: number;
  /** Écart de prix moyen pondéré sur les lots vendus (%). */
  avgPriceDeviationPct: number;
  /** Lots dont la vente était planifiée à la date d'observation. */
  plannedUnitsToDate: number;
  /** Lots effectivement vendus fermes (cumul). */
  firmUnits: number;
  /** Ventes réelles vs planifiées à date (%), null si rien de planifié encore. */
  salesVsPlanPct: number | null;
}

/**
 * Décalage par rapport au business plan : retards de calendrier (lots dont la
 * date de vente prévue est passée et qui ne sont pas vendus fermes) et écarts
 * de prix (prix de vente vs prix BP). `asOf` est la date d'observation.
 */
export function computeBusinessPlanDeviation(
  units: UnitView[],
  asOf: Date = new Date(),
  priceTolerancePct = 0,
): BusinessPlanDeviation {
  const scheduleSlips: ScheduleSlip[] = [];
  const priceDeviations: PriceDeviation[] = [];
  let weightedDevSum = 0;
  let weightedDevBase = 0;
  let plannedUnitsToDate = 0;
  let firmUnits = 0;

  for (const u of units) {
    if (!isActive(u.status)) continue;
    const planned = toDate(u.plannedSaleDate);
    if (planned && asOf.getTime() >= planned.getTime()) plannedUnitsToDate += 1;
    if (isFirm(u.status)) firmUnits += 1;
    if (planned && !isFirm(u.status) && asOf.getTime() > planned.getTime()) {
      const daysLate = Math.floor((asOf.getTime() - planned.getTime()) / 86_400_000);
      scheduleSlips.push({ reference: u.reference, trancheCode: u.trancheCode, plannedSaleDate: planned, daysLate });
    }
    if (isFirm(u.status) && u.soldPrice != null && u.plannedPrice != null && u.plannedPrice > 0) {
      const deltaAmount = u.soldPrice - u.plannedPrice;
      const deltaPct = round2((deltaAmount / u.plannedPrice) * 100);
      weightedDevSum += deltaAmount;
      weightedDevBase += u.plannedPrice;
      if (Math.abs(deltaPct) > priceTolerancePct) {
        priceDeviations.push({
          reference: u.reference,
          trancheCode: u.trancheCode,
          plannedPrice: u.plannedPrice,
          soldPrice: u.soldPrice,
          deltaAmount: round2(deltaAmount),
          deltaPct,
        });
      }
    }
  }

  const rev = aggregateRevenue(units);
  const caDeltaAmount = round2(rev.caRealise - rev.caPrevu);
  return {
    scheduleSlips: scheduleSlips.sort((a, b) => b.daysLate - a.daysLate),
    priceDeviations: priceDeviations.sort((a, b) => a.deltaPct - b.deltaPct),
    unitsLate: scheduleSlips.length,
    caRealise: rev.caRealise,
    caPrevu: rev.caPrevu,
    caDeltaAmount,
    caDeltaPct: pct(rev.caRealise, rev.caPrevu) - 100,
    avgPriceDeviationPct: weightedDevBase > 0 ? round2((weightedDevSum / weightedDevBase) * 100) : 0,
    plannedUnitsToDate,
    firmUnits,
    salesVsPlanPct: plannedUnitsToDate > 0 ? round2((firmUnits / plannedUnitsToDate) * 100) : null,
  };
}

/** Un lot dont le standing effectif diffère du standing prévu au business plan. */
export interface StandingChange {
  reference: string;
  trancheCode: string;
  plannedStanding: StandingCode;
  currentStanding: StandingCode;
  plannedLabel: string;
  currentLabel: string;
  /** Nombre de crans d'écart (positif = déclassement, négatif = montée en gamme). */
  rankDelta: number;
  direction: "DOWNGRADE" | "UPGRADE";
}

/**
 * Détection des changements de standing : compare le standing effectif au
 * standing prévu (business plan). Un `rankDelta > 0` est un déclassement
 * (ex. TRES_HAUT → MOYEN), `< 0` une montée en gamme.
 */
export function detectStandingChanges(units: UnitView[]): StandingChange[] {
  const out: StandingChange[] = [];
  for (const u of units) {
    if (!isActive(u.status)) continue;
    const rankDelta = STANDING_RANK[u.standing] - STANDING_RANK[u.plannedStanding];
    if (rankDelta === 0) continue;
    out.push({
      reference: u.reference,
      trancheCode: u.trancheCode,
      plannedStanding: u.plannedStanding,
      currentStanding: u.standing,
      plannedLabel: standingLabel(u.plannedStanding),
      currentLabel: standingLabel(u.standing),
      rankDelta,
      direction: rankDelta > 0 ? "DOWNGRADE" : "UPGRADE",
    });
  }
  return out.sort((a, b) => b.rankDelta - a.rankDelta);
}

export interface MainleveeTracking {
  soldUnits: number; // lots vendus ou livrés
  releasedUnits: number; // dont mainlevée obtenue
  pendingUnits: number; // vendus sans mainlevée
  releaseRatePct: number;
  releasedAmount: number; // montant total des mainlevées obtenues
  pendingReferences: { reference: string; trancheCode: string; soldAt: Date | null }[];
}

/** Suivi des mainlevées : lots vendus dont l'hypothèque reste à lever. */
export function trackMainlevees(units: UnitView[]): MainleveeTracking {
  const soldUnitsList = units.filter((u) => isFirm(u.status));
  const released = soldUnitsList.filter((u) => u.mortgageReleased);
  const pending = soldUnitsList.filter((u) => !u.mortgageReleased);
  const releasedAmount = released.reduce((s, u) => s + (u.releasedAmount ?? 0), 0);
  return {
    soldUnits: soldUnitsList.length,
    releasedUnits: released.length,
    pendingUnits: pending.length,
    releaseRatePct: pct(released.length, soldUnitsList.length),
    releasedAmount: round2(releasedAmount),
    pendingReferences: pending.map((u) => ({
      reference: u.reference,
      trancheCode: u.trancheCode,
      soldAt: toDate(u.soldAt),
    })),
  };
}

export interface CommercialisationSummary {
  sales: SalesAggregate;
  revenue: RevenueAggregate;
  byType: Breakdown[];
  byTranche: Breakdown[];
  byStanding: Breakdown[];
  businessPlan: BusinessPlanDeviation;
  standingChanges: StandingChange[];
  mainlevees: MainleveeTracking;
}

/** Synthèse complète du suivi de commercialisation d'un projet. */
export function summarizeCommercialisation(
  units: UnitView[],
  asOf: Date = new Date(),
): CommercialisationSummary {
  return {
    sales: aggregateSales(units),
    revenue: aggregateRevenue(units),
    byType: breakdownByType(units),
    byTranche: breakdownByTranche(units),
    byStanding: breakdownByStanding(units),
    businessPlan: computeBusinessPlanDeviation(units, asOf),
    standingChanges: detectStandingChanges(units),
    mainlevees: trackMainlevees(units),
  };
}
