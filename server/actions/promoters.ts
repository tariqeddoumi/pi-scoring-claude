"use server";

// Actions serveur — signalétique promoteur et liens entre promoteurs
// (parties liées). Réservées à project.write, journalisées.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { promoterUpsertSchema, promoterLinkSchema } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/rbac";

/** Crée ou met à jour la signalétique d'un promoteur. */
export async function upsertPromoter(raw: Record<string, unknown>) {
  const parsed = promoterUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const s = (v?: string) => (v?.trim() ? v.trim() : null);
  const data = {
    name: d.name.trim(),
    legalForm: s(d.legalForm),
    rcNumber: s(d.rcNumber),
    iceNumber: s(d.iceNumber),
    ifNumber: s(d.ifNumber),
    cnssNumber: s(d.cnssNumber),
    patenteNumber: s(d.patenteNumber),
    capital: d.capital ?? null,
    foundedYear: d.foundedYear ?? null,
    managerName: s(d.managerName),
    shareholders: s(d.shareholders),
    address: s(d.address),
    city: s(d.city),
    website: s(d.website),
    contactEmail: s(d.contactEmail),
    contactPhone: s(d.contactPhone),
    yearsExperience: d.yearsExperience ?? null,
    completedProjects: d.completedProjects ?? null,
    internalRating: s(d.internalRating),
    bankRelations: s(d.bankRelations),
    notes: s(d.notes),
    groupId: d.groupId || null,
  };

  let promoterId = d.id;
  await prisma.$transaction(async (tx) => {
    if (d.id) {
      await tx.promoter.update({ where: { id: d.id }, data });
      await recordAudit({ actorId: actor.id, action: "UPDATE", entity: "Promoter", entityId: d.id, after: data }, tx);
    } else {
      const created = await tx.promoter.create({ data });
      promoterId = created.id;
      await recordAudit({ actorId: actor.id, action: "CREATE", entity: "Promoter", entityId: created.id, after: data }, tx);
    }
  });

  revalidatePath("/promoters");
  if (d.id) revalidatePath(`/promoters/${d.id}`);
  redirect(`/promoters/${promoterId}`);
}

/** Ajoute un lien entre deux promoteurs (partie liée). */
export async function addPromoterLink(raw: Record<string, unknown>) {
  const parsed = promoterLinkSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.promoterLink.create({
        data: { fromId: d.fromId, toId: d.toId, type: d.type, note: d.note?.trim() || null },
      });
      await recordAudit(
        { actorId: actor.id, action: "CREATE", entity: "PromoterLink", entityId: created.id, after: { fromId: d.fromId, toId: d.toId, type: d.type } },
        tx,
      );
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false as const, error: "Ce lien existe déjà entre ces deux promoteurs." };
    }
    throw e;
  }

  revalidatePath(`/promoters/${d.fromId}`);
  revalidatePath(`/promoters/${d.toId}`);
  return { ok: true as const };
}

/** Supprime un lien entre promoteurs. */
export async function removePromoterLink(linkId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const link = await prisma.promoterLink.findUnique({ where: { id: linkId } });
  if (!link) return { ok: false as const, error: "Lien introuvable." };

  await prisma.$transaction(async (tx) => {
    await tx.promoterLink.delete({ where: { id: linkId } });
    await recordAudit(
      { actorId: actor.id, action: "DELETE", entity: "PromoterLink", entityId: linkId, after: { fromId: link.fromId, toId: link.toId, type: link.type } },
      tx,
    );
  });

  revalidatePath(`/promoters/${link.fromId}`);
  revalidatePath(`/promoters/${link.toId}`);
  return { ok: true as const };
}
