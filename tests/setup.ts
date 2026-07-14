import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { D1Migration } from "@cloudflare/vitest-pool-workers";
import type { WorkerEnv } from "../src/config.ts";

export interface TestEnv extends WorkerEnv {
  TEST_MIGRATIONS: D1Migration[];
}

export const testEnv = env as unknown as TestEnv;

await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
