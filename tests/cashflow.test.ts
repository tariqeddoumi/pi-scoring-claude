import { describe, it, expect } from "vitest";
import {
  computeCashflow,
  stressCashflow,
  cashflowToScoringInputs,
  assembleMonthlyFlows,
  type CashflowParams,
} from "@/lib/domain/cashflow";

describe("Trésorerie mensuelle et impasse (F07, §8.5-8.7)", () => {
  it("reproduit le solde global de l'exemple §8.6 (base +5, stress −15,25 MDH)", () => {
    // Périmètre simplifié : cash libre 8, ligne confirmée non tirée 15 (engagée),
    // apport ferme 7, recettes 30 ; sorties + service de dette 55.
    const base: CashflowParams = {
      openingCash: 8,
      months: [
        { label: "période", clientReceipts: 30, equityContrib: 7, committedDraws: 15, projectPayments: 55 },
      ],
    };
    const r = computeCashflow(base);
    // 8 + (30+7+15) − 55 = +5.
    expect(r.globalSimplifiedBalance).toBe(5);

    // Stress : 40 % des recettes reportées, sorties +15 %.
    const s = stressCashflow(base, { receiptsDeferPct: 40, costOverrun: 15 });
    // 8 + (18+7+15) − 63,25 = −15,25.
    expect(s.globalSimplifiedBalance).toBe(-15.25);
    expect(s.maxAdditionalNeed).toBeGreaterThan(0);
  });

  it("un solde global positif peut masquer une impasse intermédiaire (§8.6)", () => {
    // Solde global = +5 mais une recette arrive APRÈS le paiement qu'elle finance.
    const params: CashflowParams = {
      openingCash: 8,
      months: [
        { label: "M1", committedDraws: 15, projectPayments: 55 }, // −40 → rupture
        { label: "M2", clientReceipts: 30, equityContrib: 7 }, // +37 → +5 en fin
      ],
    };
    const r = computeCashflow(params);
    expect(r.globalSimplifiedBalance).toBe(5); // solde global « rassurant »
    expect(r.breachMonthIndex).toBe(0); // mais rupture dès M1
    expect(r.maxAdditionalNeed).toBe(32); // besoin max = 40 − (8) = 32 à M1
  });

  it("calcule la date de rupture et le besoin additionnel maximal", () => {
    const params: CashflowParams = {
      openingCash: 10,
      minCashRequired: 0,
      months: [
        { clientReceipts: 5, projectPayments: 8 }, // closing 7
        { clientReceipts: 2, projectPayments: 20 }, // closing -11 → rupture
        { clientReceipts: 30, projectPayments: 5 }, // closing 14
      ],
    };
    const r = computeCashflow(params);
    expect(r.breachMonthIndex).toBe(1);
    expect(r.maxAdditionalNeed).toBe(11);
  });

  it("détecte une impasse persistante (≥ 2 mois consécutifs en rupture)", () => {
    const params: CashflowParams = {
      openingCash: 0,
      months: [
        { projectPayments: 10 }, // -10
        { projectPayments: 5 }, // -15
        { clientReceipts: 30 }, // +15
      ],
    };
    const r = computeCashflow(params);
    expect(r.fundingGapPersistent).toBe(true);
  });

  it("le stock exclut les tirages non engagés du besoin, mais les montre au solde global", () => {
    const params: CashflowParams = {
      openingCash: 0,
      months: [{ committedDraws: 10, uncommittedDraws: 20, projectPayments: 25 }],
    };
    const r = computeCashflow(params);
    // Trésorerie engagée : 0 + 10 − 25 = −15 → besoin 15 (le non-engagé ne compte pas).
    expect(r.maxAdditionalNeed).toBe(15);
    // Solde global inclut le non-engagé : 0 + (10+25? non) ... 10 engagé + 20 non-engagé − 25.
    expect(r.globalSimplifiedBalance).toBe(5);
  });

  it("reconstitue des ratios de liquidité alimentant le scoring", () => {
    const params: CashflowParams = {
      openingCash: 5,
      months: [{ clientReceipts: 40, projectPayments: 30, debtService: 10 }],
    };
    const r = computeCashflow(params);
    const inputs = cashflowToScoringInputs(r);
    // cash coverage = (5 + 40) / 40 = 1,125.
    expect(inputs.cash_coverage).toBe(1.13);
    expect(inputs.funding_gap_pct).toBe(0); // pas d'impasse
    expect(inputs.funding_gap_persistent).toBe(false);
  });

  it("assemble une trajectoire mensuelle depuis les composants datés du projet", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const params = assembleMonthlyFlows({
      now,
      openingCash: 5,
      debtInstallments: [{ date: "2026-02-15", amount: 3 }, { date: "2026-03-15", amount: 3 }],
      expectedSales: [{ date: "2026-03-20", amount: 40 }],
      plannedDraws: [{ date: "2026-02-10", amount: 10 }],
      remainingCost: 20, // réparti sur 2 mois d'activité → 10/mois
      remainingEquity: 0,
    });
    // Deux mois d'activité (février, mars).
    expect(params.months).toHaveLength(2);
    const feb = params.months.find((m) => m.label === "2026-02")!;
    expect(feb.debtService).toBe(3);
    expect(feb.committedDraws).toBe(10);
    expect(feb.projectPayments).toBe(10); // coût réparti
    const r = computeCashflow(params);
    expect(r.months.length).toBe(2);
    // Les flux passés (avant `now`) sont ignorés.
    const past = assembleMonthlyFlows({ now, openingCash: 0, debtInstallments: [{ date: "2025-06-01", amount: 5 }], expectedSales: [], plannedDraws: [] });
    expect(past.months).toHaveLength(0);
  });

  it("le stress sur les flux est monotone (aggrave le besoin)", () => {
    const params: CashflowParams = {
      openingCash: 2,
      months: [
        { clientReceipts: 10, projectPayments: 8, debtService: 2 },
        { clientReceipts: 12, projectPayments: 9, debtService: 2 },
      ],
    };
    const base = computeCashflow(params);
    const stressed = stressCashflow(params, { priceDrop: 10, costOverrun: 10, salesDrop: 15, rateAddBps: 200 });
    expect(stressed.maxAdditionalNeed).toBeGreaterThanOrEqual(base.maxAdditionalNeed);
    expect(stressed.cashCoverage).toBeLessThanOrEqual(base.cashCoverage);
  });
});
