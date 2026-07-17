import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

import { Api } from "grammy";

import {
  configureBotCommands,
  configureBotWebhook,
} from "../src/bot/commands.ts";
import { errorMessage } from "../src/error-message.ts";
import {
  selectDeploymentSecrets,
  workerDeployArguments,
  workerUrlFromDeployOutput,
} from "./deployment.ts";
import type { DeploymentVariables } from "./deployment.ts";

const DEV_VARS_PATH = ".dev.vars";
const TELEGRAM_TIMEOUT_SECONDS = 5;

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function parseDeploymentVariables(source: string): DeploymentVariables {
  const { BOT_TOKEN, PS_MASTER_KEY, WEBHOOK_SECRET } = parseEnv(source);
  return { BOT_TOKEN, PS_MASTER_KEY, WEBHOOK_SECRET };
}

async function localVariables(): Promise<DeploymentVariables | null> {
  try {
    return parseDeploymentVariables(await readFile(DEV_VARS_PATH, "utf-8"));
  } catch (error) {
    if (isMissingFile(error)) {
      return null;
    }
    throw new Error(`Could not read ${DEV_VARS_PATH}: ${errorMessage(error)}`, {
      cause: error,
    });
  }
}

function environmentVariables(): DeploymentVariables {
  const { BOT_TOKEN, PS_MASTER_KEY, WEBHOOK_SECRET } = process.env;
  return { BOT_TOKEN, PS_MASTER_KEY, WEBHOOK_SECRET };
}

function runWrangler(
  arguments_: string[],
  environment: NodeJS.ProcessEnv = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("wrangler", arguments_, {
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      const status = signal ? `signal ${signal}` : `exit code ${exitCode ?? 1}`;
      reject(new Error(`Wrangler failed with ${status}.`));
    });
  });
}

async function deployWorker(arguments_: string[]): Promise<string> {
  const outputDirectory = await mkdtemp(
    path.join(tmpdir(), "d2-schedule-bot-deploy-")
  );
  const outputPath = path.join(outputDirectory, "wrangler.ndjson");

  try {
    await runWrangler(arguments_, { WRANGLER_OUTPUT_FILE_PATH: outputPath });
    return workerUrlFromDeployOutput(await readFile(outputPath, "utf-8"));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
}

async function run(): Promise<void> {
  const secrets = selectDeploymentSecrets(
    await localVariables(),
    environmentVariables(),
    DEV_VARS_PATH
  );
  const telegram = new Api(secrets.botToken, {
    timeoutSeconds: TELEGRAM_TIMEOUT_SECONDS,
  });
  const botInfo = await telegram.getMe();

  console.log("Applying remote D1 migrations...");
  await runWrangler(["d1", "migrations", "apply", "DB", "--remote"]);

  console.log("Deploying the Worker...");
  const webhookUrl = await deployWorker(
    workerDeployArguments(
      botInfo,
      secrets.useLocalSecrets ? DEV_VARS_PATH : null
    )
  );

  await configureBotWebhook(telegram, webhookUrl, secrets.webhookSecret);
  await configureBotCommands(telegram);
  console.log(`Telegram webhook is configured: ${webhookUrl}`);
  console.log("Telegram command descriptions are configured.");
}

const [, entryPoint] = process.argv;
if (entryPoint && pathToFileURL(entryPoint).href === import.meta.url) {
  run().catch((error: unknown) => {
    console.error(`\nDeployment failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
