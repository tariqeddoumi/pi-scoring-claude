// =====================================================================
//  programmeV5Service.ts — Données du modèle v5 dérivées du suivi d'un
//  projet (régionalité, périmètre financé, programme mixte, désistements,
//  équipements exigés, déblocages). Utilisé par la synchronisation vers le
//  scoring ET par l'écran de suivi : ce qui est affiché est exactement ce qui
//  sera reporté dans la saisie.
// =====================================================================

import { prisma } from "@/lib/prisma";
import { loadMoroccoReferentials, loadRegionalMarkets } from "@/server/services/referentialLoader";
import { aggregateSales } from "@/lib/domain/commercialisation";
import {
  financedPerimeter, inPerimeter, perimeterProgress, regionalTensionFor, programmeComposition, cancellationRatePct,
  assessEquipments, assessDrawdown, certifiedProgress, drawdownScheduleLate, PRODUCT_CLASS_LABELS,
} from "@/lib/domain/programmeV5";
import { reconcileDisbursements } from "@/lib/domain/disbursementPlan";

export type Note = { key: string; label: string; value?: string; reason: string };

/**
 * Données du modèle v5 dérivées du suivi : tension du marché régional,
 * périmètre financé (autonomie, prévente du périmètre), composition du
 * programme, désistements, équipements exigés, déblocages vs avancement et
 * vs calendrier. Une donnée non calculable n'est pas renvoyée.
 */
export async function deriveV5Inputs(
  projectId: string,
  visitProgressPct: number | null,
): Promise<{ values: Record<string, string | number | boolean>; notes: Note[] }> {
  const values: Record<string, string | number | boolean> = {};
  const notes: Note[] = [];
  const p = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: {
      region: true, segment: true, totalCost: true, equipmentDeclared: true,
      tranches: {
        select: {
          id: true, code: true, financed: true, progressPct: true, budget: true,
          units: { select: { type: true, status: true, soldPrice: true, listPrice: true, plannedPrice: true } },
        },
      },
      facilities: { select: { authorizedAmount: true, drawnAmount: true, nature: true, trancheId: true, status: true } },
      equipments: true,
      disbursementMilestones: {
        select: { id: true, seq: true, label: true, plannedDate: true, plannedAmount: true, worksCertifiedPct: true, trancheId: true },
      },
    },
  });
  if (!p) return { values, notes };

  // 1. Régionalité
  const regional = regionalTensionFor(p.region, p.segment, await loadRegionalMarkets(prisma));
  if (regional.tension) values.regional_market_tension = regional.tension;
  notes.push({ key: "regional_market_tension", label: "Tension du marché régional", value: regional.tension, reason: regional.reason });

  // 2. Périmètre financé
  const facilities = p.facilities.filter((f) => f.status !== "CLOSED");
  const per = financedPerimeter(p.tranches.map((t) => ({ id: t.id, financed: t.financed })), facilities.map((f) => f.trancheId));
  if (per.wholeProgramme) {
    values.tranche_dependency = "programme_entier";
    notes.push({ key: "tranche_dependency", label: "Périmètre financé", value: "programme entier", reason: "Aucune tranche isolée : le financement porte sur le programme entier." });
  } else {
    notes.push({ key: "tranche_dependency", label: "Périmètre financé", value: per.label, reason: "Financement par tranche : appréciez l'autonomie de la tranche (accès, VRD, raccordements) dans la saisie." });
  }
  const perTranches = p.tranches.filter((t) => inPerimeter(per, t.id));
  const units = perTranches.flatMap((t) => t.units);
  if (!per.wholeProgramme && units.length > 0) {
    const sales = aggregateSales(units.map((u) => ({ status: u.status })) as Parameters<typeof aggregateSales>[0]);
    values.pre_sale_rate = Math.round(sales.preSaleRatePct * 10) / 10;
    notes.push({ key: "pre_sale_rate", label: "Préventes du périmètre financé", value: `${values.pre_sale_rate} %`, reason: `Calculées sur ${per.label}, et non sur le programme entier.` });
  }

  // 3. Programme mixte et désistements
  const comp = programmeComposition(units.map((u) => ({ type: u.type, status: u.status, price: u.soldPrice ?? u.listPrice ?? u.plannedPrice })));
  if (comp.slowLiquiditySharePct !== undefined) {
    values.slow_liquidity_share_pct = comp.slowLiquiditySharePct;
    const parts = (Object.keys(comp.byClass) as (keyof typeof comp.byClass)[]).filter((k) => comp.byClass[k].units > 0)
      .map((k) => `${PRODUCT_CLASS_LABELS[k].split(" (")[0]} ${comp.byClass[k].sharePct} %`);
    notes.push({ key: "slow_liquidity_share_pct", label: "Composition du programme", value: `${comp.slowLiquiditySharePct} % à écoulement lent`, reason: parts.join(" · ") + "." });
  }
  const cancel = cancellationRatePct(units);
  if (cancel !== undefined) {
    values.cancellation_rate_pct = cancel;
    notes.push({ key: "cancellation_rate_pct", label: "Désistements", value: `${cancel} %`, reason: "Désistements rapportés aux engagements du périmètre financé." });
  }

  // 4. Équipements exigés
  const progress = perimeterProgress(p.tranches.map((t) => ({ id: t.id, financed: t.financed, progressPct: t.progressPct, budget: t.budget })), per);
  const eq = assessEquipments(
    p.equipments.map((e) => ({ label: e.label, kind: e.kind, estimatedCost: e.estimatedCost, budgeted: e.budgeted, fundedBy: e.fundedBy,
      progressPct: e.progressPct, dueDate: e.dueDate, conditionsDelivery: e.conditionsDelivery, handedOver: e.handedOver, trancheId: e.trancheId })),
    { declared: p.equipmentDeclared, programmeCost: p.totalCost, programmeProgressPct: progress ?? visitProgressPct },
  );
  if (eq.unbudgetedPct !== undefined) values.equipment_unbudgeted_pct = eq.unbudgetedPct;
  if (eq.deliveryAtRisk !== undefined) values.equipment_delivery_at_risk = eq.deliveryAtRisk;
  notes.push({ key: "equipment_unbudgeted_pct", label: "Équipements exigés", value: eq.unbudgetedPct !== undefined ? `${eq.unbudgetedPct} % non budgétés` : undefined, reason: eq.reason });

  // 5. Déblocages vs avancement et vs calendrier
  const refs = await loadMoroccoReferentials(prisma);
  const milestones = p.disbursementMilestones.filter((m) => per.wholeProgramme || !m.trancheId || inPerimeter(per, m.trancheId));
  const prog = certifiedProgress({ certifiedPcts: milestones.map((m) => m.worksCertifiedPct), perimeterProgressPct: progress, visitProgressPct });
  const perFacilities = facilities.filter((f) => per.wholeProgramme || !f.trancheId || inPerimeter(per, f.trancheId));
  const dd = assessDrawdown(
    perFacilities.map((f) => ({ authorizedAmount: f.authorizedAmount, drawnAmount: f.drawnAmount, worksFinancing: f.nature ? refs.natures.get(f.nature)?.requiresWorksCertificate === true : null })),
    prog,
  );
  if (dd.drawdownVsProgressPct !== undefined) {
    values.drawdown_vs_progress_pct = dd.drawdownVsProgressPct;
    values.drawdown_ahead_of_works = dd.aheadOfWorks === true;
  }
  notes.push({ key: "drawdown_vs_progress_pct", label: "Déblocages vs avancement", value: dd.drawdownVsProgressPct !== undefined ? `${dd.drawdownVsProgressPct} %` : undefined, reason: dd.reason });
  if (milestones.length > 0) {
    const events = await prisma.projectEvent.findMany({
      where: { projectId, type: "deblocage", milestoneId: { in: milestones.map((m) => m.id) } },
      select: { id: true, eventDate: true, amount: true, milestoneId: true },
    });
    const rec = reconcileDisbursements(milestones, events);
    const late = drawdownScheduleLate(rec.rows);
    if (late.late !== undefined) values.drawdown_schedule_late = late.late;
    notes.push({ key: "drawdown_schedule_late", label: "Plan de tirage", value: late.gapPct !== undefined ? `${late.gapPct} % en retard` : undefined, reason: late.reason });
  }
  return { values, notes };
}

