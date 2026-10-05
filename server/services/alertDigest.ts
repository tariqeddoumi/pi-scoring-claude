// Résumé hebdomadaire des alertes : un e-mail par chargé d'affaires actif ayant
// au moins une alerte sur ses dossiers (mêmes règles que la page /alerts).
// Déclenché par la tâche planifiée /api/cron/alert-digest.

import { prisma } from "@/lib/prisma";
import { buildAlertDigest, type AlertDigest } from "@/lib/domain/alertDigest";
import { loadNotifications } from "@/server/services/notifications";
import { mailConfig, sendMail, type MailConfig } from "@/server/services/mailer";

export type DigestStatus = "sent" | "preview" | "empty" | "error";

export interface DigestReportItem {
  userId: string;
  name: string;
  email: string;
  status: DigestStatus;
  alerts: number;
  projects: number;
  reason?: string;
  /** Contenu, en mode aperçu uniquement. */
  subject?: string;
  text?: string;
}

export interface DigestReport {
  mode: "send" | "preview";
  at: string;
  recipients: number;
  sent: number;
  items: DigestReportItem[];
}

/** Résumé d'un utilisateur (aperçu dans l'application ou envoi). */
export async function digestFor(user: { id: string; name: string; role: { name: string } }, appUrl: string, now: Date = new Date()): Promise<AlertDigest | null> {
  return buildAlertDigest({ recipientName: user.name, notifications: await loadNotifications(user, now), appUrl, now });
}

export async function runWeeklyDigest(opts: { appUrl: string; send: boolean; withContent?: boolean; now?: Date; config?: MailConfig | null }): Promise<DigestReport> {
  const now = opts.now ?? new Date();
  const config = opts.config === undefined ? mailConfig() : opts.config;
  const send = opts.send && config != null;
  const users = await prisma.user.findMany({
    where: { active: true, role: { name: "RELATIONSHIP_MANAGER" } },
    include: { role: true },
    orderBy: { name: "asc" },
  });

  const items: DigestReportItem[] = [];
  for (const user of users) {
    const base = { userId: user.id, name: user.name, email: user.email };
    try {
      const digest = await digestFor(user, opts.appUrl, now);
      if (!digest) {
        items.push({ ...base, status: "empty", alerts: 0, projects: 0 });
        continue;
      }
      const counts = { alerts: digest.count, projects: digest.projects };
      if (!send) {
        items.push({ ...base, status: "preview", ...counts, ...(opts.withContent ? { subject: digest.subject, text: digest.text } : {}) });
        continue;
      }
      const res = await sendMail({ to: user.email, subject: digest.subject, text: digest.text, html: digest.html }, config!);
      items.push(res.delivered ? { ...base, status: "sent", ...counts } : { ...base, status: "error", ...counts, reason: res.reason });
    } catch (e) {
      items.push({ ...base, status: "error", alerts: 0, projects: 0, reason: (e as Error).message });
    }
  }

  const report: DigestReport = {
    mode: send ? "send" : "preview",
    at: now.toISOString(),
    recipients: items.filter((i) => i.status !== "empty").length,
    sent: items.filter((i) => i.status === "sent").length,
    items,
  };
  // Trace d'exploitation (une ligne JSON, sans contenu ni adresse complète).
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: report.at, category: "notification", event: "alert_digest", mode: report.mode, recipients: report.recipients, sent: report.sent, errors: items.filter((i) => i.status === "error").length }));
  return report;
}
