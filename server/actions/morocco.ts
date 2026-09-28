"use server";

// Actions serveur — saisies alignées sur la pratique marocaine :
//  - chaîne d'autorisations du programme ;
//  - paramètres programme (nature, quotité de désengagement) ;
//  - financement de l'acquéreur par lot ;
//  - administration des référentiels (sans redéploiement).
// Toutes journalisées ; les saisies projet exigent project.write, l'édition
// du référentiel exige la permission d'administration du modèle.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { recordAudit } from "@/server/engines/auditService";
import { loadMoroccoReferentials, REFERENTIAL_KINDS } from "@/server/services/referentialLoader";

const PROGRAM_KINDS = ["LOTISSEMENT", "CONSTRUCTION", "MIXTE"] as const;

/** Enregistre l'état de la chaîne d'autorisations d'un projet. */
export async function saveProjectAuthorizations(
  projectId: string,
  items: { code: string; obtained: boolean; obtainedAt?: string | null; reference?: string | null }[],
) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  // Seuls les codes du référentiel actif sont acceptés.
  const refs = await loadMoroccoReferentials(prisma);
  const known = new Set(refs.chain.map((a) => a.code));
  const clean = items.filter((i) => known.has(i.code));
  if (clean.length === 0) return { ok: false as const, error: "Aucune autorisation reconnue." };

  await prisma.$transaction(async (tx) => {
    for (const i of clean) {
      const d = i.obtainedAt ? new Date(i.obtainedAt) : null;
      const data = {
        obtained: i.obtained,
        obtainedAt: d && !Number.isNaN(d.getTime()) ? d : null,
        reference: i.reference?.trim() || null,
      };
      await tx.projectAuthorization.upsert({
        where: { projectId_code: { projectId, code: i.code } },
        create: { projectId, code: i.code, ...data },
        update: data,
      });
    }
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ProjectAuthorization", entityId: projectId,
        after: { count: clean.length, obtained: clean.filter((c) => c.obtained).map((c) => c.code) },
        metadata: { projectId } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/suivi`);
  return { ok: true as const };
}

/** Met à jour la nature du programme et la quotité de désengagement. */
export async function updateProgramSettings(
  projectId: string,
  input: { programKind: string; releaseQuotityPct: string },
) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const kind = PROGRAM_KINDS.includes(input.programKind as (typeof PROGRAM_KINDS)[number])
    ? input.programKind
    : null;
  if (!kind) return { ok: false as const, error: "Nature de programme invalide." };

  let releaseQuotity: number | null = null;
  const raw = input.releaseQuotityPct?.trim();
  if (raw) {
    const pct = Number(raw.replace(",", "."));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return { ok: false as const, error: "La quotité de désengagement doit être comprise entre 0 et 100 %." };
    }
    releaseQuotity = Math.round((pct / 100) * 10000) / 10000;
  }

  await prisma.$transaction(async (tx) => {
    await tx.realEstateProject.update({
      where: { id: projectId },
      data: { programKind: kind, releaseQuotity },
    });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "RealEstateProject", entityId: projectId,
        after: { programKind: kind, releaseQuotity }, metadata: { projectId } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

/** Met à jour le financement de l'acquéreur pour un ensemble de lots. */
export async function updateUnitsBuyerFinancing(
  projectId: string,
  items: { unitId: string; financingStatus: string | null; aidScheme: string | null }[],
) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const refs = await loadMoroccoReferentials(prisma);
  const okFin = new Set(refs.financingList.map((f) => f.value));
  const okAid = new Set(refs.aidList.map((a) => a.value));

  await prisma.$transaction(async (tx) => {
    for (const i of items) {
      await tx.unit.update({
        where: { id: i.unitId },
        data: {
          buyerFinancingStatus: i.financingStatus && okFin.has(i.financingStatus) ? i.financingStatus : null,
          buyerAidScheme: i.aidScheme && okAid.has(i.aidScheme) ? i.aidScheme : null,
        },
      });
    }
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "Unit", entityId: projectId,
        after: { updated: items.length }, metadata: { projectId, source: "buyer_financing" } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}/suivi`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------
//  Administration des référentiels (paramétrage sans redéploiement)
// ---------------------------------------------------------------------

/** Crée ou met à jour un item de référentiel. */
export async function upsertReferentialItem(input: {
  kind: string;
  code: string;
  label: string;
  orderIndex?: number;
  active?: boolean;
  config?: string; // JSON saisi
  note?: string | null;
}) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.MODEL_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  if (!REFERENTIAL_KINDS.includes(input.kind as (typeof REFERENTIAL_KINDS)[number])) {
    return { ok: false as const, error: "Famille de référentiel inconnue." };
  }
  const code = input.code?.trim();
  const label = input.label?.trim();
  if (!code || !/^[a-z0-9_]+$/.test(code)) {
    return { ok: false as const, error: "Le code doit être en minuscules, chiffres et tirets bas." };
  }
  if (!label) return { ok: false as const, error: "Le libellé est requis." };

  let config: unknown = {};
  if (input.config?.trim()) {
    try {
      config = JSON.parse(input.config);
    } catch {
      return { ok: false as const, error: "Le paramétrage n'est pas un JSON valide." };
    }
  }

  const data = {
    label,
    orderIndex: Number.isFinite(input.orderIndex) ? Number(input.orderIndex) : 0,
    active: input.active !== false,
    config: config as never,
    note: input.note?.trim() || null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.referentialItem.upsert({
      where: { kind_code: { kind: input.kind, code } },
      create: { kind: input.kind, code, ...data },
      update: data,
    });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ReferentialItem", entityId: `${input.kind}:${code}`, after: data },
      tx,
    );
  });

  revalidatePath("/admin/referentiels");
  return { ok: true as const };
}

/** Active ou désactive un item de référentiel (jamais de suppression dure). */
export async function toggleReferentialItem(kind: string, code: string, active: boolean) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.MODEL_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }
  await prisma.$transaction(async (tx) => {
    await tx.referentialItem.update({ where: { kind_code: { kind, code } }, data: { active } });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "ReferentialItem", entityId: `${kind}:${code}`, after: { active } },
      tx,
    );
  });
  revalidatePath("/admin/referentiels");
  return { ok: true as const };
}
