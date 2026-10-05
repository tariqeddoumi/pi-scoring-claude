import { expect, test } from "@playwright/test";

// Petit écran : menu en tiroir, liste des projets en cartes.

test("menu en tiroir et liste en cartes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Projets" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(drawer).toBeHidden();
  await expect(page.locator("table")).toBeHidden();
  const cards = page.locator("ul.md\\:hidden > li");
  await expect(cards).toHaveCount(25);
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
});
