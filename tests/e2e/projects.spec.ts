import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// Liste des projets : pagination, recherche, filtres et tri exécutés par la
// base ; export de la liste filtrée.

async function counts(page: Page) {
  const text = (await page.getByText(/\d+ dossier\(s\)/).first().textContent()) ?? "";
  return { total: Number(/(\d+) dossier\(s\)/.exec(text)?.[1]), text };
}
const tableRows = (page: Page) => page.locator("table tbody tr");

test("pagine la liste et navigue entre les pages", async ({ page }) => {
  await page.goto("/projects");
  const { total, text } = await counts(page);
  expect(total).toBeGreaterThan(25);
  expect(text).toContain("1–25 affichés");
  await expect(tableRows(page)).toHaveCount(25);

  const pager = page.getByRole("navigation", { name: "Pagination" });
  await expect(pager.locator('[aria-current="page"]')).toHaveText("1");
  await pager.getByRole("link", { name: "Suivante →" }).click();
  await expect(page).toHaveURL(/[?&]page=2/);
  await expect(pager.locator('[aria-current="page"]')).toHaveText("2");
  await expect(tableRows(page)).toHaveCount(total - 25);

  // 50 par page : tout tient sur une page, plus de pagination.
  await page.getByRole("link", { name: "50 dossiers par page" }).click();
  await expect(page).toHaveURL(/size=50/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(tableRows(page)).toHaveCount(total);
  await expect(pager).toHaveCount(0);
});

test("recherche sans tenir compte des accents ni de la casse", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("searchbox", { name: "Rechercher", exact: true }).fill("ECRIN souss");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/q=ECRIN\+souss/);
  await expect(tableRows(page).first()).toContainText("Écrin du Souss");
  for (const row of await tableRows(page).all()) await expect(row).toContainText("Écrin du Souss");
});

test("filtre les scores à rafraîchir et trie par montant", async ({ page }) => {
  await page.goto("/projects");
  const all = (await counts(page)).total;
  await page.getByRole("combobox", { name: "Scoring" }).selectOption("stale");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/scored=stale/);
  const stale = await counts(page);
  expect(stale.text).toContain(`sur ${all}`);
  expect(stale.total).toBeGreaterThan(0);
  expect(stale.total).toBeLessThan(all);

  await page.getByRole("link", { name: /Crédit/ }).click();
  await expect(page).toHaveURL(/sort=loanAmount&dir=desc/);
  await expect(page).toHaveURL(/scored=stale/);
  // Attendre le rendu de la liste triée (l'état de chargement remplace le tableau pendant la navigation).
  await expect(page.getByRole("link", { name: /Crédit/ })).toHaveAttribute("aria-sort", "descending");
  await expect(tableRows(page)).toHaveCount(Math.min(stale.total, 25));
  const amounts = await page.locator("table tbody tr td:nth-child(5) span[title]").evaluateAll((els) =>
    els.map((e) => Number((e.getAttribute("title") ?? "").replace(/\D/g, "")) || 0));
  expect(amounts.length).toBeGreaterThan(1);
  expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
});

test("exporte en CSV la liste filtrée, toutes pages confondues", async ({ page }) => {
  await page.goto("/projects?segment=social");
  const { total } = await counts(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "CSV" }).click()]);
  const csv = await readFile((await download.path())!, "utf8");
  const lines = csv.replace(/^﻿/, "").trim().split(/\r?\n/);
  expect(lines[0]).toContain("Référence");
  expect(lines).toHaveLength(total + 1);
  expect(lines.slice(1).every((l) => l.includes("Logement social"))).toBe(true);
});
