// =====================================================================
//  businessPlan.ts — Dérive cumulée du BUSINESS PLAN lui-même par rapport à son
//  état d'origine (v0 figé), distincte du « réalisé vs plan » (commercialisation).
//  Quand le plan est révisé (changement de standing, de prix cible ou de
//  calendrier), on mesure ici de combien la cible a bougé depuis l'origine —
//  bonne pratique : conserver le BP initial pour audit et tracer la dérive.
//  Logique PURE et testable.
// =====================================================================

import { STANDINGS } from "@/lib/domain/referentiels";

const round2 = (v: number) => Math.round(v * 100) / 100;

export type StandingCode =
  | "TRES_HAUT" | "HAUT" | "MOYEN_HAUT" | "MOYEN" | "ECONOMIQUE" | "SOCIAL";

// Rang de sévérité = position dans le référentiel (0 = très haut … 5 = social).
const RANK = new Map<string, number>(STANDINGS.items.map((s, i) => [s.value, i]));
const rankOf = (s: string) => RANK.get(s) ?? 0;

const toDate = (d: Date | string | null): Date | null => {
  if (d == null) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

/** Lot avec sa baseline d'origine (v0) et sa baseline courante (révisable). */
export interface UnitBaselineView {
  reference: string;
  trancheCode: string;
  originalStanding: StandingCode | null;
  originalPrice: number | null;
  originalSaleDate: Date | string | null;
  plannedStanding: StandingCode;
  plannedPrice: number | null;
  plannedSaleDate: Date | string | null;
}

export interface PlanDriftItem {
  reference: string;
  trancheCode: string;
  field: "standing" | "price" | "saleDate";
  beforeLabel: string;
  afterLabel: string;
  rankDelta?: number; // standing : >0 = déclassement du plan
  direction?: "DOWNGRADE" | "UPGRADE";
  deltaPct?: number; // prix
  daysShift?: number; // calendrier : >0 = repoussé
}

export interface BusinessPlanDrift {
  items: PlanDriftItem[];
  hasOriginalBaseline: boolean;
  restandinged: number;
  downgraded: number;
  priceRevised: number;
  scheduleShifted: number;
  /** CA cible cumulé : à l'origine vs courant (sur le prix planifié). */
  targetCaOriginal: number;
  targetCaCurrent: number;
  targetCaDeltaAmount: number;
  targetCaDeltaPct: number;
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Compare la baseline courante de chaque lot à sa baseline d'origine. Un lot
 * dont `original*` est nul est réputé non révisé (origine = courant).
 */
export function computeBusinessPlanDrift(units: UnitBaselineView[]): BusinessPlanDrift {
  const items: PlanDriftItem[] = [];
  let restandinged = 0, downgraded = 0, priceRevised = 0, scheduleShifted = 0;
  let targetCaOriginal = 0, targetCaCurrent = 0;
  let hasOriginalBaseline = false;

  for (const u of units) {
    if (u.originalStanding != null || u.originalPrice != null || u.originalSaleDate != null) {
      hasOriginalBaseline = true;
    }

    // Standing du plan
    const origStanding = u.originalStanding ?? u.plannedStanding;
    if (origStanding !== u.plannedStanding) {
      const rankDelta = rankOf(u.plannedStanding) - rankOf(origStanding);
      restandinged += 1;
      if (rankDelta > 0) downgraded += 1;
      items.push({
        reference: u.reference, trancheCode: u.trancheCode, field: "standing",
        beforeLabel: STANDINGS.labelOf(origStanding), afterLabel: STANDINGS.labelOf(u.plannedStanding),
        rankDelta, direction: rankDelta > 0 ? "DOWNGRADE" : "UPGRADE",
      });
    }

    // Prix cible du plan
    const origPrice = u.originalPrice ?? u.plannedPrice ?? 0;
    const currPrice = u.plannedPrice ?? 0;
    targetCaOriginal += origPrice;
    targetCaCurrent += currPrice;
    if (u.originalPrice != null && u.plannedPrice != null && u.originalPrice !== u.plannedPrice) {
      priceRevised += 1;
      const deltaPct = u.originalPrice > 0 ? round2(((u.plannedPrice - u.originalPrice) / u.originalPrice) * 100) : 0;
      items.push({
        reference: u.reference, trancheCode: u.trancheCode, field: "price",
        beforeLabel: String(u.originalPrice), afterLabel: String(u.plannedPrice), deltaPct,
      });
    }

    // Calendrier cible du plan
    const origDate = toDate(u.originalSaleDate);
    const currDate = toDate(u.plannedSaleDate);
    if (origDate && currDate && origDate.getTime() !== currDate.getTime()) {
      scheduleShifted += 1;
      const daysShift = Math.round((currDate.getTime() - origDate.getTime()) / 86_400_000);
      items.push({
        reference: u.reference, trancheCode: u.trancheCode, field: "saleDate",
        beforeLabel: fmtDate(origDate), afterLabel: fmtDate(currDate), daysShift,
      });
    }
  }

  const targetCaDeltaAmount = round2(targetCaCurrent - targetCaOriginal);
  return {
    items,
    hasOriginalBaseline,
    restandinged, downgraded, priceRevised, scheduleShifted,
    targetCaOriginal: round2(targetCaOriginal),
    targetCaCurrent: round2(targetCaCurrent),
    targetCaDeltaAmount,
    targetCaDeltaPct: targetCaOriginal > 0 ? round2((targetCaDeltaAmount / targetCaOriginal) * 100) : 0,
  };
}
