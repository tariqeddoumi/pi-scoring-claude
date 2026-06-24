// =====================================================================
//  auditService.ts
//  Journalisation systématique de tout changement et de tout calcul.
//  Conserve des snapshots avant/après pour la traçabilité réglementaire.
//  Accepte un client Prisma transactionnel pour s'inscrire dans la même
//  transaction qu'un run de scoring/classification/provisionnement.
// =====================================================================

import type { Prisma, PrismaClient, AuditAction } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ip?: string | null;
}

/** Sérialise une valeur en JSON Prisma-compatible (jamais undefined). */
function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

export async function recordAudit(entry: AuditEntry, db: Db = defaultPrisma) {
  return db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
      metadata: toJson(entry.metadata),
      ip: entry.ip ?? null,
    },
  });
}

/** Helper diff before/after pour les UPDATE — ne logge que les champs modifiés. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: T,
): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (before[k as keyof T] !== after[k as keyof T]) {
      b[k as keyof T] = before[k as keyof T];
      a[k as keyof T] = after[k as keyof T];
    }
  }
  return { before: b, after: a };
}
