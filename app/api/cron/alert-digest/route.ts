import { appBaseUrl, isCronAuthorized } from "@/lib/cronAuth";
import { mailConfig } from "@/server/services/mailer";
import { runWeeklyDigest } from "@/server/services/alertDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Résumé hebdomadaire des alertes par e-mail (planifié dans vercel.json, le
 * lundi à 7 h UTC = 8 h à Casablanca). Protégé par CRON_SECRET.
 *   ?apercu=1 : n'envoie rien et renvoie le contenu des e-mails (contrôle).
 * Sans fournisseur d'e-mail configuré (RESEND_API_KEY, MAIL_FROM), la tâche
 * fonctionne en aperçu.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return new Response("Tâche planifiée non configurée (CRON_SECRET).", { status: 503 });
  if (!isCronAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Accès refusé", { status: 401 });
  }
  const preview = new URL(req.url).searchParams.get("apercu") === "1";
  try {
    const report = await runWeeklyDigest({
      appUrl: appBaseUrl(req.url),
      send: !preview && mailConfig() != null,
      withContent: preview,
    });
    return Response.json(report, { status: report.items.some((i) => i.status === "error") ? 207 : 200 });
  } catch (e) {
    return new Response(`Résumé indisponible : ${(e as Error).message}`, { status: 503 });
  }
}
