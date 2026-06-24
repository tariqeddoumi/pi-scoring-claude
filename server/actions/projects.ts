"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { gfaVefaSchema } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/rbac";

/**
 * Met à jour le mode de vente (VEFA/classique) et la Garantie Financière
 * d'Achèvement d'un dossier. Réservé à project.write, journalisé. Le nouvel
 * effet sur le provisionnement s'applique au prochain calcul.
 */
export async function updateGfaVefa(projectId: string, raw: Record<string, unknown>) {
  const parsed = gfaVefaSchema.safeParse(raw);
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

  const data = {
    saleMode: d.saleMode,
    hasGFA: d.hasGFA,
    gfaAmount: d.hasGFA ? (d.gfaAmount ?? null) : null,
    gfaProvider: d.hasGFA ? (d.gfaProvider?.trim() || null) : null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.realEstateProject.update({ where: { id: projectId }, data });
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "RealEstateProject", entityId: projectId, after: data, metadata: { field: "gfa_vefa" } },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}
