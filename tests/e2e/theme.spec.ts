import { expect, test, type Page } from "@playwright/test";

// Thème d'affichage : Système (défaut), Clair, Sombre ; choix conservé.

const pageBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const isDark = (rgb: string) => {
  const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number);
  return (r! + g! + b!) / 3 < 80;
};

test("bascule en sombre, conserve le choix, revient au thème du système", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(isDark(await pageBackground(page))).toBe(false);

  await page.locator("aside").getByText("Sombre", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(isDark(await pageBackground(page))).toBe(true);

  // Rendu serveur au chargement suivant (cookie) : pas de retour au clair.
  await page.goto("/projects");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(isDark(await pageBackground(page))).toBe(true);

  await page.locator("aside").getByText("Système", { exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect(isDark(await pageBackground(page))).toBe(false);
  await page.emulateMedia({ colorScheme: "dark" });
  expect(isDark(await pageBackground(page))).toBe(true);
});
