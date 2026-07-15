import { describe, it, expect } from "vitest";
import { deriveEventInputs, hasMaterialEventSince, type ProjectEventView } from "@/lib/domain/eventSignals";

const NOW = new Date("2026-07-15T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();

const ev = (type: string, over: Partial<ProjectEventView> = {}): ProjectEventView => ({
  type,
  eventDate: daysAgo(10),
  endDate: null,
  resolved: false,
  affectsScoring: true,
  ...over,
});

describe("eventSignals — dérivation événements → inputs 1/W", () => {
  it("arrêt de chantier > 1 an → project_stopped_over_1y (art.12.7)", () => {
    const r = deriveEventInputs([ev("arret_chantier", { eventDate: daysAgo(400) })], NOW);
    expect(r.values.project_stopped_over_1y).toBe(true);
  });

  it("arrêt de chantier récent : signalé mais sans bascule art.12.7", () => {
    const r = deriveEventInputs([ev("arret_chantier", { eventDate: daysAgo(100) })], NOW);
    expect(r.values.project_stopped_over_1y).toBeUndefined();
    expect(r.notes.some((n) => n.key === "arret_chantier")).toBe(true);
  });

  it("un arrêt résolu ou clos n'alimente plus la classification", () => {
    const resolved = deriveEventInputs([ev("arret_chantier", { eventDate: daysAgo(400), resolved: true })], NOW);
    expect(resolved.values.project_stopped_over_1y).toBeUndefined();
    const ended = deriveEventInputs(
      [ev("arret_chantier", { eventDate: daysAgo(400), endDate: daysAgo(30) })],
      NOW,
    );
    expect(ended.values.project_stopped_over_1y).toBeUndefined();
  });

  it("saisie/ATD, redressement, litige, info bureau → clés 1/W correspondantes", () => {
    const r = deriveEventInputs(
      [ev("saisie_atd"), ev("redressement_judiciaire"), ev("litige"), ev("info_negative_bureau")],
      NOW,
    );
    expect(r.values.seizure_notice).toBe(true);
    expect(r.values.judicial_recovery).toBe(true);
    expect(r.values.legal_exposure).toBe("litigation");
    expect(r.values.negative_credit_bureau).toBe(true);
  });

  it("une restructuration (même clôturée) marque la créance restructurée (art.17-31)", () => {
    const r = deriveEventInputs([ev("restructuration", { resolved: true })], NOW);
    expect(r.values.restructured).toBe("yes");
  });

  it("problème administratif > 1 an → admin_problems_over_1y (art.5.3)", () => {
    const r = deriveEventInputs([ev("probleme_administratif", { eventDate: daysAgo(370) })], NOW);
    expect(r.values.admin_problems_over_1y).toBe(true);
  });

  it("n'affirme rien sans événement (l'absence ne force pas false)", () => {
    const r = deriveEventInputs([ev("deblocage", { affectsScoring: false })], NOW);
    expect(Object.keys(r.values)).toHaveLength(0);
  });
});

describe("eventSignals — déclenchement du re-scoring", () => {
  it("détecte un événement matériel postérieur au dernier score", () => {
    const events = [ev("incident_paiement", { eventDate: daysAgo(5) })];
    expect(hasMaterialEventSince(events, daysAgo(10))).toBe(true);
    expect(hasMaterialEventSince(events, daysAgo(1))).toBe(false);
  });

  it("ignore les événements non matériels", () => {
    const events = [ev("deblocage", { affectsScoring: false, eventDate: daysAgo(1) })];
    expect(hasMaterialEventSince(events, daysAgo(10))).toBe(false);
  });

  it("sans date de référence, tout événement matériel compte", () => {
    expect(hasMaterialEventSince([ev("litige")], null)).toBe(true);
  });
});
