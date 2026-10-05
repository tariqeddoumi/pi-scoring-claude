import { describe, it, expect, vi } from "vitest";
import { buildAlertDigest, DIGEST_MAX_ITEMS, escapeHtml } from "@/lib/domain/alertDigest";
import type { Notification } from "@/lib/domain/notifications";
import { mailConfig, sendMail } from "@/server/services/mailer";
import { appBaseUrl, isCronAuthorized } from "@/lib/cronAuth";

const n = (o: Partial<Notification>): Notification => ({
  id: Math.random().toString(36), projectId: "p1", reference: "PI-001", projectName: "Résidence Al Amal",
  kind: "REVIEW_OVERDUE", level: "danger", title: "Revue périodique dépassée de 12 j", detail: "Périodicité 90 j.",
  date: "2026-09-20", href: "/projects/p1/scoring", ...o,
});
const now = new Date("2026-10-05T07:00:00Z");
const APP = "https://pi.example.ma";

describe("Résumé hebdomadaire des alertes (e-mail)", () => {
  it("n'envoie rien quand il n'y a aucune alerte", () => {
    expect(buildAlertDigest({ recipientName: "Karim", notifications: [], appUrl: APP, now })).toBeNull();
  });

  it("résume les alertes par gravité, avec des liens absolus", () => {
    const d = buildAlertDigest({
      recipientName: "Karim", appUrl: APP, now,
      notifications: [
        n({}), n({ projectId: "p2", reference: "PI-002", level: "danger", kind: "CRITICAL_EVENT", title: "Échéance impayée", href: "/projects/p2/suivi#journal" }),
        n({ projectId: "p2", reference: "PI-002", level: "warning", kind: "COMMITTEE_EXPIRING", title: "Décision de comité valable encore 12 j" }),
        n({ projectId: "p3", reference: "PI-003", level: "info", kind: "REVIEW_DUE_SOON", title: "Revue périodique dans 20 j" }),
      ],
    })!;
    expect(d.subject).toBe("Vos alertes de la semaine : 2 prioritaires, 1 en vigilance, 1 à prévoir (3 dossiers)");
    expect(d.count).toBe(4);
    expect(d.projects).toBe(3);
    expect(d.text).toContain("Bonjour Karim,");
    // Ordre : prioritaire, vigilance, à prévoir.
    expect(d.text.indexOf("À TRAITER EN PRIORITÉ (2)")).toBeLessThan(d.text.indexOf("VIGILANCE (1)"));
    expect(d.text.indexOf("VIGILANCE (1)")).toBeLessThan(d.text.indexOf("À PRÉVOIR (1)"));
    expect(d.text).toContain("https://pi.example.ma/projects/p2/suivi#journal");
    expect(d.text).toContain("Toutes vos alertes : https://pi.example.ma/alerts");
    expect(d.html).toContain('href="https://pi.example.ma/projects/p1/scoring"');
    expect(d.html).toContain("Ouvrir mes alertes");
  });

  it("échappe le contenu saisi dans le HTML", () => {
    const d = buildAlertDigest({ recipientName: "<b>K</b>", appUrl: APP, now, notifications: [n({ projectName: `Projet <script>alert("x")</script>` })] })!;
    expect(d.html).not.toContain("<script>");
    expect(d.html).toContain("&lt;script&gt;");
    expect(d.html).toContain("&lt;b&gt;K&lt;/b&gt;");
    expect(escapeHtml(`a&"'`)).toBe("a&amp;&quot;&#39;");
  });

  it("limite le détail et renvoie vers l'application pour le reste", () => {
    const many = Array.from({ length: DIGEST_MAX_ITEMS + 5 }, (_, i) => n({ projectId: `p${i}`, reference: `PI-${i}` }));
    const d = buildAlertDigest({ recipientName: "Karim", appUrl: `${APP}/`, now, notifications: many })!;
    expect(d.count).toBe(DIGEST_MAX_ITEMS + 5);
    expect(d.text).toContain("… et 5 autres alertes à consulter dans l'application.");
    expect(d.text.match(/^- PI-/gm)).toHaveLength(DIGEST_MAX_ITEMS);
    expect(d.text).not.toContain("pi.example.ma//");
  });
});

describe("Envoi des e-mails", () => {
  it("n'est actif qu'avec une clé et un expéditeur", () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(mailConfig({ RESEND_API_KEY: "re_x", MAIL_FROM: "Alertes <alertes@banque.ma>" })).toEqual({ provider: "resend", apiKey: "re_x", from: "Alertes <alertes@banque.ma>" });
  });

  it("appelle l'API du fournisseur et rapporte les échecs sans lever d'exception", async () => {
    const cfg = { provider: "resend" as const, apiKey: "re_x", from: "alertes@banque.ma" };
    const ok = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    expect(await sendMail({ to: "rm@bank.ma", subject: "S", text: "T", html: "<p>H</p>" }, cfg, ok as unknown as typeof fetch)).toEqual({ delivered: true, id: "msg_1" });
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_x");
    expect(JSON.parse(init.body as string)).toMatchObject({ from: "alertes@banque.ma", to: ["rm@bank.ma"], subject: "S" });

    const ko = vi.fn(async () => new Response("quota", { status: 429 }));
    expect(await sendMail({ to: "rm@bank.ma", subject: "S", text: "T", html: "H" }, cfg, ko as unknown as typeof fetch)).toEqual({ delivered: false, reason: "HTTP 429 quota" });
    const down = vi.fn(async () => { throw new Error("réseau"); });
    expect(await sendMail({ to: "rm@bank.ma", subject: "S", text: "T", html: "H" }, cfg, down as unknown as typeof fetch)).toEqual({ delivered: false, reason: "réseau" });
  });
});

describe("Tâche planifiée", () => {
  const secret = "s3cr3t-0123456789abcdef";
  it("exige le secret exact (et un secret suffisamment long)", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
    expect(isCronAuthorized("Bearer court", "court")).toBe(false);
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
  });
  it("construit les liens sur l'adresse publique de l'application", () => {
    expect(appBaseUrl("http://localhost:3000/api/cron/alert-digest", { APP_URL: "https://pi.banque.ma/" })).toBe("https://pi.banque.ma");
    expect(appBaseUrl("http://x/api", { VERCEL_PROJECT_PRODUCTION_URL: "pi-scoring.vercel.app" })).toBe("https://pi-scoring.vercel.app");
    expect(appBaseUrl("http://localhost:3000/api/cron/alert-digest", {})).toBe("http://localhost:3000");
  });
});
