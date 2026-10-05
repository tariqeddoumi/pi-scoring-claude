import { expect, test } from "@playwright/test";

// Navigation principale et recherche globale.

test("lien actif et recherche globale", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await nav.getByRole("link", { name: "Projets" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(nav.getByRole("link", { name: "Projets" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("searchbox", { name: "Rechercher un dossier" }).fill("Médina");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\?q=M%C3%A9dina|\/projects\?q=Médina/);
  await expect(page.locator("table tbody tr").first()).toContainText("Pôle Médina");
});
