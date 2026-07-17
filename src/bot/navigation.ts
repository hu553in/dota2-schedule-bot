import type { Bot } from "grammy";

import { callbackPageSchema, PAGE_SIZE } from "../pagination.ts";
import type { Page } from "../pagination.ts";
import type { Favorite } from "../storage/favorites-store.ts";
import type { BotContext } from "./context.ts";
import type { BotDependencies } from "./dependencies.ts";
import {
  favoritesKeyboard,
  helpKeyboard,
  settingsKeyboard,
} from "./keyboards.ts";
import { favoritesMessage, helpMessage, settingsMessage } from "./messages.ts";
import {
  acknowledge,
  answerCallbackAlert,
  privateCommandOnly,
  replyStorageError,
  showHome,
  showScreen,
} from "./runtime.ts";
import type { ScreenMode } from "./runtime.ts";

const FAVORITES_PATTERN = /^favorites:(\d+)$/u;

export function registerNavigationHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies
): void {
  const { botInfo, favoritesStore, tokenStore } = dependencies;

  async function showFavorites(
    context: BotContext,
    requestedPage: number,
    mode: ScreenMode
  ): Promise<void> {
    if (!context.from) {
      return;
    }
    let page: Page<Favorite>;
    try {
      page = await favoritesStore.list(
        context.from.id,
        requestedPage,
        PAGE_SIZE
      );
      if (page.page > (page.totalPages ?? 1)) {
        page = await favoritesStore.list(
          context.from.id,
          page.totalPages ?? 1,
          PAGE_SIZE
        );
      }
    } catch (error) {
      await replyStorageError(
        context,
        error,
        context.t("errors.favoritesOpen")
      );
      return;
    }
    await showScreen(
      context,
      favoritesMessage(context.t, page),
      favoritesKeyboard(context.t, page),
      mode
    );
  }

  bot.command("start", async (context) => {
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    await showHome(context, tokenStore, "reply");
  });

  bot.command("help", async (context) => {
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    await showScreen(
      context,
      helpMessage(context.t),
      helpKeyboard(context.t),
      "reply"
    );
  });

  bot.command("favorites", async (context) => {
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    await showFavorites(context, 1, "reply");
  });

  bot.callbackQuery("menu:main", async (context) => {
    const acknowledged = acknowledge(context);
    await showHome(context, tokenStore, "edit");
    await acknowledged;
  });

  bot.callbackQuery("menu:help", async (context) => {
    const acknowledged = acknowledge(context);
    await showScreen(
      context,
      helpMessage(context.t),
      helpKeyboard(context.t),
      "edit"
    );
    await acknowledged;
  });

  bot.callbackQuery("menu:settings", async (context) => {
    const acknowledged = acknowledge(context);
    await showScreen(
      context,
      settingsMessage(context.t),
      settingsKeyboard(context.t),
      "edit"
    );
    await acknowledged;
  });

  bot.callbackQuery("menu:favorites", async (context) => {
    const acknowledged = acknowledge(context);
    await showFavorites(context, 1, "edit");
    await acknowledged;
  });

  bot.callbackQuery(FAVORITES_PATTERN, async (context) => {
    const page = callbackPageSchema.safeParse(context.match[1]);
    if (!page.success) {
      await answerCallbackAlert(context, context.t("toasts.staleFavorites"));
      return;
    }
    const acknowledged = acknowledge(context);
    await showFavorites(context, page.data, "edit");
    await acknowledged;
  });
}
