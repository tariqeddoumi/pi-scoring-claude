// =====================================================================
//  referentialLoader.ts — Chargement des référentiels métier ADMINISTRABLES.
//
//  Les listes propres à la pratique marocaine (chaîne d'autorisations, statuts
//  de financement de l'acquéreur, natures de concours, dispositifs d'aide) sont
//  éditables en base sans redéploiement. À défaut d'entrée en base, on retombe
//  sur les valeurs par défaut du code : l'application reste fonctionnelle même
//  si le référentiel n'a pas encore été alimenté.
// =====================================================================

import type { Prisma, PrismaClient } from "@prisma/client";
import type { DivisionLimitPolicy } from "@/lib/domain/divisionRisques";
import {
  AUTHORIZATION_CHAIN,
  BUYER_FINANCING_STATUSES,
  FACILITY_NATURES,
  BUYER_AID_SCHEMES,
  type AuthorizationDef,
  type BuyerFinancingDef,
  type FacilityNatureDef,
  type ProgramKind,
  type ConditionStageLike,
} from "@/lib/domain/morocco";

type Db = PrismaClient | Prisma.TransactionClient;

export const REFERENTIAL_KINDS = [
  "AUTHORIZATION",
  "BUYER_FINANCING",
  "FACILITY_NATURE",
  "BUYER_AID",
  "PRUDENTIAL_LIMIT",
] as const;
export type ReferentialKind = (typeof REFERENTIAL_KINDS)[number];

export const REFERENTIAL_LABELS: Record<ReferentialKind, string> = {
  AUTHORIZATION: "Chaîne d'autorisations",
  BUYER_FINANCING: "Financement de l'acquéreur",
  FACILITY_NATURE: "Natures de concours",
  BUYER_AID: "Dispositifs d'aide à l'acquéreur",
  PRUDENTIAL_LIMIT: "Limites prudentielles (division des risques)",
};

export interface LoadedReferentials {
  chain: AuthorizationDef[];
  financing: Map<string, BuyerFinancingDef>;
  financingList: BuyerFinancingDef[];
  natures: Map<string, FacilityNatureDef>;
  naturesList: FacilityNatureDef[];
  aidList: { value: string; label: string; note: string }[];
  /** true si au moins une famille provient de la base (et non des défauts). */
  fromDatabase: boolean;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Charge les référentiels administrables, avec repli sur les défauts du code. */
export async function loadMoroccoReferentials(db: Db): Promise<LoadedReferentials> {
  let rows: { kind: string; code: string; label: string; orderIndex: number; config: unknown; note: string | null }[] = [];
  try {
    rows = await db.referentialItem.findMany({
      where: { active: true },
      orderBy: { orderIndex: "asc" },
      select: { kind: true, code: true, label: true, orderIndex: true, config: true, note: true },
    });
  } catch {
    rows = []; // table absente ou inaccessible → défauts du code
  }

  const by = (k: ReferentialKind) => rows.filter((r) => r.kind === k);

  // --- Chaîne d'autorisations ---
  const authRows = by("AUTHORIZATION");
  const chain: AuthorizationDef[] = authRows.length
    ? authRows.map((r) => {
        const c = asRecord(r.config);
        const appliesTo = Array.isArray(c.appliesTo)
          ? (c.appliesTo as string[]).filter((x): x is ProgramKind =>
              x === "LOTISSEMENT" || x === "CONSTRUCTION" || x === "MIXTE")
          : (["LOTISSEMENT", "CONSTRUCTION", "MIXTE"] as ProgramKind[]);
        return {
          code: r.code,
          label: r.label,
          stage: (typeof c.stage === "string" ? c.stage : "TIRAGE") as ConditionStageLike,
          appliesTo,
          regRef: typeof c.regRef === "string" ? c.regRef : undefined,
          blocksWorks: c.blocksWorks === true,
          blocksDelivery: c.blocksDelivery === true,
        };
      })
    : [...AUTHORIZATION_CHAIN];

  // --- Financement acquéreur ---
  const finRows = by("BUYER_FINANCING");
  const financingList: BuyerFinancingDef[] = finRows.length
    ? finRows.map((r) => {
        const c = asRecord(r.config);
        const f = typeof c.securityFactor === "number" ? c.securityFactor : 0.2;
        return {
          value: r.code,
          label: r.label,
          securityFactor: Math.min(1, Math.max(0, f)),
          note: r.note ?? undefined,
        };
      })
    : [...BUYER_FINANCING_STATUSES];

  // --- Natures de concours ---
  const natRows = by("FACILITY_NATURE");
  const naturesList: FacilityNatureDef[] = natRows.length
    ? natRows.map((r) => {
        const c = asRecord(r.config);
        return {
          value: r.code,
          label: r.label,
          requiresWorksCertificate: c.requiresWorksCertificate === true,
          typicalQuotity: typeof c.typicalQuotity === "number" ? c.typicalQuotity : undefined,
          note: r.note ?? undefined,
        };
      })
    : [...FACILITY_NATURES];

  // --- Dispositifs d'aide ---
  const aidRows = by("BUYER_AID");
  const aidList = aidRows.length
    ? aidRows.map((r) => ({ value: r.code, label: r.label, note: r.note ?? "" }))
    : BUYER_AID_SCHEMES.map((a) => ({ value: a.value, label: a.label, note: a.note }));

  return {
    chain,
    financing: new Map(financingList.map((f) => [f.value, f])),
    financingList,
    natures: new Map(naturesList.map((n) => [n.value, n])),
    naturesList,
    aidList,
    fromDatabase: rows.length > 0,
  };
}

/** Code de l'entrée portant la politique de division des risques. */
export const DIVISION_POLICY_CODE = "DIVISION_RISQUES";

/**
 * Politique de division des risques (fonds propres prudentiels, limite,
 * seuil de grand risque), administrable dans le référentiel
 * PRUDENTIAL_LIMIT / DIVISION_RISQUES. Aucun défaut n'est inventé : sans
 * fonds propres renseignés, le contrôle n'est pas effectué (null).
 */
export function parseDivisionPolicy(config: unknown): DivisionLimitPolicy | null {
  const c = asRecord(config);
  const ownFunds = typeof c.ownFunds === "number" ? c.ownFunds : NaN;
  if (!Number.isFinite(ownFunds) || ownFunds <= 0) return null;
  const frac = (v: unknown) => (typeof v === "number" && v > 0 && v <= 1 ? v : undefined);
  return {
    ownFunds,
    limitPct: frac(c.limitPct),
    largeExposurePct: frac(c.largeExposurePct),
    netOfGuarantees: c.netOfGuarantees === true,
  };
}

export async function loadDivisionPolicy(db: Db): Promise<DivisionLimitPolicy | null> {
  try {
    const row = await db.referentialItem.findFirst({
      where: { kind: "PRUDENTIAL_LIMIT", code: DIVISION_POLICY_CODE, active: true },
      select: { config: true },
    });
    return row ? parseDivisionPolicy(row.config) : null;
  } catch {
    return null;
  }
}
