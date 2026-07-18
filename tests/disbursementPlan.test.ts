import { describe, it, expect } from "vitest";
import { reconcileDisbursements } from "@/lib/domain/disbursementPlan";

const NOW = new Date("2026-07-15T00:00:00Z");

const M1 = { id: "m1", seq: 1, label: "Acquisition foncier", plannedDate: "2026-01-31", plannedAmount: 10_000_000 };
const M2 = { id: "m2", seq: 2, label: "Gros œuvre", plannedDate: "2026-09-30", plannedAmount: 20_000_000 };

const ev = (id: string, amount: number, milestoneId: string | null, date = "2026-02-10") => ({
  id, eventDate: date, amount, milestoneId,
});

describe("disbursementPlan — rapprochement plan vs réalisé", () => {
  it("agrège les déblocages rattachés par jalon et calcule l'écart", () => {
    const r = reconcileDisbursements([M1, M2], [ev("e1", 6_000_000, "m1"), ev("e2", 4_000_000, "m1")], NOW);
    const row = r.rows.find((x) => x.id === "m1")!;
    expect(row.realizedAmount).toBe(10_000_000);
    expect(row.gap).toBe(0);
    expect(row.status).toBe("DEBLOQUE");
  });

  it("statuts : à venir, partiel, dépassé", () => {
    const r = reconcileDisbursements(
      [M1, M2],
      [ev("e1", 4_000_000, "m1"), ev("e2", 25_000_000, "m2")],
      NOW,
    );
    expect(r.rows.find((x) => x.id === "m1")!.status).toBe("PARTIEL");
    expect(r.rows.find((x) => x.id === "m2")!.status).toBe("DEPASSE");
    const empty = reconcileDisbursements([M2], [], NOW);
    expect(empty.rows[0]!.status).toBe("A_VENIR");
  });

  it("jalon échu non intégralement débloqué → en retard", () => {
    const r = reconcileDisbursements([M1], [ev("e1", 4_000_000, "m1")], NOW);
    expect(r.rows[0]!.late).toBe(true); // date prévue 31/01 dépassée
    const future = reconcileDisbursements([M2], [], NOW);
    expect(future.rows[0]!.late).toBe(false); // 30/09 à venir
  });

  it("liste les déblocages non rattachés et leur montant", () => {
    const r = reconcileDisbursements([M1], [ev("e1", 3_000_000, null), ev("e2", 2_000_000, "m1")], NOW);
    expect(r.unlinked).toHaveLength(1);
    expect(r.totals.unlinkedAmount).toBe(3_000_000);
    expect(r.totals.realized).toBe(2_000_000);
  });

  it("taux d'exécution = réalisé rattaché / prévu", () => {
    const r = reconcileDisbursements([M1, M2], [ev("e1", 15_000_000, "m2")], NOW);
    expect(r.totals.planned).toBe(30_000_000);
    expect(r.totals.executionPct).toBe(50);
  });

  it("sans plan : pas de taux d'exécution, tout est non rattaché", () => {
    const r = reconcileDisbursements([], [ev("e1", 1_000_000, null)], NOW);
    expect(r.totals.executionPct).toBeNull();
    expect(r.unlinked).toHaveLength(1);
  });
});
