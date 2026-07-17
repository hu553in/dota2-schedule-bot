import path from "node:path";

import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./src/index.ts",
      miniflare: {
        bindings: {
          BOT_NAME: "Dota 2 schedule bot",
          BOT_TOKEN: "123456789:test_bot_token_12345678901234567890",
          BOT_USERNAME: "d2_schedule_bot",
          PS_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
          TELEGRAM_PREMIUM: "false",
          TEST_MIGRATIONS: await readD1Migrations(
            path.join(import.meta.dirname, "migrations")
          ),
          WEBHOOK_SECRET: "test_webhook_secret_1234567890_ab",
        },
        compatibilityDate: "2026-07-13",
        d1Databases: ["DB"],
      },
    })),
  ],
  test: {
    clearMocks: true,
    coverage: {
      include: ["src/**/*.ts"],
      provider: "istanbul",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        perFile: true,
        statements: 90,
      },
    },
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
