import { describe, it, expect } from "vitest";
import {
  facilityEad,
  projectEad,
  installmentOverdueDays,
  scheduleDpd,
  totalOverdue,
} from "@/lib/domain/facility";

describe("facility — EAD réel", () => {
  it("EAD = tiré + CCF × non-tiré", () => {
    expect(facilityEad({ authorizedAmount: 100, drawnAmount: 60, ccf: 1 })).toBe(100);
    expect(facilityEad({ authorizedAmount: 100, drawnAmount: 60, ccf: 0.5 })).toBe(80);
    expect(facilityEad({ authorizedAmount: 100, drawnAmount: 60 })).toBe(100); // CCF défaut 1
    expect(facilityEad({ authorizedAmount: 100, drawnAmount: 0, ccf: 0 })).toBe(0);
  });

  it("le non-tiré négatif (sur-tirage) est borné à zéro", () => {
    expect(facilityEad({ authorizedAmount: 100, drawnAmount: 120, ccf: 0.5 })).toBe(120);
  });

  it("EAD projet = somme des facilités, sinon fallback", () => {
    const f = [
      { authorizedAmount: 100, drawnAmount: 100, ccf: 1 },
      { authorizedAmount: 50, drawnAmount: 20, ccf: 0.5 },
    ];
    expect(projectEad(f, 999)).toEqual({ ead: 135, fromFacilities: true });
    expect(projectEad([], 80)).toEqual({ ead: 80, fromFacilities: false });
  });
});

describe("facility — échéancier (DPD & impayé)", () => {
  const asOf = new Date("2026-06-15T00:00:00Z");

  it("échéance soldée ou future → aucun retard", () => {
    expect(installmentOverdueDays({ dueDate: "2026-01-01", amountDue: 100, amountPaid: 100 }, asOf)).toBe(0);
    expect(installmentOverdueDays({ dueDate: "2026-12-01", amountDue: 100, amountPaid: 0 }, asOf)).toBe(0);
  });

  it("échéance échue non soldée → retard en jours", () => {
    expect(installmentOverdueDays({ dueDate: "2026-05-16", amountDue: 100, amountPaid: 0 }, asOf)).toBe(30);
    // Partiellement payée mais reliquat → toujours en retard.
    expect(installmentOverdueDays({ dueDate: "2026-05-16", amountDue: 100, amountPaid: 40 }, asOf)).toBe(30);
  });

  it("DPD = plus grand retard ; impayé = somme des reliquats échus", () => {
    const sched = [
      { dueDate: "2026-03-15", amountDue: 100, amountPaid: 100 }, // soldée
      { dueDate: "2026-04-15", amountDue: 100, amountPaid: 30 }, // reliquat 70, ~61j
      { dueDate: "2026-05-16", amountDue: 100, amountPaid: 0 }, // 30j
      { dueDate: "2026-09-15", amountDue: 100, amountPaid: 0 }, // future
    ];
    expect(scheduleDpd(sched, asOf)).toBe(61);
    expect(totalOverdue(sched, asOf)).toBe(170);
  });
});

describe("facility — dépassement de ligne dérivé", () => {
  it("mesure l'excédent du tiré sur l'autorisé en %", async () => {
    const { overdraftExcessPct } = await import("@/lib/domain/facility");
    expect(overdraftExcessPct([{ authorizedAmount: 100, drawnAmount: 115 }])).toBe(15);
    expect(overdraftExcessPct([{ authorizedAmount: 100, drawnAmount: 90 }])).toBe(0);
    expect(overdraftExcessPct([])).toBe(0);
  });
});

describe("facility — déblocages vs avancement (avance de phase)", () => {
  it("alerte quand le décaissé dépasse l'avancement au-delà de la tolérance", async () => {
    const { disbursementVsProgress } = await import("@/lib/domain/facility");
    const r = disbursementVsProgress({ drawn: 80, authorized: 100, progressPct: 40 });
    expect(r.drawnPct).toBe(80);
    expect(r.gapPts).toBe(40);
    expect(r.alert).toBe(true);
    expect(r.reason).toContain("80");
  });

  it("pas d'alerte dans la tolérance ou sans données", async () => {
    const { disbursementVsProgress } = await import("@/lib/domain/facility");
    expect(disbursementVsProgress({ drawn: 50, authorized: 100, progressPct: 40 }).alert).toBe(false);
    expect(disbursementVsProgress({ drawn: 50, authorized: 100, progressPct: null }).alert).toBe(false);
    expect(disbursementVsProgress({ drawn: 50, authorized: 0, progressPct: 40 }).alert).toBe(false);
  });

  it("le seuil est paramétrable", async () => {
    const { disbursementVsProgress } = await import("@/lib/domain/facility");
    expect(disbursementVsProgress({ drawn: 60, authorized: 100, progressPct: 45, thresholdPts: 10 }).alert).toBe(true);
  });
});
