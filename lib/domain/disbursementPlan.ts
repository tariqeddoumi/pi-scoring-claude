// =====================================================================
//  disbursementPlan.ts — Rapprochement du planning des déblocages du
//  BUSINESS PLAN INITIAL avec les déblocages réels (événements « deblocage »,
//  saisis ou synchronisés du SI, rattachés MANUELLEMENT aux jalons).
//  Mesure par jalon le réalisé, l'écart et le statut, et liste les
//  déblocages non rattachés. Logique PURE et testable.
// =====================================================================

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface MilestoneView {
  id: string;
  seq: number;
  label: string;
  plannedDate: Date | string | null;
  plannedAmount: number;
}

export interface DisbursementEventView {
  id: string;
  eventDate: Date | string;
  amount: number | null;
  milestoneId: string | null;
  title?: string | null;
  source?: string;
}

export type MilestoneStatus = "A_VENIR" | "PARTIEL" | "DEBLOQUE" | "DEPASSE";

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  A_VENIR: "À venir",
  PARTIEL: "Partiellement débloqué",
  DEBLOQUE: "Débloqué",
  DEPASSE: "Dépassé (au-delà du prévu)",
};

export interface MilestoneReconciliation {
  id: string;
  seq: number;
  label: string;
  plannedDate: Date | string | null;
  plannedAmount: number;
  realizedAmount: number;
  gap: number; // réalisé − prévu
  status: MilestoneStatus;
  eventIds: string[];
  /** Jalon daté, échu et non intégralement débloqué. */
  late: boolean;
}

export interface DisbursementPlanReconciliation {
  rows: MilestoneReconciliation[];
  unlinked: DisbursementEventView[];
  totals: {
    planned: number;
    realized: number; // rattaché aux jalons
    unlinkedAmount: number; // débloqué mais non rattaché
    executionPct: number | null; // réalisé rattaché / prévu (%)
  };
}

/** Rapproche les jalons du plan des déblocages réels rattachés. */
export function reconcileDisbursements(
  milestones: MilestoneView[],
  events: DisbursementEventView[],
  now: Date = new Date(),
): DisbursementPlanReconciliation {
  const byMilestone = new Map<string, DisbursementEventView[]>();
  const unlinked: DisbursementEventView[] = [];
  for (const e of events) {
    if (e.milestoneId) {
      const list = byMilestone.get(e.milestoneId) ?? [];
      list.push(e);
      byMilestone.set(e.milestoneId, list);
    } else {
      unlinked.push(e);
    }
  }

  const rows: MilestoneReconciliation[] = [...milestones]
    .sort((a, b) => a.seq - b.seq)
    .map((m) => {
      const linked = byMilestone.get(m.id) ?? [];
      const realizedAmount = round2(linked.reduce((s, e) => s + (e.amount ?? 0), 0));
      const gap = round2(realizedAmount - m.plannedAmount);
      let status: MilestoneStatus;
      if (realizedAmount <= 0) status = "A_VENIR";
      else if (realizedAmount < m.plannedAmount) status = "PARTIEL";
      else if (realizedAmount === m.plannedAmount) status = "DEBLOQUE";
      else status = "DEPASSE";
      const due = m.plannedDate ? new Date(m.plannedDate).getTime() : null;
      const late = due != null && due < now.getTime() && realizedAmount < m.plannedAmount;
      return {
        id: m.id,
        seq: m.seq,
        label: m.label,
        plannedDate: m.plannedDate,
        plannedAmount: m.plannedAmount,
        realizedAmount,
        gap,
        status,
        eventIds: linked.map((e) => e.id),
        late,
      };
    });

  const planned = round2(rows.reduce((s, r) => s + r.plannedAmount, 0));
  const realized = round2(rows.reduce((s, r) => s + r.realizedAmount, 0));
  const unlinkedAmount = round2(unlinked.reduce((s, e) => s + (e.amount ?? 0), 0));

  return {
    rows,
    unlinked,
    totals: {
      planned,
      realized,
      unlinkedAmount,
      executionPct: planned > 0 ? round2((realized / planned) * 100) : null,
    },
  };
}
