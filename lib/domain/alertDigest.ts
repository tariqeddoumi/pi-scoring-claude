// Résumé hebdomadaire des alertes envoyé par e-mail à chaque chargé d'affaires.
// Fonction pure : sujet, texte brut et HTML (styles en ligne, lisibles par les
// messageries), construits à partir des notifications de ses dossiers
// (lib/domain/notifications.ts). Aucun e-mail quand il n'y a rien à signaler.

import { countByLevel, type Notification, type NotificationLevel } from "./notifications";
import { formatDate } from "@/lib/utils";

export interface AlertDigest {
  subject: string;
  text: string;
  html: string;
  /** Alertes et dossiers concernés. */
  count: number;
  projects: number;
  counts: Record<NotificationLevel, number>;
}

/** Nombre maximal d'alertes détaillées dans un e-mail ; le reste est dans l'application. */
export const DIGEST_MAX_ITEMS = 40;

const LEVELS: { value: NotificationLevel; title: string; short: string; color: string }[] = [
  { value: "danger", title: "À traiter en priorité", short: "prioritaire", color: "#b91c1c" },
  { value: "warning", title: "Vigilance", short: "en vigilance", color: "#b45309" },
  { value: "info", title: "À prévoir", short: "à prévoir", color: "#1d4ed8" },
];

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Lien absolu vers l'application (les liens des notifications sont relatifs). */
const absolute = (href: string, appUrl: string) => new URL(href, appUrl.endsWith("/") ? appUrl : `${appUrl}/`).toString();

export function buildAlertDigest(input: {
  recipientName: string;
  notifications: Notification[];
  appUrl: string;
  now?: Date;
}): AlertDigest | null {
  const { recipientName, notifications, appUrl } = input;
  if (notifications.length === 0) return null;
  const now = input.now ?? new Date();
  const counts = countByLevel(notifications);
  const projects = new Set(notifications.map((n) => n.projectId)).size;
  const shown = notifications.slice(0, DIGEST_MAX_ITEMS);
  const hidden = notifications.length - shown.length;
  const alertsUrl = absolute("/alerts", appUrl);

  const tally = LEVELS.filter((l) => counts[l.value] > 0).map((l) => `${counts[l.value]} ${l.short}${l.value === "danger" && counts.danger > 1 ? "s" : ""}`);
  const subject = `Vos alertes de la semaine : ${tally.join(", ")} (${plural(projects, "dossier", "dossiers")})`;
  const intro = `Voici les points d'attention de vos dossiers au ${formatDate(now)} : ${plural(notifications.length, "alerte", "alertes")} sur ${plural(projects, "dossier", "dossiers")}.`;
  const more = hidden > 0 ? `… et ${plural(hidden, "autre alerte", "autres alertes")} à consulter dans l'application.` : null;
  const footer = "Message automatique hebdomadaire. Les alertes sont recalculées en continu : l'application fait foi.";

  // Texte brut
  const text: string[] = [`Bonjour ${recipientName},`, "", intro, ""];
  for (const l of LEVELS) {
    const items = shown.filter((n) => n.level === l.value);
    if (!items.length) continue;
    text.push(`${l.title.toUpperCase()} (${counts[l.value]})`);
    for (const n of items) {
      text.push(`- ${n.reference} · ${n.projectName} — ${n.title}`);
      if (n.detail) text.push(`  ${n.detail}`);
      text.push(`  ${absolute(n.href, appUrl)}`);
    }
    text.push("");
  }
  if (more) text.push(more, "");
  text.push(`Toutes vos alertes : ${alertsUrl}`, "", footer);

  // HTML
  const section = (l: (typeof LEVELS)[number]) => {
    const items = shown.filter((n) => n.level === l.value);
    if (!items.length) return "";
    const rows = items.map((n) => `
      <tr><td style="padding:10px 0;border-top:1px solid #e2e8f0">
        <a href="${escapeHtml(absolute(n.href, appUrl))}" style="color:#1d4ed8;font-weight:600;text-decoration:none">${escapeHtml(n.reference)}</a>
        <span style="color:#475569"> · ${escapeHtml(n.projectName)}</span>
        <div style="margin-top:2px;color:#0f172a">${escapeHtml(n.title)}</div>
        ${n.detail ? `<div style="margin-top:2px;color:#475569;font-size:13px">${escapeHtml(n.detail)}</div>` : ""}
      </td></tr>`).join("");
    return `
      <h2 style="margin:24px 0 4px;font-size:15px;color:${l.color}">${escapeHtml(l.title)} (${counts[l.value]})</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows}</table>`;
  };
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.45">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px">
      <tr><td style="padding:24px">
        <p style="margin:0 0 12px;color:#0f172a">Bonjour ${escapeHtml(recipientName)},</p>
        <p style="margin:0;color:#0f172a">${escapeHtml(intro)}</p>
        ${LEVELS.map(section).join("")}
        ${more ? `<p style="margin:16px 0 0;color:#475569">${escapeHtml(more)}</p>` : ""}
        <p style="margin:24px 0 0"><a href="${escapeHtml(alertsUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Ouvrir mes alertes</a></p>
        <p style="margin:24px 0 0;color:#64748b;font-size:12px">${escapeHtml(footer)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, text: text.join("\n"), html, count: notifications.length, projects, counts };
}
