import type { UserFromGetMe } from "grammy/types";
import { z } from "zod";

export type WorkerEnv = Cloudflare.Env;

function botIdFromToken(token: string): number {
  const [id] = token.split(":", 1);
  return Number(id);
}

export const botTokenSchema = z
  .string()
  .min(20)
  .regex(/^\d+:[A-Za-z0-9_-]+$/u, "BOT_TOKEN is not a Telegram bot token")
  .refine((value) => {
    const id = botIdFromToken(value);
    return id > 0 && Number.isSafeInteger(id);
  }, "BOT_TOKEN contains an invalid Telegram bot id");

export const masterKeySchema = z.string().transform((value, context) => {
  try {
    const key = Uint8Array.fromBase64(value);
    if (key.byteLength === 32) {
      return key;
    }
  } catch {
    // Zod reports one stable configuration error below.
  }
  context.addIssue({
    code: "custom",
    message: "PS_MASTER_KEY must be base64-encoded 32 random bytes",
  });
  return z.NEVER;
});

export const webhookSecretSchema = z
  .string()
  .min(32)
  .max(256)
  .regex(
    /^[A-Za-z0-9_-]+$/u,
    "WEBHOOK_SECRET may contain only A-Z, a-z, 0-9, _ and -"
  );

const telegramPremiumSchema = z
  .enum(["false", "true"], {
    error: "TELEGRAM_PREMIUM must be true or false",
  })
  .default("false")
  .transform((value) => value === "true");

const configSchema = z.object({
  BOT_NAME: z.string().min(1),
  BOT_TOKEN: botTokenSchema,
  BOT_USERNAME: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9_]+$/u),
  PS_MASTER_KEY: masterKeySchema,
  TELEGRAM_PREMIUM: telegramPremiumSchema,
  WEBHOOK_SECRET: webhookSecretSchema,
});

export interface AppConfig {
  botInfo: UserFromGetMe;
  botToken: string;
  masterKey: Uint8Array;
  telegramPremium: boolean;
  webhookSecret: string;
}

export function parseConfig(environment: unknown): AppConfig {
  const config = configSchema.parse(environment);
  return {
    botInfo: {
      allows_users_to_create_topics: false,
      can_connect_to_business: false,
      can_join_groups: true,
      can_manage_bots: false,
      can_read_all_group_messages: false,
      first_name: config.BOT_NAME,
      has_main_web_app: false,
      has_topics_enabled: false,
      id: botIdFromToken(config.BOT_TOKEN),
      is_bot: true,
      supports_inline_queries: false,
      supports_join_request_queries: false,
      username: config.BOT_USERNAME,
    },
    botToken: config.BOT_TOKEN,
    masterKey: config.PS_MASTER_KEY,
    telegramPremium: config.TELEGRAM_PREMIUM,
    webhookSecret: config.WEBHOOK_SECRET,
  };
}
