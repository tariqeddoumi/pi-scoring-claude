import { expect, test } from "@playwright/test";

// Fiche projet : onglets par lien, création avec erreurs par champ,
// fenêtre de confirmation intégrée.

test("création d'un projet : erreurs sous les champs, puis enregistrement", async ({ page }) => {
  await page.goto("/projects/new");
  const reference = `PI-E2E-NEW-${Date.now().toString(36).toUpperCase()}`;
  await page.getByRole("textbox", { name: "Référence", exact: true }).fill(reference);
  await page.getByRole("textbox", { name: "Nom du projet", exact: true }).fill("A");
  await page.getByRole("combobox", { name: "Promoteur", exact: true }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Créer le projet" }).click();

  const name = page.getByRole("textbox", { name: "Nom du projet", exact: true });
  await expect(name).toHaveAttribute("aria-invalid", "true");
  const describedBy = (await name.getAttribute("aria-describedby")) ?? "";
  await expect(page.locator(`[id="${describedBy.split(" ").pop()}"]`)).not.toBeEmpty();
  await expect(page.getByRole("alert").first()).toBeVisible();

  await name.fill("Résidence Les Amandiers (test)");
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page).toHaveURL(/\/projects\/(?!new)[^/?]+/);
  await expect(page.getByRole("heading", { name: "Résidence Les Amandiers (test)" })).toBeVisible();
  await expect(page.getByText(reference).first()).toBeVisible();
});

test("onglets de la fiche accessibles par lien direct", async ({ page }) => {
  await page.goto("/projects?q=PI-E2E-003");
  await page.locator("table").getByRole("link", { name: "PI-E2E-003", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Jardins de Témara" })).toBeVisible();
  await page.getByRole("tab", { name: "Circuit & comité" }).click();
  await expect(page).toHaveURL(/onglet=circuit/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Circuit & comité" })).toHaveAttribute("data-state", "active");
});

test("rejet : confirmation intégrée, Annuler par défaut, Échap annule", async ({ page }) => {
  await page.goto("/projects?q=PI-E2E-003");
  await page.locator("table").getByRole("link", { name: "PI-E2E-003", exact: true }).click();
  await page.getByRole("button", { name: "Rejeter" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Annuler" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Rien n'a changé : le dossier est toujours en contre-étude.
  await expect(page.getByText("Contre-étude (Risque)").first()).toBeVisible();
});