/** Vue de l'écran « Programme, tranche, équipements et déblocages ». */
export async function loadProgrammeV5View(projectId: string) {
  const p = await prisma.realEstateProject.findUnique({
    where: { id: projectId },
    select: {
      id: true, region: true, segment: true, equipmentDeclared: true,
      tranches: { orderBy: { orderIndex: "asc" }, select: { id: true, code: true, name: true, financed: true, progressPct: true, budget: true, _count: { select: { units: true } } } },
      facilities: { orderBy: { createdAt: "asc" }, select: { id: true, label: true, trancheId: true, authorizedAmount: true, drawnAmount: true, nature: true, status: true } },
      equipments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!p) return null;
  const visit = await prisma.visitReport.findFirst({
    where: { projectId, observedProgressPct: { not: null } },
    orderBy: { visitDate: "desc" },
    select: { observedProgressPct: true },
  });
  const derived = await deriveV5Inputs(projectId, visit?.observedProgressPct ?? null);
  return {
    region: p.region,
    segment: p.segment,
    equipmentDeclared: p.equipmentDeclared,
    tranches: p.tranches.map((t) => ({ id: t.id, code: t.code, name: t.name, financed: t.financed, progressPct: t.progressPct, units: t._count.units })),
    facilities: p.facilities.map((f) => ({ id: f.id, label: f.label, trancheId: f.trancheId, authorizedAmount: f.authorizedAmount, drawnAmount: f.drawnAmount, nature: f.nature, closed: f.status === "CLOSED" })),
    equipments: p.equipments.map((e) => ({
      id: e.id, kind: e.kind, label: e.label, origin: e.origin, estimatedCost: e.estimatedCost, budgeted: e.budgeted, fundedBy: e.fundedBy,
      progressPct: e.progressPct, dueDate: e.dueDate ? e.dueDate.toISOString().slice(0, 10) : null, conditionsDelivery: e.conditionsDelivery,
      handedOver: e.handedOver, trancheId: e.trancheId, note: e.note,
    })),
    values: derived.values,
    notes: derived.notes,
  };
}
