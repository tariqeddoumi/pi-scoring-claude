// =====================================================================
//  eventSignals.ts — PONT journal d'événements → inputs de classification
//  1/W/2025. Dérive, à partir des événements OUVERTS (non résolus) du projet,
//  les entrées qualitatives/juridiques que la circulaire attend :
//    - arrêt de chantier > 1 an        → project_stopped_over_1y (art.12.7)
//    - problème administratif > 1 an   → admin_problems_over_1y  (art.5.3)
//    - saisie-arrêt / ATD              → seizure_notice          (art.5.1)
//    - redressement judiciaire         → judicial_recovery       (art.11.6)
//    - litige / action en justice      → legal_exposure=litigation (art.12.8)
//    - info négative Crédit Bureau     → negative_credit_bureau  (art.5.2)
//    - restructuration                 → restructured=yes        (art.17-31)
//  Logique PURE et testable — aucune dépendance base.
// =====================================================================

export interface ProjectEventView {
  type: string;
  eventDate: Date | string;
  endDate: Date | string | null;
  resolved: boolean;
  affectsScoring: boolean;
}

export interface EventSignalNote {
  key: string;
  label: string;
  reason: string;
}

export interface EventSignalsResult {
  /** Inputs dérivés à écrire (clé → valeur). */
  values: Record<string, string | number | boolean>;
  /** Explication de chaque dérivation (traçabilité). */
  notes: EventSignalNote[];
}

const DAY_MS = 24 * 3600 * 1000;

function ageDays(e: ProjectEventView, now: Date): number {
  const start = new Date(e.eventDate).getTime();
  return Math.floor((now.getTime() - start) / DAY_MS);
}

/** Événements ouverts (non résolus, sans date de fin passée). */
function isOpen(e: ProjectEventView, now: Date): boolean {
  if (e.resolved) return false;
  if (e.endDate && new Date(e.endDate).getTime() <= now.getTime()) return false;
  return new Date(e.eventDate).getTime() <= now.getTime();
}

/**
 * Dérive les inputs de classification 1/W à partir du journal d'événements.
 * Ne renvoie que les clés AFFIRMATIVES (true / valeur) : l'absence d'événement
 * ne force pas un false — la saisie manuelle reste maîtresse pour infirmer.
 */
export function deriveEventInputs(
  events: ProjectEventView[],
  now: Date = new Date(),
): EventSignalsResult {
  const open = events.filter((e) => isOpen(e, now));
  const values: EventSignalsResult["values"] = {};
  const notes: EventSignalNote[] = [];

  const openOf = (type: string) => open.filter((e) => e.type === type);

  // Arrêt de chantier : compromis si > 1 an (art.12.7) ; sinon signal de retard.
  const stops = openOf("arret_chantier");
  if (stops.length > 0) {
    const oldest = Math.max(...stops.map((e) => ageDays(e, now)));
    if (oldest >= 365) {
      values.project_stopped_over_1y = true;
      notes.push({ key: "project_stopped_over_1y", label: "Projet à l'arrêt > 1 an", reason: `Arrêt de chantier ouvert depuis ${oldest} j (art.12.7 → compromis).` });
    } else {
      notes.push({ key: "arret_chantier", label: "Arrêt de chantier en cours", reason: `Ouvert depuis ${oldest} j — bascule art.12.7 à 365 j.` });
    }
  }

  // Problèmes administratifs > 1 an (art.5.3 → sensible).
  const admin = openOf("probleme_administratif");
  if (admin.length > 0) {
    const oldest = Math.max(...admin.map((e) => ageDays(e, now)));
    if (oldest >= 365) {
      values.admin_problems_over_1y = true;
      notes.push({ key: "admin_problems_over_1y", label: "Problèmes administratifs > 1 an", reason: `Blocage administratif ouvert depuis ${oldest} j (art.5.3 → sensible).` });
    }
  }

  if (openOf("saisie_atd").length > 0) {
    values.seizure_notice = true;
    notes.push({ key: "seizure_notice", label: "Saisie-arrêt / ATD", reason: "Événement saisie/ATD ouvert (art.5.1 → sensible)." });
  }

  if (openOf("redressement_judiciaire").length > 0) {
    values.judicial_recovery = true;
    notes.push({ key: "judicial_recovery", label: "Redressement judiciaire", reason: "Procédure collective ouverte (art.11.6 → douteux)." });
  }

  if (openOf("litige").length > 0) {
    values.legal_exposure = "litigation";
    notes.push({ key: "legal_exposure", label: "Litige / action en justice", reason: "Litige ouvert (art.12.8 → contentieux)." });
  }

  if (openOf("info_negative_bureau").length > 0) {
    values.negative_credit_bureau = true;
    notes.push({ key: "negative_credit_bureau", label: "Info négative Crédit Bureau", reason: "Information négative ouverte (art.5.2 → sensible)." });
  }

  // Restructuration : événement (même clos) dans le journal → créance restructurée.
  if (events.some((e) => e.type === "restructuration")) {
    values.restructured = "yes";
    notes.push({ key: "restructured", label: "Créance restructurée", reason: "Restructuration au journal (régime art.17-31)." });
  }

  return { values, notes };
}

/**
 * Y a-t-il un événement MATÉRIEL (affectsScoring) postérieur à une date donnée
 * (typiquement le dernier scoring) ? Sert au déclenchement du re-scoring.
 */
export function hasMaterialEventSince(
  events: ProjectEventView[],
  since: Date | string | null | undefined,
): boolean {
  if (!since) return events.some((e) => e.affectsScoring);
  const t = new Date(since).getTime();
  return events.some((e) => e.affectsScoring && new Date(e.eventDate).getTime() > t);
}
