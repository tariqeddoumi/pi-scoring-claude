import { describe, it, expect } from "vitest";
import { scoreFreshness, REVIEW_PERIOD_DAYS } from "@/lib/domain/reviewPolicy";

const NOW = new Date("2026-07-15T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000);

describe("reviewPolicy — revue régulière du scoring", () => {
  it("jamais scoré → re-scoring requis", () => {
    const f = scoreFreshness({ lastScoredAt: null, cls: null, now: NOW });
    expect(f.status).toBe("NEVER_SCORED");
    expect(f.needsRescoring).toBe(true);
  });

  it("créance saine : revue annuelle (à jour à 6 mois, dépassée à 13 mois)", () => {
    expect(REVIEW_PERIOD_DAYS.SAIN).toBe(365);
    const fresh = scoreFreshness({ lastScoredAt: daysAgo(180), cls: "SAIN", now: NOW });
    expect(fresh.status).toBe("FRESH");
    expect(fresh.needsRescoring).toBe(false);
    const overdue = scoreFreshness({ lastScoredAt: daysAgo(400), cls: "SAIN", now: NOW });
    expect(overdue.status).toBe("OVERDUE");
    expect(overdue.needsRescoring).toBe(true);
  });

  it("créance sensible : revue trimestrielle resserrée", () => {
    const f = scoreFreshness({ lastScoredAt: daysAgo(100), cls: "SENSIBLE", now: NOW });
    expect(f.status).toBe("OVERDUE");
  });

  it("créance en souffrance : revue mensuelle", () => {
    const f = scoreFreshness({ lastScoredAt: daysAgo(45), cls: "DOUTEUX", now: NOW });
    expect(f.status).toBe("OVERDUE");
    expect(f.overdueDays).toBe(15);
  });

  it("échéance proche (< 30 j) → DUE_SOON sans obligation immédiate", () => {
    const f = scoreFreshness({ lastScoredAt: daysAgo(345), cls: "SAIN", now: NOW });
    expect(f.status).toBe("DUE_SOON");
    expect(f.needsRescoring).toBe(false);
  });

  it("un événement matériel prime sur la périodicité", () => {
    const f = scoreFreshness({ lastScoredAt: daysAgo(10), cls: "SAIN", materialEventSince: true, now: NOW });
    expect(f.status).toBe("EVENT_TRIGGERED");
    expect(f.needsRescoring).toBe(true);
  });

  it("la prochaine échéance est datée depuis le dernier score", () => {
    const f = scoreFreshness({ lastScoredAt: daysAgo(10), cls: "SENSIBLE", now: NOW });
    expect(f.nextReviewAt?.toISOString().slice(0, 10)).toBe(
      new Date(NOW.getTime() + 80 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    );
  });
});
