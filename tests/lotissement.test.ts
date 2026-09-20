import { describe, it, expect } from "vitest";
import { lotFollowUp, programLotSummary, type LotView } from "@/lib/domain/lotissement";
import { eventsRequiringCommitteeSince, deriveEventInputs } from "@/lib/domain/eventSignals";
import { COMMITTEE_TRIGGERING_EVENTS, EVENT_TYPE_DEFS } from "@/lib/domain/referentiels";

const lotA: LotView = {
  code: "T1",
  name: "Tranche 1",
  status: "EN_TRAVAUX",
  progressPct: 40,
  budget: 1000,
  units: [
    { status: "VENDU", soldPrice: 100 },
    { status: "VENDU", soldPrice: 120 },
    { status: "RESERVE", plannedPrice: 110 },
    { status: "DISPONIBLE", plannedPrice: 110 },
  ],
  disbursements: [
    { plannedAmount: 600, releasedAmount: 400 },
    { plannedAmount: 400, releasedAmount: 200 },
  ],
  events: [{ type: "modification_lot", requiresCommittee: true, resolved: false }],
};

describe("Vision lotissement (volet 2)", () => {
  it("suit la commercialisation et les déblocages lot par lot", () => {
    const f = lotFollowUp(lotA);
    expect(f.unitsTotal).toBe(4);
    expect(f.unitsSold).toBe(2);
    expect(f.unitsReserved).toBe(1);
    expect(f.commercialisationPct).toBe(75); // (2+1)/4
    expect(f.revenueSecured).toBe(220);
    expect(f.plannedDisbursement).toBe(1000);
    expect(f.releasedDisbursement).toBe(600);
    expect(f.disbursementPct).toBe(60);
  });

  it("alerte décaissement en avance de phase (déblocage 60 % >> avancement 40 %)", () => {
    const f = lotFollowUp(lotA);
    expect(f.overDisbursement).toBe(true);
    expect(f.disbursementVsProgressGap).toBe(20);
  });

  it("une modification de lot ouverte impose un retour en comité", () => {
    expect(lotFollowUp(lotA).needsCommittee).toBe(true);
  });

  it("agrège le suivi de tous les lots du programme", () => {
    const s = programLotSummary([lotA, { ...lotA, code: "T2", events: [], units: [] }]);
    expect(s.lotsCount).toBe(2);
    expect(s.lotsNeedingCommittee).toBe(1);
    expect(s.lotsOverDisbursed).toBeGreaterThanOrEqual(1);
  });
});

describe("Événements → comité + reprofilage (volet 3)", () => {
  it("le catalogue marque restructuration/reprofilage/consolidation/modification_lot comme comité", () => {
    expect(COMMITTEE_TRIGGERING_EVENTS).toContain("restructuration");
    expect(COMMITTEE_TRIGGERING_EVENTS).toContain("reprofilage_dette");
    expect(COMMITTEE_TRIGGERING_EVENTS).toContain("consolidation_dette");
    expect(COMMITTEE_TRIGGERING_EVENTS).toContain("modification_lot");
    expect(EVENT_TYPE_DEFS.get("reprofilage_dette")?.regRef).toContain("1/W");
  });

  it("un reprofilage/consolidation vaut créance restructurée pour la classification", () => {
    const repro = deriveEventInputs([
      { type: "reprofilage_dette", eventDate: new Date(), endDate: null, resolved: false, affectsScoring: true },
    ]);
    expect(repro.values.restructured).toBe("yes");
    const conso = deriveEventInputs([
      { type: "consolidation_dette", eventDate: new Date(), endDate: null, resolved: false, affectsScoring: true },
    ]);
    expect(conso.values.restructured).toBe("yes");
  });

  it("détecte les événements imposant un comité depuis le dernier scoring", () => {
    const events = [
      { type: "modification_lot", requiresCommittee: true, eventDate: new Date("2026-09-10"), endDate: null, resolved: false, affectsScoring: true },
      { type: "deblocage", requiresCommittee: false, eventDate: new Date("2026-09-15"), endDate: null, resolved: false, affectsScoring: false },
    ];
    const since = eventsRequiringCommitteeSince(events, new Date("2026-09-01"));
    expect(since).toHaveLength(1);
    const none = eventsRequiringCommitteeSince(events, new Date("2026-09-12"));
    expect(none).toHaveLength(0);
  });
});
