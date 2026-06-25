"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runFullScoring } from "@/server/services/scoringService";
import { scoringInputsSchema, exploitationInputsSchema } from "@/lib/validation";
import { recordAudit } from "@/server/engines/auditService";
import { authorize, AuthorizationError } from "@/lib/authz";
import { PERMISSIONS } from "@/lib/rbac";

/** Sauvegarde des entrées du wizard (brouillon) puis option de calcul. */
export async function saveProjectInputs(
  projectId: string,
  rawInputs: Record<string, unknown>,
) {
  // Le jeu d'entrées attendu dépend de la nature de l'actif (promotion vs
  // exploitation), qui détermine le modèle de scoring applicable.
  const project = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: { assetType: true },
  });
  const schema = project?.assetType === "EXPLOITATION" ? exploitationInputsSchema : scoringInputsSchema;
  const parsed = schema.safeParse(rawInputs);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  // Deny‑by‑default : écriture réservée à la permission project.write.
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed.data)) {
      const data = {
        valueNum: typeof value === "number" ? value : null,
        valueStr: typeof value === "string" ? value : null,
        valueBool: typeof value === "boolean" ? value : null,
      };
      await tx.projectInput.upsert({
        where: { projectId_key: { projectId, key } },
        create: { projectId, key, ...data },
        update: data,
      });
    }
    await recordAudit(
      { actorId: actor?.id, action: "UPDATE", entity: "ProjectInput", entityId: projectId, after: parsed.data },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true as const };
}

/** Lance le pipeline complet de scoring/classification/provisionnement. */
export async function runScoringAction(projectId: string, ead?: number, reservedAgios?: number) {
  // Deny‑by‑default : lancement de scoring réservé à la permission scoring.run.
  let actor;
  try {
    actor = await authorize(PERMISSIONS.SCORING_RUN);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const result = await runFullScoring({
    projectId,
    actorId: actor.id,
    ead,
    reservedAgios,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/scoring`);
  revalidatePath("/");
  return {
    ok: true as const,
    scoreFinal: result.scoring.scoreFinal,
    decision: result.scoring.decision,
    resultClass: result.classification.resultClass,
    provisionAmount: result.provision.provisionAmount,
  };
}
