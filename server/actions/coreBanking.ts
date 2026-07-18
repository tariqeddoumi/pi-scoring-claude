"use server";

// Action serveur — synchronisation du dossier depuis le SI bancaire
// (T24 / Evolan) : facilités & encours, échéancier & impayés, déblocages,
// restructuration. Idempotente (upsert par référence SI, déblocages
// dédoublonnés par référence). Tout est tracé (source = nom du SI) et les
// déblocages créés restent À RATTACHER MANUELLEMENT au planning du BP.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authorize, AuthorizationError } from "@/lib/authz";
import { recordAudit } from "@/server/engines/auditService";
import { PERMISSIONS } from "@/lib/rbac";
import { coreBankingProvider } from "@/server/services/coreBankingProvider";

export async function syncFromCoreBanking(projectId: string) {
  let actor;
  try {
    actor = await authorize(PERMISSIONS.PROJECT_WRITE);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
    throw e;
  }

  const project = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: { id: true, coreBankingRef: true },
  });
  if (!project) return { ok: false as const, error: "Projet introuvable." };
  if (!project.coreBankingRef?.trim()) {
    return {
      ok: false as const,
      error: "Aucune référence SI sur ce dossier : renseignez « Référence SI (T24/Evolan) » dans l'édition du projet.",
    };
  }

  let snapshot;
  try {
    snapshot = await coreBankingProvider.fetchSnapshot(project.coreBankingRef.trim());
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Synchronisation SI impossible." };
  }

  let facilitiesUpserted = 0;
  let disbursementsCreated = 0;
  let restructurationCreated = false;

  await prisma.$transaction(async (tx) => {
    // 1. Facilités & échéanciers (remplacés par la vérité SI, clé externalRef).
    for (const f of snapshot.facilities) {
      const existing = await tx.facility.findFirst({
        where: { projectId, externalRef: f.externalRef },
        select: { id: true },
      });
      const data = {
        label: f.label ?? `Facilité ${f.externalRef}`,
        authorizedAmount: f.authorizedAmount,
        drawnAmount: f.drawnAmount,
        reservedAgios: f.reservedAgios ?? 0,
      };
      const facility = existing
        ? await tx.facility.update({ where: { id: existing.id }, data })
        : await tx.facility.create({ data: { projectId, externalRef: f.externalRef, ...data } });
      facilitiesUpserted += 1;

      await tx.installment.deleteMany({ where: { facilityId: facility.id } });
      if (f.installments.length > 0) {
        await tx.installment.createMany({
          data: f.installments.map((i) => ({
            facilityId: facility.id,
            seq: i.seq,
            dueDate: new Date(i.dueDate),
            amountDue: i.amountDue,
            amountPaid: i.amountPaid,
          })),
        });
      }
    }

    // 2. Déblocages : un événement « deblocage » par référence SI (dédoublonné),
    //    à rattacher MANUELLEMENT au planning du BP (milestoneId laissé vide).
    for (const d of snapshot.disbursements) {
      const already = await tx.projectEvent.findFirst({
        where: { projectId, type: "deblocage", title: d.ref },
        select: { id: true },
      });
      if (already) continue;
      await tx.projectEvent.create({
        data: {
          projectId,
          type: "deblocage",
          severity: "INFO",
          title: d.ref,
          eventDate: new Date(d.date),
          amount: d.amount,
          note: d.facilityRef ? `Facilité ${d.facilityRef} (import ${snapshot.source})` : `Import ${snapshot.source}`,
          affectsScoring: false,
          source: snapshot.source,
          createdById: actor.id,
        },
      });
      disbursementsCreated += 1;
    }

    // 3. Restructuration signalée côté SI : événement matériel (une seule fois).
    if (snapshot.restructured) {
      const existing = await tx.projectEvent.findFirst({
        where: { projectId, type: "restructuration", source: snapshot.source },
        select: { id: true },
      });
      if (!existing) {
        await tx.projectEvent.create({
          data: {
            projectId,
            type: "restructuration",
            severity: "CRITICAL",
            title: `Restructuration (${snapshot.source})`,
            eventDate: new Date(snapshot.asOf),
            affectsScoring: true,
            source: snapshot.source,
            createdById: actor.id,
          },
        });
        restructurationCreated = true;
      }
    }

    await recordAudit(
      {
        actorId: actor.id,
        action: "IMPORT",
        entity: "RealEstateProject",
        entityId: projectId,
        after: {
          facilities: facilitiesUpserted,
          disbursements: disbursementsCreated,
          restructured: snapshot.restructured,
        },
        metadata: { source: snapshot.source, asOf: snapshot.asOf, coreBankingRef: project.coreBankingRef },
      },
      tx,
    );
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/suivi`);
  return {
    ok: true as const,
    source: snapshot.source,
    asOf: snapshot.asOf,
    facilitiesUpserted,
    disbursementsCreated,
    restructurationCreated,
  };
}
