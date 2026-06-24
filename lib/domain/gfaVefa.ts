// =====================================================================
//  gfaVefa.ts — Garantie Financière d'Achèvement (GFA) & vente VEFA.
//  La GFA d'un établissement éligible couvre le risque d'achèvement du
//  programme : sa valeur admise vient en déduction de l'assiette de
//  provisionnement, à la manière d'une garantie.
//  Le mode de vente VEFA qualifie pleinement la GFA (cadre légal de la
//  vente sur plan) ; hors VEFA, un abattement prudentiel est appliqué.
//  Logique pure et testable.
// =====================================================================

import type { GfaVefaParams, GfaVefaResult } from "@/lib/domain/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Valeur de la GFA admise en déduction de l'assiette de provisionnement.
 * - Sans GFA, ou GFA d'un garant non éligible, ou montant ≤ 0 → aucun effet.
 * - GFA en cadre VEFA → quotité pleine (100%).
 * - GFA hors VEFA → abattement prudentiel (nonVefaHaircut, défaut 25%).
 * - La valeur admise est plafonnée à l'exposition (on ne sur-couvre pas).
 */
export function computeGfaRelief(p: GfaVefaParams): GfaVefaResult {
  const amount = Math.max(0, p.gfaAmount ?? 0);
  const eligible = p.gfaEligible ?? true;
  const exposure = Math.max(0, p.exposure);

  if (!p.hasGFA || amount === 0 || !eligible) {
    return {
      applicable: false,
      admittedValue: 0,
      quotity: 0,
      cappedByExposure: false,
      note: !p.hasGFA
        ? "Aucune GFA en place"
        : !eligible
          ? "GFA d'un établissement non éligible — non admise"
          : "Montant de GFA nul",
    };
  }

  const isVefa = p.saleMode === "VEFA";
  const haircut = clamp01(p.nonVefaHaircut ?? 0.25);
  const quotity = isVefa ? 1 : 1 - haircut;

  const gross = amount * quotity;
  const admittedValue = round2(Math.min(gross, exposure));
  const cappedByExposure = gross > exposure;

  return {
    applicable: admittedValue > 0,
    admittedValue,
    quotity,
    cappedByExposure,
    note: isVefa
      ? "GFA en cadre VEFA — admise à 100%"
      : `GFA hors VEFA — abattement prudentiel ${Math.round(haircut * 100)}%`,
  };
}
