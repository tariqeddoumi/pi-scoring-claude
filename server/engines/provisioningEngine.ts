// =====================================================================
//  provisioningEngine.ts
//  Provision BKAM (19/G art.13-15 ; 1/W art.32-35) :
//    base provisionnable = max(0, EAD − agios réservés − garanties éligibles)
//    provision           = base provisionnable × taux de provision
//  Taux minimaux :
//    1/W : Sensible 10% · Pré-douteux 20% · Douteux 50% · Compromis 100%
//    19/G: Pré-douteux 20% · Douteux 50% · Compromis 100% (pas de sensible)
//  Créance "irrégulière" (19/G art.4bis) : critères de souffrance mais
//  intégralement couverte par garanties 100% → base nulle, provision nulle.
// =====================================================================

import type { ProvisionInputExt, ProvisionResult } from "@/lib/domain/types";

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function computeProvision(input: ProvisionInputExt): ProvisionResult & {
  isIrregular: boolean;
} {
  const ead = Math.max(0, input.ead);
  const reservedAgios = Math.max(0, input.reservedAgios ?? 0);
  const eligibleGuarantees = Math.max(0, input.eligibleGuarantees);
  const rate = clamp01(input.rate);

  const provisionBase = round2(Math.max(0, ead - reservedAgios - eligibleGuarantees));
  // Irrégulière : base nulle ⇔ exposition totalement couverte.
  const isIrregular = input.isIrregular === true && provisionBase === 0;
  const provisionAmount = round2(provisionBase * rate);

  return {
    ead: round2(ead),
    reservedAgios: round2(reservedAgios),
    eligibleGuarantees: round2(eligibleGuarantees),
    provisionBase,
    rate,
    provisionAmount,
    classCode: input.classCode,
    isIrregular,
  };
}
