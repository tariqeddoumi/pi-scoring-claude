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
