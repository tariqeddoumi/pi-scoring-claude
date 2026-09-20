// =====================================================================
//  cashflow.ts — Trésorerie mensuelle et impasse (diagnostic F07, §8.5-8.7).
//
//  Le diagnostic relève que les ratios de liquidité (cash coverage, impasse,
//  préventes) ne suffisent pas à démontrer le remboursement : il faut un budget
//  MENSUEL reconstitué depuis les flux, jusqu'au remboursement intégral. Ce
//  module implémente la relation de trésorerie mois par mois et en dérive :
//   - le besoin de financement additionnel MAXIMAL sur l'horizon (§8.5) ;
//   - la date de rupture (premier mois sous la trésorerie minimale requise) ;
//   - la dette au pic (encours maximal) ;
//   - les ratios de liquidité RECONSTITUÉS depuis les flux (cash coverage, impasse)
//     qui peuvent alimenter le scoring — clôture F07 ;
//   - un stress « sur les flux » (prix, coût, ventes, délai, taux — §8.7) qui
//     recalcule la trajectoire, et non des ratios déjà agrégés (clôture F08).
//
//  Convention (§8.5) : seuls les tirages AUTORISÉS ET TIRABLES (financement
//  engagé) entrent dans la trésorerie ; les lignes non confirmées ou non
//  mobilisables (faute de permis/apport) sont exclues du besoin. Le calcul
//  respecte la CHRONOLOGIE : une recette postérieure au paiement qu'elle finance
//  ne comble pas l'impasse intermédiaire.
//  Logique PURE, déterministe, testable — aucune dépendance base.
// =====================================================================

export interface MonthFlows {
  label?: string; // ex. "2026-01"
  clientReceipts?: number; // encaissements clients (par contrat / statut de lot)
  equityContrib?: number; // apports mobilisables (fermes, disponibles à date)
  committedDraws?: number; // tirages autorisés ET tirables (financement engagé)
  uncommittedDraws?: number; // tirages NON engagés (info ; hors besoin/trésorerie)
  projectPayments?: number; // paiements du projet (coût restant à engager)
  debtService?: number; // service de dette (intérêts + principal)
  otherOutflows?: number; // autres sorties autorisées
}

export interface CashflowParams {
  openingCash: number; // trésorerie initiale à t0
  minCashRequired?: number; // trésorerie minimale requise (contingence), défaut 0
  months: MonthFlows[];
}

