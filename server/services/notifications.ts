// Collecte des données des notifications (voir lib/domain/notifications.ts).
// Périmètre : un chargé d'affaires voit ses dossiers ; les autres profils voient
// tout le portefeuille.

import { prisma } from "@/lib/prisma";
import { scoreFreshness } from "@/lib/domain/reviewPolicy";
import { hasMaterialEventSince, eventsRequiringCommitteeSince } from "@/lib/domain/eventSignals";
import { readScoringRunDetails } from "@/lib/domain/scoringRunDetails";
import { projectNotifications, sortNotifications, type Notification } from "@/lib/domain/notifications";
import type { RedFlagOutcome, RegulatoryClassCode } from "@/lib/domain/types";

export async function loadNotifications(user: { id: string; role: { name: string } }, now: Date = new Date()): Promise<Notification[]> {
  const onlyMine = user.role.name === "RELATIONSHIP_MANAGER";
  const projects = await prisma.realEstateProject.findMany({
    where: onlyMine ? { rmId: user.id } : undefined,
    select: {
      id: true, reference: true, name: true,
      scoringRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, triggeredRedFlags: true, details: true } },
      classificationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { resultClass: true } },
      events: { select: { id: true, type: true, title: true, severity: true, eventDate: true, endDate: true, resolved: true, affectsScoring: true, requiresCommittee: true } },
      committeeDecisions: { orderBy: { createdAt: "desc" }, take: 1, select: { outcome: true, validUntil: true, conditions: true } },
      workflowSteps: { orderBy: { createdAt: "desc" }, take: 1, select: { toState: true } },
      facilities: { select: { drawnAmount: true } },
      equipments: { select: { id: true, label: true, dueDate: true, conditionsDelivery: true, handedOver: true, progressPct: true } },
    },
  });

  const all: Notification[] = [];
  for (const p of projects) {
    const run = p.scoringRuns[0];
    const lastRun = run?.createdAt ?? null;
    const freshness = scoreFreshness({
      lastScoredAt: lastRun,
      cls: (p.classificationRuns[0]?.resultClass as RegulatoryClassCode | undefined) ?? null,
      materialEventSince: hasMaterialEventSince(p.events, lastRun),
      committeeEventSince: eventsRequiringCommitteeSince(p.events, lastRun).length > 0,
      now,
    });
    const state = p.workflowSteps[0]?.toState ?? "DRAFT";
    const drawn = p.facilities.reduce((s, f) => s + (f.drawnAmount ?? 0), 0);
    const redFlags = Array.isArray(run?.triggeredRedFlags) ? (run!.triggeredRedFlags as unknown as RedFlagOutcome[]) : [];
    all.push(...projectNotifications({
      id: p.id, reference: p.reference, name: p.name, freshness,
      committee: p.committeeDecisions[0] ?? null,
      redFlags,
      committeeFlags: readScoringRunDetails(run?.details)?.committeeFlags ?? [],
      criticalEvents: p.events.filter((e) => e.severity === "CRITICAL" && !e.resolved),
      equipments: p.equipments,
      inApprovalCircuit: state !== "REJECTED" && drawn <= 0,
    }, now));
  }
  return sortNotifications(all);
}
