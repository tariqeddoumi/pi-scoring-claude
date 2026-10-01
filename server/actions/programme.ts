"use server";

// Actions serveur du modèle v5 : périmètre financé (tranche financée, facilité
// rattachée à une tranche) et équipements exigés (mosquée, école, voirie…).
// Toutes exigent project.write, vérifient que l'objet appartient au projet et
// sont journalisées.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";
import { recordAudit } from "@/server/engines/auditService";
import { EQUIPMENT_FUNDERS, EQUIPMENT_KINDS, EQUIPMENT_ORIGINS } from "@/lib/domain/programmeV5";

async function actorOrError() {
  try {
    return { actor: await authorize(PERMISSIONS.PROJECT_WRITE) };
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: e.message };
    throw e;
  }
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/suivi`);
}

/** Marque une tranche comme financée (ou non) par la banque. */
export async function setTrancheFinanced(projectId: string, trancheId: string, financed: boolean) {
  const a = await actorOrError();
  if ("error" in a) return { ok: false as const, error: a.error };
  const t = await prisma.tranche.findFirst({ where: { id: trancheId, projectId }, select: { id: true } });
  if (!t) return { ok: false as const, error: "Tranche introuvable pour ce projet." };
  await prisma.$transaction(async (tx) => {
    await tx.tranche.update({ where: { id: trancheId }, data: { financed } });
    await recordAudit({ actorId: a.actor.id, action: "UPDATE", entity: "Tranche", entityId: trancheId, after: { financed }, metadata: { projectId } }, tx);
  });
  revalidate(projectId);
  return { ok: true as const };
}

/** Rattache une facilité à une tranche (null = programme entier). */
export async function setFacilityTranche(projectId: string, facilityId: string, trancheId: string | null) {
  const a = await actorOrError();
  if ("error" in a) return { ok: false as const, error: a.error };
  const f = await prisma.facility.findFirst({ where: { id: facilityId, projectId }, select: { id: true } });
  if (!f) return { ok: false as const, error: "Facilité introuvable pour ce projet." };
  if (trancheId) {
    const t = await prisma.tranche.findFirst({ where: { id: trancheId, projectId }, select: { id: true } });
    if (!t) return { ok: false as const, error: "Tranche introuvable pour ce projet." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.facility.update({ where: { id: facilityId }, data: { trancheId } });
    await recordAudit({ actorId: a.actor.id, action: "UPDATE", entity: "Facility", entityId: facilityId, after: { trancheId }, metadata: { projectId } }, tx);
  });
  revalidate(projectId);
  return { ok: true as const };
}

/** Déclare les obligations d'équipements : true (liste), false (aucun), null (non déclaré). */
export async function setEquipmentDeclared(projectId: string, declared: boolean | null) {
  const a = await actorOrError();
  if ("error" in a) return { ok: false as const, error: a.error };
  if (declared === false) {
    const n = await prisma.projectEquipment.count({ where: { projectId } });
    if (n > 0) return { ok: false as const, error: "Des équipements sont saisis : supprimez-les avant de déclarer « aucun équipement exigé »." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.realEstateProject.update({ where: { id: projectId }, data: { equipmentDeclared: declared } });
    await recordAudit({ actorId: a.actor.id, action: "UPDATE", entity: "RealEstateProject", entityId: projectId, after: { equipmentDeclared: declared }, metadata: { projectId } }, tx);
  });
  revalidate(projectId);
  return { ok: true as const };
}

export interface EquipmentInput {
  id?: string;
  kind: string;
  label: string;
  origin?: string | null;
  estimatedCost?: string | number | null;
  budgeted?: boolean;
  fundedBy?: string | null;
  progressPct?: string | number | null;
  dueDate?: string | null;
  conditionsDelivery?: boolean;
  handedOver?: boolean;
  trancheId?: string | null;
  note?: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const inList = (v: string | null | undefined, list: { value: string }[]) => (v && list.some((x) => x.value === v) ? v : null);

/** Crée ou met à jour un équipement exigé. */
export async function saveEquipment(projectId: string, input: EquipmentInput) {
  const a = await actorOrError();
  if ("error" in a) return { ok: false as const, error: a.error };
  const kind = inList(input.kind, EQUIPMENT_KINDS);
  if (!kind) return { ok: false as const, error: "Type d'équipement invalide." };
  if (!input.label?.trim()) return { ok: false as const, error: "Libellé requis." };
  const cost = num(input.estimatedCost);
  const progress = num(input.progressPct);
  if (Number.isNaN(cost) || (cost !== null && cost < 0)) return { ok: false as const, error: "Coût estimé invalide." };
  if (Number.isNaN(progress) || (progress !== null && (progress < 0 || progress > 100))) return { ok: false as const, error: "Avancement entre 0 et 100 %." };
  const due = input.dueDate ? new Date(input.dueDate) : null;
  if (due && Number.isNaN(due.getTime())) return { ok: false as const, error: "Date d'échéance invalide." };
  if (input.trancheId) {
    const t = await prisma.tranche.findFirst({ where: { id: input.trancheId, projectId }, select: { id: true } });
    if (!t) return { ok: false as const, error: "Tranche introuvable pour ce projet." };
  }
  if (input.id) {
    const e = await prisma.projectEquipment.findFirst({ where: { id: input.id, projectId }, select: { id: true } });
    if (!e) return { ok: false as const, error: "Équipement introuvable pour ce projet." };
  }
  const data = {
    kind, label: input.label.trim(), origin: inList(input.origin, EQUIPMENT_ORIGINS), estimatedCost: cost,
    budgeted: !!input.budgeted, fundedBy: inList(input.fundedBy, EQUIPMENT_FUNDERS), progressPct: progress ?? 0, dueDate: due,
    conditionsDelivery: !!input.conditionsDelivery, handedOver: !!input.handedOver, trancheId: input.trancheId || null,
    note: input.note?.trim() || null,
  };
  const saved = await prisma.$transaction(async (tx) => {
    const r = input.id
      ? await tx.projectEquipment.update({ where: { id: input.id }, data, select: { id: true } })
      : await tx.projectEquipment.create({ data: { projectId, ...data }, select: { id: true } });
    // Saisir un équipement vaut déclaration des obligations.
    await tx.realEstateProject.update({ where: { id: projectId }, data: { equipmentDeclared: true } });
    await recordAudit({ actorId: a.actor.id, action: input.id ? "UPDATE" : "CREATE", entity: "ProjectEquipment", entityId: r.id, after: data, metadata: { projectId } }, tx);
    return r;
  });
  revalidate(projectId);
  return { ok: true as const, id: saved.id };
}

export async function deleteEquipment(projectId: string, equipmentId: string) {
  const a = await actorOrError();
  if ("error" in a) return { ok: false as const, error: a.error };
  const e = await prisma.projectEquipment.findFirst({ where: { id: equipmentId, projectId } });
  if (!e) return { ok: false as const, error: "Équipement introuvable pour ce projet." };
  await prisma.$transaction(async (tx) => {
    await tx.projectEquipment.delete({ where: { id: equipmentId } });
    await recordAudit({ actorId: a.actor.id, action: "DELETE", entity: "ProjectEquipment", entityId: equipmentId, before: e, metadata: { projectId } }, tx);
  });
  revalidate(projectId);
  return { ok: true as const };
}
