import { Bot } from "grammy";

import { localizationMiddleware } from "./context.ts";
import type { BotContext } from "./context.ts";
import type { BotDependencies } from "./dependencies.ts";
import { createInputRouter } from "./input.ts";
import { registerLanguageHandlers } from "./language-handlers.ts";
import { registerMatchHandlers } from "./match-handlers.ts";
import { registerNavigationHandlers } from "./navigation.ts";
import {
  answerCallbackAlert,
  privateCallbackOnly,
  readStoredToken,
  storedTokenKeyboard,
} from "./runtime.ts";
import { registerSearchHandlers } from "./search-handlers.ts";
import { registerTimezoneHandlers } from "./timezone-handlers.ts";
import { registerTokenHandlers } from "./token-handlers.ts";

const TELEGRAM_TIMEOUT_SECONDS = 2;

export type { BotContext } from "./context.ts";
export type {
  BotApi,
  BotDependencies,
  BotFavoritesStore,
  BotPreferencesStore,
  BotTokenStore,
} from "./dependencies.ts";

export function createBot(dependencies: BotDependencies): Bot<BotContext> {
  const { botInfo, botToken, preferencesStore, telegramFetch } = dependencies;
  const bot = new Bot<BotContext>(botToken, {
    botInfo,
    client: {
      timeoutSeconds: TELEGRAM_TIMEOUT_SECONDS,
      ...(telegramFetch ? { fetch: telegramFetch } : {}),
    },
  });
  bot.api.config.use((previous, method, payload, signal) => {
    if (method === "sendMessage" || method === "editMessageText") {
      return previous(
        method,
        {
          ...payload,
          link_preview_options: { is_disabled: true },
        },
        signal
      );
    }
    return previous(method, payload, signal);
  });

  bot.use(localizationMiddleware(preferencesStore));
  bot.on("callback_query:data", async (context, next) => {
    if (await privateCallbackOnly(context)) {
      await next();
    }
  });
  const input = createInputRouter(botInfo);

  registerNavigationHandlers(bot, dependencies);
  registerLanguageHandlers(bot, dependencies);
  registerTokenHandlers(bot, dependencies, input);
  registerTimezoneHandlers(bot, dependencies, input);
  registerSearchHandlers(bot, dependencies, input);
  registerMatchHandlers(bot, dependencies);
  bot.use(input.middleware());

  bot.on("message:text", async (context) => {
    if (context.chat.type !== "private") {
      return;
    }
    const stored = await readStoredToken(context, dependencies.tokenStore);
    await context.reply(
      context.t(
        context.message.text.startsWith("/")
          ? "search.unknownCommand"
          : "search.unexpectedText"
      ),
      { reply_markup: storedTokenKeyboard(context.t, stored) }
    );
  });

  bot.on("callback_query:data", async (context) => {
    await answerCallbackAlert(context, context.t("toasts.staleButton"));
  });

  return bot;
}
