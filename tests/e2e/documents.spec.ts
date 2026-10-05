import { expect, test } from "@playwright/test";

// Documents du dossier : dépôt d'une pièce (sans clé IA, classée d'après son
// nom), liste des pièces manquantes, « sans objet », retrait d'une pièce.

test("dépôt d'une pièce et liste des pièces manquantes", async ({ page }) => {
  await page.goto("/projects?q=PI-E2E-004");
  await page.locator("table").getByRole("link", { name: "PI-E2E-004", exact: true }).click();
  await page.getByRole("navigation", { name: "Vues du dossier" }).getByRole("link", { name: "Documents" }).click();
  await expect(page.getByRole("heading", { name: "Documents du dossier" })).toBeVisible();

  const plan = page.getByRole("region", { name: "Projet et travaux" }).getByRole("listitem").filter({ hasText: "Business plan" }).first();
  await expect(plan.getByText("Manquante")).toBeVisible();

  await page.getByLabel("Choisir des pièces").setInputFiles({
    name: "Business_Plan_Residence.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
  });
  await expect(page.getByText("Business_Plan_Residence.pdf").first()).toBeVisible();
  await expect(plan.getByText("Reçue", { exact: true })).toBeVisible();
  await expect(plan.getByText("classée d'après le nom")).toBeVisible();

  // Étude de marché sans objet, puis rétablie.
  const etude = page.getByRole("listitem").filter({ hasText: "Étude de marché" }).first();
  await etude.getByRole("button", { name: "Sans objet" }).click();
  await expect(etude.getByText("Sans objet", { exact: true })).toBeVisible();
  await etude.getByRole("button", { name: "Rétablir" }).click();
  await expect(etude.getByText("Manquante")).toBeVisible();

  await page.getByRole("button", { name: "Voir le texte" }).click();
  await expect(page.locator("pre")).toContainText("Pièces à fournir");
  await expect(page.locator("pre")).not.toContainText("Business plan");

  // Retrait de la pièce (confirmation intégrée).
  await plan.getByRole("button", { name: "Retirer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retirer" }).click();
  await expect(plan.getByText("Manquante")).toBeVisible();
});
