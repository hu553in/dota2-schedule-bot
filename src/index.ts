import { webhookCallback } from "grammy";

import { PandaScoreApi } from "./api/pandascore.ts";
import { createBot } from "./bot/create-bot.ts";
import { logWebhookError } from "./bot/errors.ts";
import { parseConfig } from "./config.ts";
import type { WorkerEnv } from "./config.ts";
import { FavoritesStore } from "./storage/favorites-store.ts";
import { PreferencesStore } from "./storage/preferences-store.ts";
import { createTokenStore } from "./storage/token-store.ts";

const WEBHOOK_TIMEOUT_MS = 9000;
type WebhookHandler = (request: Request) => Promise<Response>;
interface CachedWebhook {
  handler: Promise<WebhookHandler>;
  secret: string;
}
let cachedWebhook: CachedWebhook | undefined;

export async function createWebhook(
  environment: WorkerEnv
): Promise<WebhookHandler> {
  const config = parseConfig(environment);
  const bot = createBot({
    api: new PandaScoreApi(),
    botInfo: config.botInfo,
    botToken: config.botToken,
    favoritesStore: new FavoritesStore(environment.DB),
    preferencesStore: new PreferencesStore(environment.DB),
    telegramPremium: config.telegramPremium,
    tokenStore: await createTokenStore(environment.DB, config.masterKey),
  });
  return webhookCallback(bot, "cloudflare-mod", {
    secretToken: config.webhookSecret,
    timeoutMilliseconds: WEBHOOK_TIMEOUT_MS,
  });
}

export default {
  async fetch(request, environment): Promise<Response> {
    if (cachedWebhook?.secret !== environment.WEBHOOK_SECRET) {
      cachedWebhook = {
        handler: createWebhook(environment),
        secret: environment.WEBHOOK_SECRET,
      };
    }
    try {
      return await (
        await cachedWebhook.handler
      )(request);
    } catch (error) {
      logWebhookError(error);
      return new Response(null, { status: 500 });
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
