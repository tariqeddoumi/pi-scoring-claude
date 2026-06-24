// =====================================================================
//  Journalisation de sécurité structurée (JSON) — prête pour ingestion SIEM.
//  Émet des événements authN/authZ sur stdout au format ligne‑JSON, avec
//  masquage des données sensibles. Volontairement sans dépendance.
// =====================================================================

import "server-only";

export type SecurityEvent =
  | "login_success"
  | "login_failure"
  | "logout"
  | "access_denied"
  | "export";

interface SecurityDetails {
  actorId?: string | null;
  email?: string | null;
  role?: string | null;
  permission?: string | null;
  resource?: string | null;
  ip?: string | null;
  reason?: string | null;
}

/** Masque partiellement un email (j***@domaine) pour limiter la fuite en logs. */
function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

export function securityEvent(event: SecurityEvent, details: SecurityDetails = {}): void {
  const level = event === "login_failure" || event === "access_denied" ? "warn" : "info";
  const line = {
    ts: new Date().toISOString(),
    level,
    category: "security",
    event,
    actorId: details.actorId ?? null,
    email: maskEmail(details.email),
    role: details.role ?? null,
    permission: details.permission ?? null,
    resource: details.resource ?? null,
    ip: details.ip ?? null,
    reason: details.reason ?? null,
  };
  // Une ligne JSON par événement (parsable par un collecteur de logs).
  // eslint-disable-next-line no-console
  console[level === "warn" ? "warn" : "log"](JSON.stringify(line));
}
