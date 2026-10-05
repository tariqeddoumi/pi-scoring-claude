import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests d'intégration : base PostgreSQL migrée et alimentée (npm run seed, puis
// scripts/seed-e2e.ts). Lancés par `npm run test:integration`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
