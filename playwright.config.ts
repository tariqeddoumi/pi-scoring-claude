import { defineConfig, devices } from "@playwright/test";
import { CRON_SECRET } from "./tests/e2e/env";

// Tests de bout en bout : application en mode développement (l'identité de
// test E2E_AUTH_EMAIL n'existe pas en production), base migrée et alimentée
// par `npm run seed` puis `npx tsx scripts/seed-e2e.ts`.
// Lancement : npm run test:e2e (PW_CHROMIUM_PATH pour un Chromium déjà installé).
const PORT = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "tests/e2e",
  // Première compilation des pages en mode développement : délais larges.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "bureau", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      E2E_AUTH_EMAIL: process.env.E2E_AUTH_EMAIL ?? "analyst@bank.ma",
      CRON_SECRET,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
