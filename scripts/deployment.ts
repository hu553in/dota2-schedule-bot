import {
  botTokenSchema,
  masterKeySchema,
  webhookSecretSchema,
} from "../src/config.ts";

const WORKERS_DEV_URL_PATTERN = /https:\/\/(?:[a-z0-9-]+\.)+workers\.dev\/?/giu;
const TRAILING_SLASH_PATTERN = /\/$/u;

export interface DeploymentVariables {
  BOT_TOKEN: string | undefined;
  PS_MASTER_KEY: string | undefined;
  WEBHOOK_SECRET: string | undefined;
}

export interface DeploymentSecrets {
  botToken: string;
  useLocalSecrets: boolean;
  webhookSecret: string;
}

interface BotIdentity {
  first_name: string;
  username: string;
}

export function selectDeploymentSecrets(
  local: DeploymentVariables | null,
  environment: DeploymentVariables,
  localPath = ".dev.vars"
): DeploymentSecrets {
  const source = local ?? environment;
  const botToken = source.BOT_TOKEN ?? "";
  const webhookSecret = source.WEBHOOK_SECRET ?? "";
  const location = local ? localPath : "the environment";

  if (!botTokenSchema.safeParse(botToken).success) {
    throw new Error(`BOT_TOKEN is missing or invalid in ${location}.`);
  }
  if (!webhookSecretSchema.safeParse(webhookSecret).success) {
    throw new Error(`WEBHOOK_SECRET is missing or invalid in ${location}.`);
  }
  if (local && !masterKeySchema.safeParse(local.PS_MASTER_KEY).success) {
    throw new Error(`PS_MASTER_KEY is missing or invalid in ${localPath}.`);
  }
  return { botToken, useLocalSecrets: local !== null, webhookSecret };
}

export function workerDeployArguments(
  bot: BotIdentity,
  secretsFile: null | string
): string[] {
  const arguments_ = [
    "deploy",
    "--var",
    `BOT_NAME:${bot.first_name}`,
    "--var",
    `BOT_USERNAME:${bot.username}`,
  ];
  if (secretsFile) {
    arguments_.push("--secrets-file", secretsFile);
  }
  return arguments_;
}

export function workerUrlFromDeployOutput(output: string): string {
  const matches = [...output.matchAll(WORKERS_DEV_URL_PATTERN)];
  const url = matches.at(-1)?.[0];
  if (!url) {
    throw new Error("Wrangler did not report a workers.dev deployment URL.");
  }
  return url.replace(TRAILING_SLASH_PATTERN, "");
}