export interface MonthResult {
  index: number;
  label: string;
  clientReceipts: number; // encaissements clients
  equityContrib: number; // apports mobilisables
  committedDraws: number; // tirages engagés
  inflows: number; // encaissements + apports + tirages engagés
  outflows: number; // paiements + service dette + autres sorties
  net: number; // inflows − outflows (financement engagé uniquement)
  closing: number; // trésorerie finale cumulée (financement engagé)
  deficit: number; // max(0, minCashRequired − closing)
  breach: boolean; // trésorerie sous le minimum requis
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const n = (v: number | undefined) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

export interface CashflowResult {
  months: MonthResult[];
  /** Besoin de financement additionnel MAXIMAL sur l'horizon (plancher 0) — §8.5. */
  maxAdditionalNeed: number;
  /** Index du mois de rupture (première trésorerie < minimum requis), ou null. */
  breachMonthIndex: number | null;
  breachMonthLabel: string | null;
  /** Solde global simplifié (ressources − sorties, incl. lignes non tirées) — le
   *  chiffre « trompeur » du §8.6 qui peut masquer une impasse intermédiaire. */
  globalSimplifiedBalance: number;
  /** Total des ressources et des sorties sur l'horizon (financement engagé). */
  totalInflows: number;
  totalOutflows: number;
  /** Encours de dette au pic (cumul des tirages − remboursements, proxy). */
  peakDebt: number;
  // --- Ratios de liquidité RECONSTITUÉS depuis les flux (pour le scoring) ---
  /** cash_coverage = ressources certaines de l'horizon / sorties de l'horizon. */
  cashCoverage: number;
  /** funding_gap_pct = besoin additionnel maximal / coût restant à financer (%). */
  fundingGapPct: number;
  /** L'impasse persiste-t-elle (rupture sur ≥ 2 mois consécutifs) ? */
  fundingGapPersistent: boolean;
}

/**
 * Construit la trajectoire de trésorerie mensuelle et en dérive besoin maximal,
 * date de rupture et ratios de liquidité. La trésorerie d'un mois est reportée
 * au mois suivant (chronologie respectée).
 */
export function computeCashflow(params: CashflowParams): CashflowResult {
  const minReq = n(params.minCashRequired);
  let running = params.openingCash;
  let peakDebt = 0;
  let drawsCum = 0;
  let totalInflows = 0;
  let totalOutflows = 0;
  let uncommittedTotal = 0;

  const months: MonthResult[] = params.months.map((m, i) => {
    const inflows = n(m.clientReceipts) + n(m.equityContrib) + n(m.committedDraws);
    const outflows = n(m.projectPayments) + n(m.debtService) + n(m.otherOutflows);
    running = round2(running + inflows - outflows);
    // Dette au pic : cumul des tirages moins la part principal du service.
    drawsCum = round2(drawsCum + n(m.committedDraws) + n(m.uncommittedDraws) - 0);
    if (drawsCum > peakDebt) peakDebt = drawsCum;
    totalInflows = round2(totalInflows + inflows);
    totalOutflows = round2(totalOutflows + outflows);
    uncommittedTotal = round2(uncommittedTotal + n(m.uncommittedDraws));
    const deficit = round2(Math.max(0, minReq - running));
    return {
      index: i,
      label: m.label ?? `M${i + 1}`,
      clientReceipts: round2(n(m.clientReceipts)),
      equityContrib: round2(n(m.equityContrib)),
      committedDraws: round2(n(m.committedDraws)),
      inflows: round2(inflows),
      outflows: round2(outflows),
      net: round2(inflows - outflows),
      closing: running,
      deficit,
      breach: running < minReq,
    };
  });

  const maxAdditionalNeed = round2(months.reduce((mx, m) => Math.max(mx, m.deficit), 0));
  const breachIdx = months.findIndex((m) => m.breach);
  const breachMonthIndex = breachIdx >= 0 ? breachIdx : null;

  // Impasse persistante : au moins deux mois consécutifs en rupture.
  let persistent = false;
  for (let i = 1; i < months.length; i++) {
    if (months[i]!.breach && months[i - 1]!.breach) { persistent = true; break; }
  }

  const globalSimplifiedBalance = round2(
    params.openingCash + totalInflows + uncommittedTotal - totalOutflows,
  );
  const resourcesCertain = round2(params.openingCash + totalInflows);
  const cashCoverage = totalOutflows > 0 ? round2(resourcesCertain / totalOutflows) : Infinity;
  const remainingCost = totalOutflows;
  const fundingGapPct = remainingCost > 0 ? round2((maxAdditionalNeed / remainingCost) * 100) : 0;

  return {
    months,
    maxAdditionalNeed,
    breachMonthIndex,
    breachMonthLabel: breachMonthIndex != null ? months[breachMonthIndex]!.label : null,
    globalSimplifiedBalance,
    totalInflows,
    totalOutflows,
    peakDebt: round2(peakDebt),
    cashCoverage,
    fundingGapPct,
    fundingGapPersistent: persistent,
  };
}

// ---------------------------------------------------------------------
//  Stress SUR LES FLUX (diagnostic §8.7 / F08) — recalcule la trajectoire.
// ---------------------------------------------------------------------

export interface CashflowShock {
  priceDrop?: number; // % — encaissements clients ↓ (prix des lots exposés)
  costOverrun?: number; // % — paiements du projet ↑
  salesDrop?: number; // % — encaissements clients ↓ (rythme de ventes)
  receiptsDeferPct?: number; // % des encaissements reportés au-delà de l'horizon
  rateAddBps?: number; // points de base — service de dette ↑ (dette révisable)
}

/**
 * Applique un choc AUX FLUX PRIMITIFS puis laisse computeCashflow recalculer les
 * ratios (et non l'inverse). Les encaissements reportés sortent de l'horizon
 * (perte de recette dans la période), les paiements et le service de dette
 * augmentent. Monotone : un choc ne peut qu'aggraver l'impasse.
 */
export function stressCashflow(params: CashflowParams, shock: CashflowShock): CashflowResult {
  const priceF = 1 - n(shock.priceDrop) / 100;
  const salesF = 1 - n(shock.salesDrop) / 100;
  const deferF = 1 - n(shock.receiptsDeferPct) / 100;
  const costF = 1 + n(shock.costOverrun) / 100;
  const rateF = 1 + n(shock.rateAddBps) / 10000; // 100 bps = +1% du service

  const months = params.months.map((m) => ({
    ...m,
    clientReceipts: round2(n(m.clientReceipts) * priceF * salesF * deferF),
    projectPayments: round2(n(m.projectPayments) * costF),
    debtService: round2(n(m.debtService) * rateF),
  }));
  return computeCashflow({ ...params, months });
}

// ---------------------------------------------------------------------
//  Assemblage d'une trajectoire mensuelle depuis les composants du projet.
//  Assumptions TRANSPARENTES (uniformes) et surchargeables ; la banque peut
//  substituer un échéancier réel de coûts et d'apports quand il est disponible.
// ---------------------------------------------------------------------

export interface ScheduledAmount {
  date: Date | string | null;
  amount: number;
}

export interface AssemblyComponents {
  now?: Date;
  openingCash: number; // trésorerie initiale (cash libre à date)
  minCashRequired?: number;
  // Échéances de dette (Installment) : service de dette daté (réel).
  debtInstallments: ScheduledAmount[];
  // Ventes attendues (Unit non vendue) : encaissements datés (prix prévisionnel).
  expectedSales: ScheduledAmount[];
  // Déblocages planifiés (DisbursementMilestone) : tirages engagés datés.
  plannedDraws: ScheduledAmount[];
  // Coût restant à financer, réparti uniformément sur les mois d'activité.
  remainingCost?: number;
  // Apport ferme restant, réparti uniformément sur les mois d'activité.
  remainingEquity?: number;
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Construit MonthFlows[] depuis les composants datés du projet. Les échéances,
 * ventes et déblocages sont ventilés par mois ; le coût restant et l'apport
 * restant sont répartis uniformément sur l'horizon d'activité (hypothèse
 * explicite). Résultat consommable par computeCashflow.
 */
export function assembleMonthlyFlows(c: AssemblyComponents): CashflowParams {
  const now = c.now ?? new Date();
  const buckets = new Map<string, MonthFlows>();
  const ensure = (key: string): MonthFlows => {
    let b = buckets.get(key);
    if (!b) { b = { label: key }; buckets.set(key, b); }
    return b;
  };
  const place = (s: ScheduledAmount, field: keyof MonthFlows) => {
    if (!s.date || !s.amount) return;
    const d = new Date(s.date);
    if (Number.isNaN(d.getTime()) || d < now) return; // seuls les flux FUTURS
    const b = ensure(ym(d));
    b[field] = round2((b[field] as number ?? 0) + s.amount) as never;
  };

  c.debtInstallments.forEach((s) => place(s, "debtService"));
  c.expectedSales.forEach((s) => place(s, "clientReceipts"));
  c.plannedDraws.forEach((s) => place(s, "committedDraws"));

  // Répartition uniforme du coût restant et de l'apport restant sur les mois
  // d'activité (mois portant au moins un flux daté).
  const keys = [...buckets.keys()].sort();
  const nMonths = keys.length || 1;
  const costPer = round2(n(c.remainingCost) / nMonths);
  const equityPer = round2(n(c.remainingEquity) / nMonths);
  for (const k of keys) {
    const b = ensure(k);
    if (costPer) b.projectPayments = round2(n(b.projectPayments) + costPer);
    if (equityPer) b.equityContrib = round2(n(b.equityContrib) + equityPer);
  }

  return {
    openingCash: c.openingCash,
    minCashRequired: c.minCashRequired,
    months: keys.map((k) => buckets.get(k)!),
  };
}

/**
 * Ratios de liquidité prêts à alimenter le scoring, reconstitués depuis la
 * trajectoire (clôture F07 : « tout ratio de liquidité peut être reconstitué
 * depuis des flux, des contrats et un calendrier »).
 */
export function cashflowToScoringInputs(r: CashflowResult): {
  cash_coverage: number;
  funding_gap_pct: number;
  funding_gap_persistent: boolean;
} {
  return {
    cash_coverage: Number.isFinite(r.cashCoverage) ? r.cashCoverage : 999,
    funding_gap_pct: r.fundingGapPct,
    funding_gap_persistent: r.fundingGapPersistent,
  };
}
