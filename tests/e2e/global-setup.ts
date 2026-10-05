import type { FullConfig } from "@playwright/test";

// Compile les pages principales avant les tests (mode développement) : les
// délais des tests portent ensuite sur l'application, pas sur la compilation.
const WARM_UP = ["/", "/projects", "/alerts", "/alerts/resume", "/projects/new", "/risk"];

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  for (const path of WARM_UP) {
    try {
      await fetch(new URL(path, baseURL), { signal: AbortSignal.timeout(180_000) });
    } catch {
      // Une page en échec sera signalée par les tests eux-mêmes.
    }
  }
}
