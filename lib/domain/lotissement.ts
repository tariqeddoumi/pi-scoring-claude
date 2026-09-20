// =====================================================================
//  lotissement.ts — Vision LOTISSEMENT : suivi lot par lot (volet 2).
//
//  Un projet de promotion peut comporter plusieurs lots/tranches. Le suivi doit
//  être conduit lot par lot : avancement, déblocages RATTACHÉS au lot, et
//  commercialisation RATTACHÉE au lot. Toute modification d'un lot (programme,
//  prix, phasage) est un événement structurant qui impose un retour en comité et
//  un nouveau scoring (reprofilage du financement).
//  Logique PURE, déterministe, testable — aucune dépendance base.
// =====================================================================

export interface LotUnitView {
  status: string; // DISPONIBLE | RESERVE | VENDU | LIVRE (référentiel UnitStatus)
  plannedPrice?: number | null;
  soldPrice?: number | null;
  listPrice?: number | null;
}

export interface LotDisbursementView {
  plannedAmount: number;
  // Montant effectivement débloqué rattaché à ce lot (événements deblocage).
  releasedAmount?: number;
}

export interface LotEventView {
  type: string;
  requiresCommittee?: boolean;
  resolved?: boolean;
}

export interface LotView {
  code: string;
  name?: string | null;
  status: string;
  progressPct: number; // avancement physique 0..100
  budget?: number | null;
  units: LotUnitView[];
  disbursements: LotDisbursementView[];
  events: LotEventView[];
}

export interface LotFollowUp {
  code: string;
  name: string | null;
  status: string;
  progressPct: number;
  // Commercialisation (rattachée au lot).
  unitsTotal: number;
  unitsReserved: number;
  unitsSold: number;
  commercialisationPct: number; // (réservés + vendus) / total
  revenueSecured: number; // Σ prix des lots vendus
  // Déblocages (rattachés au lot).
  plannedDisbursement: number;
  releasedDisbursement: number;
  disbursementPct: number; // débloqué / prévu
  // Alerte décaissement en avance de phase : le déblocage dépasse l'avancement.
  overDisbursement: boolean;
  disbursementVsProgressGap: number; // points (déblocage% − avancement%)
  // Volet 3 : un retour en comité est requis pour ce lot.
  needsCommittee: boolean;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 10000) / 100 : 0);
const SOLD = new Set(["VENDU", "LIVRE"]);
const RESERVED = new Set(["RESERVE"]);

/** Suivi d'un lot : commercialisation, déblocages et alertes. */
export function lotFollowUp(lot: LotView): LotFollowUp {
  const unitsTotal = lot.units.length;
  const unitsSold = lot.units.filter((u) => SOLD.has(u.status)).length;
  const unitsReserved = lot.units.filter((u) => RESERVED.has(u.status)).length;
  const revenueSecured = lot.units
    .filter((u) => SOLD.has(u.status))
    .reduce((s, u) => s + (u.soldPrice ?? u.plannedPrice ?? 0), 0);

  const plannedDisbursement = lot.disbursements.reduce((s, d) => s + (d.plannedAmount || 0), 0);
  const releasedDisbursement = lot.disbursements.reduce((s, d) => s + (d.releasedAmount || 0), 0);
  const disbursementPct = pct(releasedDisbursement, plannedDisbursement);

  // Décaissement en avance de phase : déblocage% nettement supérieur à
  // l'avancement physique (seuil de 10 points, cohérent avec le suivi projet).
  const gap = Math.round((disbursementPct - lot.progressPct) * 100) / 100;
  const overDisbursement = gap > 10;

  const needsCommittee = lot.events.some((e) => e.requiresCommittee === true && !e.resolved);

  return {
    code: lot.code,
    name: lot.name ?? null,
    status: lot.status,
    progressPct: lot.progressPct,
    unitsTotal,
    unitsReserved,
    unitsSold,
    commercialisationPct: pct(unitsReserved + unitsSold, unitsTotal),
    revenueSecured,
    plannedDisbursement,
    releasedDisbursement,
    disbursementPct,
    overDisbursement,
    disbursementVsProgressGap: gap,
    needsCommittee,
  };
}

export interface ProgramLotSummary {
  lots: LotFollowUp[];
  lotsCount: number;
  lotsNeedingCommittee: number;
  lotsOverDisbursed: number;
  commercialisationPct: number; // agrégé sur l'ensemble des unités
  revenueSecured: number;
  plannedDisbursement: number;
  releasedDisbursement: number;
}

/** Synthèse programme agrégeant le suivi de tous les lots. */
export function programLotSummary(lots: LotView[]): ProgramLotSummary {
  const followups = lots.map(lotFollowUp);
  const unitsTotal = followups.reduce((s, l) => s + l.unitsTotal, 0);
  const unitsCommercialised = followups.reduce((s, l) => s + l.unitsReserved + l.unitsSold, 0);
  return {
    lots: followups,
    lotsCount: followups.length,
    lotsNeedingCommittee: followups.filter((l) => l.needsCommittee).length,
    lotsOverDisbursed: followups.filter((l) => l.overDisbursement).length,
    commercialisationPct: pct(unitsCommercialised, unitsTotal),
    revenueSecured: followups.reduce((s, l) => s + l.revenueSecured, 0),
    plannedDisbursement: followups.reduce((s, l) => s + l.plannedDisbursement, 0),
    releasedDisbursement: followups.reduce((s, l) => s + l.releasedDisbursement, 0),
  };
}
