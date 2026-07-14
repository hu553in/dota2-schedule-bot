import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, chmod, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { Api, Bot } from "grammy";
import { unstable_startWorker } from "wrangler";
import {
  BOT_ALLOWED_UPDATES,
  configureBotCommands,
} from "../src/bot/commands.ts";
import {
  botTokenSchema,
  masterKeySchema,
  webhookSecretSchema,
} from "../src/config.ts";
import { errorMessage } from "../src/error-message.ts";

const DEV_VARS_PATH = ".dev.vars";
const TELEGRAM_TIMEOUT_SECONDS = 5;
const MASTER_KEY_PLACEHOLDER = "replace_with_base64_encoded_32_random_bytes";
const WEBHOOK_SECRET_PLACEHOLDER = "replace_with_random_secret";

interface DevSecrets {
  botToken: string;
  webhookSecret: string;
}

interface DevVars {
  BOT_TOKEN: string | undefined;
  PS_MASTER_KEY: string | undefined;
  WEBHOOK_SECRET: string | undefined;
}

function setEnvValue(source: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "gm");
  if (pattern.test(source)) {
    return source.replace(pattern, line);
  }
  const separator = source.length === 0 || source.endsWith("\n") ? "" : "\n";
  return `${source}${separator}${line}\n`;
}

function parseDevVars(source: string): DevVars {
  const { BOT_TOKEN, PS_MASTER_KEY, WEBHOOK_SECRET } = parseEnv(source);
  return { BOT_TOKEN, PS_MASTER_KEY, WEBHOOK_SECRET };
}

function assertReplaceableSecret(
  name: string,
  value: string | undefined,
  placeholder: string
): void {
  if (value && value !== placeholder) {
    throw new Error(
      `${name} in ${DEV_VARS_PATH} is invalid. Fix or remove it; the script did not replace it.`
    );
  }
}

async function loadDevSecrets(): Promise<DevSecrets> {
  const fileExists = await access(DEV_VARS_PATH).then(
    () => true,
    () => false
  );
  let source = fileExists ? await readFile(DEV_VARS_PATH, "utf8") : "";
  let values: DevVars;
  try {
    values = parseDevVars(source);
  } catch (error) {
    throw new Error(`Could not read ${DEV_VARS_PATH}: ${errorMessage(error)}`, {
      cause: error,
    });
  }

  let updatedFile = false;
  if (values.BOT_TOKEN === undefined) {
    source = setEnvValue(source, "BOT_TOKEN", "");
    updatedFile = true;
  }
  if (!masterKeySchema.safeParse(values.PS_MASTER_KEY).success) {
    assertReplaceableSecret(
      "PS_MASTER_KEY",
      values.PS_MASTER_KEY,
      MASTER_KEY_PLACEHOLDER
    );
    source = setEnvValue(
      source,
      "PS_MASTER_KEY",
      randomBytes(32).toString("base64")
    );
    updatedFile = true;
  }
  if (!webhookSecretSchema.safeParse(values.WEBHOOK_SECRET).success) {
    assertReplaceableSecret(
      "WEBHOOK_SECRET",
      values.WEBHOOK_SECRET,
      WEBHOOK_SECRET_PLACEHOLDER
    );
    source = setEnvValue(
      source,
      "WEBHOOK_SECRET",
      randomBytes(32).toString("hex")
    );
    updatedFile = true;
  }
  if (updatedFile || !fileExists) {
    await writeFile(DEV_VARS_PATH, source, { mode: 0o600 });
    values = parseDevVars(source);
    console.log(`Local configuration is ready in ${DEV_VARS_PATH}.`);
  }
  await chmod(DEV_VARS_PATH, 0o600);

  const botToken = values.BOT_TOKEN ?? "";
  if (!botTokenSchema.safeParse(botToken).success) {
    throw new Error(
      `Add BOT_TOKEN from @BotFather to ${DEV_VARS_PATH}, then run script again.`
    );
  }
  const webhookSecret = values.WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(`WEBHOOK_SECRET is missing from ${DEV_VARS_PATH}.`);
  }
  return { botToken, webhookSecret };
}

async function applyLocalMigrations(): Promise<void> {
  console.log("Applying local D1 migrations...");
  const migrationProcess = spawn(
    "wrangler",
    ["d1", "migrations", "apply", "DB", "--local"],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  const exitCode = await waitForExit(migrationProcess);
  if (exitCode !== 0) {
    throw new Error(`Local D1 migration failed with exit code ${exitCode}.`);
  }
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
}

async function run(): Promise<void> {
  const secrets = await loadDevSecrets();
  const telegram = new Api(secrets.botToken, {
    timeoutSeconds: TELEGRAM_TIMEOUT_SECONDS,
  });
  const botInfo = await telegram.getMe();
  await configureBotCommands(telegram);
  await applyLocalMigrations();

  console.log("Starting the local Worker...");
  const localWorker = await unstable_startWorker({
    bindings: {
      BOT_NAME: { type: "plain_text", value: botInfo.first_name },
      BOT_USERNAME: { type: "plain_text", value: botInfo.username },
    },
    config: "wrangler.jsonc",
  });
  try {
    await localWorker.ready;
  } catch (error) {
    await localWorker.dispose().catch(() => undefined);
    throw error;
  }

  const pollingBot = new Bot(secrets.botToken, {
    botInfo,
  });
  pollingBot.use(async (context) => {
    const response = await localWorker.fetch("http://local/", {
      body: JSON.stringify(context.update),
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": secrets.webhookSecret,
      },
      method: "POST",
    });
    await response.body?.cancel();
    if (!response.ok) {
      throw new Error(`The local Worker returned HTTP ${response.status}.`);
    }
  });
  pollingBot.catch(({ error }) => {
    console.error(`Local update failed: ${errorMessage(error)}`);
  });

  let polling: Promise<void> | undefined;
  let pollingStop: Promise<void> | undefined;

  let stopping = false;
  const stop = () => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log("\nStopping local development...");
    if (pollingBot.isRunning()) {
      pollingStop ??= pollingBot.stop().catch(() => undefined);
    }
  };
  const onInterrupt = () => stop();
  const onTerminate = () => stop();
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  try {
    polling = pollingBot.start({
      allowed_updates: [...BOT_ALLOWED_UPDATES],
      drop_pending_updates: true,
      onStart: () => {
        console.log(`\nBot is ready: https://t.me/${botInfo.username}`);
        console.log("Press Ctrl+C to stop it.\n");
      },
    });
    await polling;
    if (!stopping) {
      throw new Error("Telegram polling stopped unexpectedly.");
    }
  } catch (error) {
    if (!stopping) {
      throw error;
    }
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    if (!pollingStop && pollingBot.isRunning()) {
      pollingStop = pollingBot.stop();
    }
    await Promise.allSettled([
      ...(polling ? [polling] : []),
      ...(pollingStop ? [pollingStop] : []),
    ]);
    await localWorker.dispose();
    if (stopping) {
      console.log("Local development stopped.");
    }
  }
}

run().catch((error: unknown) => {
  console.error(`\nLocal development failed: ${errorMessage(error)}`);
  process.exitCode = 1;
});
