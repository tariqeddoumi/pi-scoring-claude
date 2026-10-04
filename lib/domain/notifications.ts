// Notifications de suivi du risque : ce qui demande une action sur un dossier,
// classé par gravité. Fonctions pures (testées) ; la collecte des données est
// faite par server/services/notifications.ts.

import type { ScoreFreshness } from "./reviewPolicy";
import type { RedFlagOutcome, Severity } from "./types";
import { formatDate } from "@/lib/utils";

export type NotificationLevel = "danger" | "warning" | "info";

export type NotificationKind =
  | "REVIEW_OVERDUE"
  | "REVIEW_DUE_SOON"
  | "NEVER_SCORED"
  | "EVENT_SINCE_SCORE"
  | "COMMITTEE_EXPIRED"
  | "COMMITTEE_EXPIRING"
  | "RED_FLAG"
  | "CRITICAL_EVENT"
  | "EQUIPMENT_DUE";

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  REVIEW_OVERDUE: "Revue périodique dépassée",
  REVIEW_DUE_SOON: "Revue périodique à prévoir",
  NEVER_SCORED: "Dossier jamais scoré",
  EVENT_SINCE_SCORE: "Événement depuis le dernier score",
  COMMITTEE_EXPIRED: "Décision de comité expirée",
  COMMITTEE_EXPIRING: "Décision de comité bientôt expirée",
  RED_FLAG: "Alerte du dernier score",
  CRITICAL_EVENT: "Événement critique non résolu",
  EQUIPMENT_DUE: "Équipement exigé à échéance",
};

export interface Notification {
  id: string;
  projectId: string;
  reference: string;
  projectName: string;
  kind: NotificationKind;
  level: NotificationLevel;
  title: string;
  detail: string;
  /** Date de référence (échéance, événement…), pour le tri et l'affichage. */
  date: string | null;
  /** Lien vers l'endroit où agir. */
  href: string;
}

export interface ProjectWatchInput {
  id: string;
  reference: string;
  name: string;
  freshness: ScoreFreshness;
  committee: { outcome: string; validUntil: Date | string | null; conditions: string | null } | null;
  /** Alertes déclenchées par le dernier score, et celles qui imposent un retour en comité. */
  redFlags: RedFlagOutcome[];
  committeeFlags: string[];
  criticalEvents: { id: string; title: string | null; type: string; eventDate: Date | string }[];
  equipments: { id: string; label: string; dueDate: Date | string | null; conditionsDelivery: boolean; handedOver: boolean; progressPct: number }[];
  /** La décision de comité n'est pas encore exécutée (dossier non rejeté, aucun tirage) : sa date de validité compte. */
  inApprovalCircuit: boolean;
}

