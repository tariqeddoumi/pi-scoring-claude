// =====================================================================
//  facility.ts — Facilité de crédit (tranche) & EAD réel.
//  L'exposition au défaut (EAD) d'une facilité = encours tiré + fraction
//  pondérée (CCF) du non-tiré encore mobilisable. L'EAD d'un projet est la
//  somme des EAD de ses facilités ; à défaut de facilité, on retombe sur le
//  montant de prêt autorisé. L'échéancier (échéances échues non soldées)
//  fournit le retard (DPD) et l'impayé. Logique pure et testable.
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface FacilityLike {
  authorizedAmount: number;
  drawnAmount: number;
  ccf?: number; // credit conversion factor sur le non-tiré (défaut 1)
}

/** EAD d'une facilité = encours tiré + CCF × (autorisé − tiré). */
export function facilityEad(f: FacilityLike): number {
  const drawn = Math.max(0, f.drawnAmount);
  const undrawn = Math.max(0, f.authorizedAmount - drawn);
  const ccf = clamp01(f.ccf ?? 1);
  return round2(drawn + ccf * undrawn);
}

/**
 * EAD consolidé d'un projet : somme des EAD de ses facilités. En l'absence de
 * facilité, on retombe sur le montant autorisé (`fallback`).
 */
export function projectEad(
  facilities: FacilityLike[],
  fallback: number,
): { ead: number; fromFacilities: boolean } {
  if (!facilities || facilities.length === 0) {
    return { ead: round2(Math.max(0, fallback)), fromFacilities: false };
  }
  return { ead: round2(facilities.reduce((s, f) => s + facilityEad(f), 0)), fromFacilities: true };
}

export interface InstallmentLike {
  dueDate: Date | string;
  amountDue: number;
  amountPaid?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Retard (jours) d'une échéance : 0 si soldée ou non encore échue. */
export function installmentOverdueDays(i: InstallmentLike, asOf: Date): number {
  const paid = Math.max(0, i.amountPaid ?? 0);
  if (paid >= i.amountDue) return 0; // soldée
  const due = new Date(i.dueDate).getTime();
  if (due >= asOf.getTime()) return 0; // pas encore échue
  return Math.floor((asOf.getTime() - due) / DAY_MS);
}

/** DPD de l'échéancier : plus grand retard parmi les échéances non soldées. */
export function scheduleDpd(installments: InstallmentLike[], asOf: Date): number {
  return installments.reduce((max, i) => Math.max(max, installmentOverdueDays(i, asOf)), 0);
}

/** Montant impayé : somme des reliquats des échéances échues non soldées. */
export function totalOverdue(installments: InstallmentLike[], asOf: Date): number {
  let sum = 0;
  for (const i of installments) {
    if (installmentOverdueDays(i, asOf) > 0) {
      sum += Math.max(0, i.amountDue - (i.amountPaid ?? 0));
    }
  }
  return round2(sum);
}

/**
 * Dépassement de ligne (%) : excédent du tiré sur l'autorisé, rapporté à
 * l'autorisé, sur l'ensemble des facilités (art.10-12 : le seuil 1/W est 10 %,
 * la DURÉE du dépassement reste à documenter manuellement).
 */
export function overdraftExcessPct(facilities: FacilityLike[]): number {
  const authorized = facilities.reduce((s, f) => s + Math.max(0, f.authorizedAmount), 0);
  const drawn = facilities.reduce((s, f) => s + Math.max(0, f.drawnAmount), 0);
  if (authorized <= 0) return 0;
  return round2(Math.max(0, ((drawn - authorized) / authorized) * 100));
}

// --- Déblocages vs avancement (décaissement en avance de phase) -----------

export interface DisbursementPhaseInput {
  /** Encours tiré total (MAD). */
  drawn: number;
  /** Montant autorisé total (MAD). */
  authorized: number;
  /** Avancement physique constaté (%), null si inconnu. */
  progressPct: number | null;
  /** Tolérance (points de %) avant alerte. */
  thresholdPts?: number;
}

export interface DisbursementPhaseResult {
  /** Part décaissée (%) — null si autorisé nul. */
  drawnPct: number | null;
  /** Écart décaissé − avancement (points), null si incalculable. */
  gapPts: number | null;
  /** Décaissements en avance de phase au-delà de la tolérance. */
  alert: boolean;
  reason: string | null;
}

export const DEFAULT_PHASE_GAP_PTS = 25;

/**
 * Rapproche les déblocages de l'avancement constaté : si la part décaissée
 * excède l'avancement physique de plus de `thresholdPts` points, le projet
 * consomme le crédit plus vite qu'il ne construit (risque de dérive d'emploi
 * des fonds — vigilance renforcée et visite de chantier à déclencher).
 */
export function disbursementVsProgress(i: DisbursementPhaseInput): DisbursementPhaseResult {
  const threshold = i.thresholdPts ?? DEFAULT_PHASE_GAP_PTS;
  const drawnPct = i.authorized > 0 ? round2((Math.max(0, i.drawn) / i.authorized) * 100) : null;
  if (drawnPct == null || i.progressPct == null) {
    return { drawnPct, gapPts: null, alert: false, reason: null };
  }
  const gapPts = round2(drawnPct - i.progressPct);
  const alert = gapPts > threshold;
  return {
    drawnPct,
    gapPts,
    alert,
    reason: alert
      ? `Décaissé ${drawnPct} % vs avancement constaté ${i.progressPct} % (+${gapPts} pts > tolérance ${threshold} pts).`
      : null,
  };
}
