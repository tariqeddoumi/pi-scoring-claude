import { describe, it, expect } from "vitest";
import { projectNotifications, sortNotifications, countByLevel, type ProjectWatchInput } from "@/lib/domain/notifications";
import { scoreFreshness } from "@/lib/domain/reviewPolicy";

const NOW = new Date("2026-10-04T00:00:00Z");
const base = (o: Partial<ProjectWatchInput> = {}): ProjectWatchInput => ({
  id: "p1", reference: "PI-1", name: "Projet",
  freshness: scoreFreshness({ lastScoredAt: new Date("2026-09-01"), cls: "SAIN", now: NOW }),
  committee: null, redFlags: [], committeeFlags: [], criticalEvents: [], equipments: [], inApprovalCircuit: true, ...o,
});

describe("Notifications de suivi du risque", () => {
  it("dossier à jour, sans alerte : aucune notification", () => {
    expect(projectNotifications(base(), NOW)).toEqual([]);
  });
  it("revue dépassée → danger ; jamais scoré → avertissement", () => {
    const old = projectNotifications(base({ freshness: scoreFreshness({ lastScoredAt: new Date("2025-01-01"), cls: "SAIN", now: NOW }) }), NOW);
    expect(old[0]).toMatchObject({ kind: "REVIEW_OVERDUE", level: "danger" });
    const never = projectNotifications(base({ freshness: scoreFreshness({ lastScoredAt: null, cls: null, now: NOW }) }), NOW);
    expect(never[0]).toMatchObject({ kind: "NEVER_SCORED", level: "warning", href: "/projects/p1/scoring" });
  });
  it("décision de comité : expirée (danger), bientôt expirée (avertissement), ignorée hors circuit", () => {
    const expired = projectNotifications(base({ committee: { outcome: "FAVORABLE", validUntil: "2026-09-20", conditions: "GFA" } }), NOW);
    expect(expired[0]).toMatchObject({ kind: "COMMITTEE_EXPIRED", level: "danger" });
    expect(expired[0]!.detail).toContain("GFA");
    const soon = projectNotifications(base({ committee: { outcome: "FAVORABLE", validUntil: "2026-10-20", conditions: null } }), NOW);
    expect(soon[0]).toMatchObject({ kind: "COMMITTEE_EXPIRING", level: "warning" });
    expect(projectNotifications(base({ inApprovalCircuit: false, committee: { outcome: "FAVORABLE", validUntil: "2026-09-20", conditions: null } }), NOW)).toEqual([]);
  });
  it("alertes du dernier score : élevée ou retour en comité → danger, triées par sévérité", () => {
    const n = projectNotifications(base({
      redFlags: [
        { code: "RF_PLAN_TIRAGE_RETARD", name: "Plan de tirage en retard", severity: "MEDIUM", malus: 5, impactDomains: [], mitigable: true },
        { code: "RF_TIRAGE_AVANCE", name: "Déblocages en avance", severity: "HIGH", malus: 15, impactDomains: [], mitigable: true },
      ],
      committeeFlags: ["RF_TIRAGE_AVANCE"],
    }), NOW);
    expect(n.map((x) => [x.title, x.level])).toEqual([["Déblocages en avance", "danger"], ["Plan de tirage en retard", "warning"]]);
    expect(n[0]!.detail).toContain("Retour en comité requis");
  });
  it("équipement conditionnant la réception : échéance dépassée ou proche ; ignoré si remis ou lointain", () => {
    const eq = (o: object) => ({ id: "e1", label: "Mosquée", dueDate: "2026-09-30", conditionsDelivery: true, handedOver: false, progressPct: 40, ...o });
    expect(projectNotifications(base({ equipments: [eq({})] }), NOW)[0]).toMatchObject({ kind: "EQUIPMENT_DUE", level: "danger" });
    expect(projectNotifications(base({ equipments: [eq({ dueDate: "2026-10-15" })] }), NOW)[0]).toMatchObject({ level: "warning" });
    expect(projectNotifications(base({ equipments: [eq({ handedOver: true }), eq({ dueDate: "2027-06-30" }), eq({ conditionsDelivery: false })] }), NOW)).toEqual([]);
  });
  it("tri : gravité puis date la plus ancienne ; décompte par niveau", () => {
    const list = [
      ...projectNotifications(base({ id: "a", reference: "PI-A", freshness: scoreFreshness({ lastScoredAt: null, cls: null, now: NOW }) }), NOW),
      ...projectNotifications(base({ id: "b", reference: "PI-B", criticalEvents: [{ id: "ev", title: "Arrêt de chantier", type: "arret", eventDate: "2026-05-10" }] }), NOW),
    ];
    const s = sortNotifications(list);
    expect(s[0]).toMatchObject({ kind: "CRITICAL_EVENT", reference: "PI-B" });
    expect(countByLevel(s)).toEqual({ danger: 1, warning: 1, info: 0 });
  });
});
