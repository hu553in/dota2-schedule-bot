import type { Api } from "grammy";
import type { BotCommand } from "grammy/types";
import { getTranslator, type Locale } from "../localization.ts";

export const BOT_COMMANDS = [
  "start",
  "favorites",
  "timezone",
  "settoken",
  "status",
  "cleartoken",
  "help",
] as const;

export const BOT_ALLOWED_UPDATES = ["message", "callback_query"] as const;
const TRAILING_SLASH_PATTERN = /\/$/u;

function normalizedWebhookUrl(value: string | undefined): string {
  return (value ?? "").replace(TRAILING_SLASH_PATTERN, "");
}

export function botCommands(locale: Locale): BotCommand[] {
  const t = getTranslator(locale);
  return BOT_COMMANDS.map((command) => ({
    command,
    description: t(`commands.${command}`),
  }));
}

export async function configureBotCommands(api: Api): Promise<void> {
  await Promise.all([
    api.setMyCommands(botCommands("en")),
    api.setMyCommands(botCommands("ru"), { language_code: "ru" }),
  ]);
}

export async function configureBotWebhook(
  api: Api,
  webhookUrl: string,
  webhookSecret: string
): Promise<void> {
  await api.setWebhook(webhookUrl, {
    allowed_updates: [...BOT_ALLOWED_UPDATES],
    drop_pending_updates: false,
    secret_token: webhookSecret,
  });

  const webhook = await api.getWebhookInfo();
  if (normalizedWebhookUrl(webhook.url) !== normalizedWebhookUrl(webhookUrl)) {
    throw new Error(
      `Telegram returned an unexpected webhook URL: ${webhook.url || "none"}.`
    );
  }
}
