// Authentification des tâches planifiées (Vercel Cron) : en-tête
// « Authorization: Bearer <CRON_SECRET> », ajouté automatiquement par Vercel
// quand la variable CRON_SECRET est définie sur le projet. Comparaison à temps
// constant ; sans secret configuré, toute requête est refusée.

import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Adresse publique de l'application, pour les liens des e-mails. */
export function appBaseUrl(requestUrl: string, env: Record<string, string | undefined> = process.env): string {
  const configured = env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return new URL(requestUrl).origin;
}
