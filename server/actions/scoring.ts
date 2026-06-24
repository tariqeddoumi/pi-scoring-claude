"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runFullScoring } from "@/server/services/scoringService";
import { scoringInputsSchema } from "@/lib/validation";
import { recordAudit } from "@/server/engines/auditService";
import { getCurrentAppUser } from "@/lib/supabase/server";

/** Sauvegarde des entrées du wizard (brouillon) puis option de calcul. */
export async function saveProjectInputs(
  projectId: string,
  rawInputs: Record<string, unknown>,
) {
  const parsed = scoringInputsSchema.safeParse(rawInputs);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const actor = await getCurrentAppUser();

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
  const actor = await getCurrentAppUser();
  if (!actor) return { ok: false as const, error: "Aucun acteur disponible (seed requis)." };

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
