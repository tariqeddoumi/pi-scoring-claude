import { expect, test } from "@playwright/test";
import { CRON_SECRET } from "./env";

// Alertes & échéances, résumé hebdomadaire par e-mail et tâche planifiée.

test("filtre les alertes par gravité", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Alertes & échéances" })).toBeVisible();
  await page.getByRole("link", { name: /À traiter en priorité/ }).first().click();
  await expect(page).toHaveURL(/niveau=danger/);
  const items = page.locator("main ul > li");
  expect(await items.count()).toBeGreaterThan(0);
  for (const li of await items.all()) await expect(li).toContainText("À traiter en priorité");
});

test("un chargé d'affaires ne voit que ses dossiers, et l'aperçu de son résumé", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "e2e_user", value: "rm@bank.ma", url: baseURL! }]);
  await page.goto("/alerts");
  await expect(page.getByText("Vos dossiers", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Résumé hebdomadaire par e-mail" }).click();
  await expect(page).toHaveURL(/\/alerts\/resume/);
  await expect(page.getByText(/Vos alertes de la semaine : /)).toBeVisible();
  await expect(page.getByText("Destinataire : rm@bank.ma.")).toBeVisible();
  const mail = page.frameLocator('iframe[title="Aperçu de l\'e-mail"]');
  await expect(mail.getByText("Bonjour Karim", { exact: false })).toBeVisible();
  await expect(mail.getByRole("link", { name: "Ouvrir mes alertes" })).toBeVisible();
});

test("tâche planifiée : refusée sans secret, aperçu avec le secret", async ({ request }) => {
  expect((await request.get("/api/cron/alert-digest")).status()).toBe(401);
  expect((await request.get("/api/cron/alert-digest", { headers: { Authorization: "Bearer mauvais-secret-0000000" } })).status()).toBe(401);
  const res = await request.get("/api/cron/alert-digest?apercu=1", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  expect(res.status()).toBe(200);
  const report = await res.json();
  expect(report.mode).toBe("preview");
  const rm = report.items.find((i: { email: string }) => i.email === "rm@bank.ma");
  expect(rm.status).toBe("preview");
  expect(rm.alerts).toBeGreaterThan(0);
  expect(rm.subject).toMatch(/^Vos alertes de la semaine/);
});
