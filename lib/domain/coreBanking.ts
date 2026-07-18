// =====================================================================
//  coreBanking.ts — Contrat d'échange avec le SI bancaire (T24 / Evolan).
//  Un « snapshot » décrit l'état du dossier côté SI : facilités et encours,
//  échéancier et impayés, déblocages, restructuration. Il est appliqué au
//  dossier par server/actions/coreBanking.ts (source taguée « SI »).
//  Types + validation zod PURS — aucune dépendance réseau ici.
// =====================================================================

import { z } from "zod";

export const CoreBankingInstallmentSchema = z.object({
  seq: z.number().int().min(1),
  dueDate: z.string(), // ISO
  amountDue: z.number().min(0),
  amountPaid: z.number().min(0).default(0),
});

export const CoreBankingFacilitySchema = z.object({
  externalRef: z.string().min(1), // référence facilité côté SI
  label: z.string().optional(),
  authorizedAmount: z.number().min(0),
  drawnAmount: z.number().min(0),
  reservedAgios: z.number().min(0).optional(),
  installments: z.array(CoreBankingInstallmentSchema).default([]),
});

export const CoreBankingDisbursementSchema = z.object({
  ref: z.string().min(1), // référence unique du déblocage côté SI (dédoublonnage)
  date: z.string(), // ISO
  amount: z.number().min(0),
  facilityRef: z.string().optional(),
});

export const CoreBankingSnapshotSchema = z.object({
  source: z.string().min(1), // "T24" | "EVOLAN" | ...
  asOf: z.string(), // ISO — date de situation
  facilities: z.array(CoreBankingFacilitySchema).default([]),
  disbursements: z.array(CoreBankingDisbursementSchema).default([]),
  restructured: z.boolean().default(false),
});

export type CoreBankingSnapshot = z.infer<typeof CoreBankingSnapshotSchema>;

/** Interface d'un connecteur SI. L'implémentation détient l'accès réseau. */
export interface CoreBankingProvider {
  name: string;
  isConfigured(): boolean;
  /** Récupère la situation du dossier identifié par sa référence SI. */
  fetchSnapshot(coreBankingRef: string): Promise<CoreBankingSnapshot>;
}