/** Horizon d'anticipation (jours) pour les échéances de comité et d'équipement. */
export const NOTICE_DAYS = 30;
const DAY = 24 * 3600 * 1000;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const days = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);
const SEVERITY_RANK: Record<Severity, number> = { BLOCKING: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

export function projectNotifications(p: ProjectWatchInput, now: Date = new Date()): Notification[] {
  const out: Notification[] = [];
  const base = { projectId: p.id, reference: p.reference, projectName: p.name };
  const push = (n: Omit<Notification, "projectId" | "reference" | "projectName" | "id">, key: string) =>
    out.push({ ...base, id: `${p.id}:${n.kind}:${key}`, ...n });

  // 1. Fraîcheur du score
  const f = p.freshness;
  if (f.status === "NEVER_SCORED") {
    push({ kind: "NEVER_SCORED", level: "warning", title: "Dossier jamais scoré", detail: f.reason, date: null, href: `/projects/${p.id}/scoring` }, "0");
  } else if (f.status === "EVENT_TRIGGERED") {
    push({ kind: "EVENT_SINCE_SCORE", level: f.needsCommittee ? "danger" : "warning", title: f.needsCommittee ? "Événement structurant : retour en comité et nouveau score" : "Événement matériel : re-scorer le dossier", detail: f.reason, date: iso(f.nextReviewAt), href: `/projects/${p.id}/suivi#journal` }, "0");
  } else if (f.status === "OVERDUE") {
    push({ kind: "REVIEW_OVERDUE", level: "danger", title: `Revue périodique dépassée de ${f.overdueDays} j`, detail: f.reason, date: iso(f.nextReviewAt), href: `/projects/${p.id}/scoring` }, "0");
  } else if (f.status === "DUE_SOON") {
    push({ kind: "REVIEW_DUE_SOON", level: "info", title: `Revue périodique dans ${-(f.overdueDays ?? 0)} j`, detail: f.reason, date: iso(f.nextReviewAt), href: `/projects/${p.id}/scoring` }, "0");
  }

  // 2. Validité de la dernière décision de comité (dossier encore en circuit)
  if (p.committee?.validUntil && p.inApprovalCircuit) {
    const until = new Date(p.committee.validUntil);
    const left = days(now, until);
    if (left < 0) {
      push({ kind: "COMMITTEE_EXPIRED", level: "danger", title: `Décision de comité expirée depuis ${-left} j`, detail: `Validité jusqu'au ${formatDate(until)} : la décision doit être renouvelée avant toute mise en place.${p.committee.conditions ? ` Conditions : ${p.committee.conditions}` : ""}`, date: iso(until), href: `/projects/${p.id}?onglet=circuit#onglets` }, "0");
    } else if (left <= NOTICE_DAYS) {
      push({ kind: "COMMITTEE_EXPIRING", level: "warning", title: `Décision de comité valable encore ${left} j`, detail: `Validité jusqu'au ${formatDate(until)}.${p.committee.conditions ? ` Conditions à lever : ${p.committee.conditions}` : ""}`, date: iso(until), href: `/projects/${p.id}?onglet=circuit#onglets` }, "0");
    }
  }

  // 3. Alertes du dernier score (une notification par alerte)
  for (const rf of [...p.redFlags].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])) {
    const committee = p.committeeFlags.includes(rf.code);
    const level: NotificationLevel = rf.severity === "BLOCKING" || rf.severity === "HIGH" || committee ? "danger" : "warning";
    push({
      kind: "RED_FLAG", level, title: rf.name,
      detail: `${committee ? "Retour en comité requis. " : ""}${rf.malus > 0 ? `Malus ${rf.malus} pts. ` : ""}Code ${rf.code}.`,
      date: null, href: `/projects/${p.id}?onglet=scoring#onglets`,
    }, rf.code);
  }

  // 4. Événements critiques non résolus
  for (const e of p.criticalEvents) {
    push({ kind: "CRITICAL_EVENT", level: "danger", title: e.title || `Événement critique (${e.type})`, detail: `Déclaré le ${formatDate(e.eventDate)}, non résolu.`, date: iso(e.eventDate), href: `/projects/${p.id}/suivi#journal` }, e.id);
  }

  // 5. Équipements exigés conditionnant la réception, à échéance proche ou dépassée
  for (const q of p.equipments) {
    if (!q.conditionsDelivery || q.handedOver || !q.dueDate || q.progressPct >= 100) continue;
    const left = days(now, new Date(q.dueDate));
    if (left > NOTICE_DAYS) continue;
    push({
      kind: "EQUIPMENT_DUE", level: left < 0 ? "danger" : "warning",
      title: left < 0 ? `${q.label} : échéance dépassée de ${-left} j` : `${q.label} : échéance dans ${left} j`,
      detail: `Avancement ${Math.round(q.progressPct)} %. L'équipement conditionne la réception (permis d'habiter, actes, mainlevées).`,
      date: iso(q.dueDate), href: `/projects/${p.id}/suivi#programme`,
    }, q.id);
  }
  return out;
}

const LEVEL_RANK: Record<NotificationLevel, number> = { danger: 0, warning: 1, info: 2 };

/** Toutes les notifications, triées : gravité, puis date la plus ancienne (le plus en retard d'abord). */
export function sortNotifications(list: Notification[]): Notification[] {
  return [...list].sort((a, b) =>
    LEVEL_RANK[a.level] - LEVEL_RANK[b.level]
    || (a.date ?? "9999").localeCompare(b.date ?? "9999")
    || a.reference.localeCompare(b.reference));
}

export function countByLevel(list: Notification[]): Record<NotificationLevel, number> {
  const c: Record<NotificationLevel, number> = { danger: 0, warning: 0, info: 0 };
  for (const n of list) c[n.level]++;
  return c;
}
