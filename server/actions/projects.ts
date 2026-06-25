"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { gfaVefaSchema, riskCalibrationSchema } from "@/lib/validation";
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
    assetType: d.assetType,
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

/**
 * Met à jour le calibrage actif des paramètres de risque (PD par catégorie de
 * slotting, LGD, maturité). Réservé à model.write, journalisé. Affecte les
 * métriques Bâle/IFRS 9 au prochain rendu.
 */
export async function updateRiskCalibration(raw: Record<string, unknown>) {
  const parsed = riskCalibrationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  if (d.lgdFloor > d.lgdUnsecured) {
    return { ok: false as const, error: "Le plancher LGD ne peut excéder la LGD non garantie." };
  }

  let actor;
  try {
    actor = await authorize(PERMISSIONS.MODEL_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    const active = await tx.riskCalibration.findFirst({ where: { active: true } });
    if (active) {
      await tx.riskCalibration.update({ where: { id: active.id }, data: d });
    } else {
      await tx.riskCalibration.create({ data: { ...d, active: true } });
    }
    await recordAudit(
      { actorId: actor.id, action: "UPDATE", entity: "RiskCalibration", entityId: active?.id ?? "new", after: d },
      tx,
    );
  });

  revalidatePath("/admin/calibration");
  revalidatePath("/risk");
  return { ok: true as const };
}
