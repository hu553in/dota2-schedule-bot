import type { Bot } from "grammy";
import { z } from "zod";

import { getTranslator, SUPPORTED_LOCALES } from "../localization.ts";
import type { BotContext } from "./context.ts";
import type { BotDependencies } from "./dependencies.ts";
import { languageKeyboard } from "./keyboards.ts";
import { languageMessage } from "./messages.ts";
import { acknowledge, replyStorageError, showScreen } from "./runtime.ts";

const LANGUAGE_PATTERN = /^language:(en|ru)$/u;
const localeSchema = z.enum(SUPPORTED_LOCALES);

async function showLanguage(context: BotContext): Promise<void> {
  if (!context.preferencesAvailable) {
    await replyStorageError(
      context,
      new Error("Preferences are unavailable"),
      context.t("errors.languageOpen")
    );
    return;
  }
  await showScreen(
    context,
    languageMessage(
      context.t,
      context.locale,
      context.preferences.language !== null
    ),
    languageKeyboard(context.t, context.locale),
    "edit"
  );
}

export function registerLanguageHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies
): void {
  const { preferencesStore } = dependencies;

  bot.callbackQuery("menu:language", async (context) => {
    const acknowledged = acknowledge(context);
    await showLanguage(context);
    await acknowledged;
  });

  bot.callbackQuery(LANGUAGE_PATTERN, async (context) => {
    const locale = localeSchema.parse(context.match[1]);
    const acknowledged = acknowledge(context);
    try {
      await preferencesStore.setLanguage(context.from.id, locale);
    } catch (error) {
      await replyStorageError(context, error, context.t("errors.languageSave"));
      await acknowledged;
      return;
    }
    context.locale = locale;
    context.t = getTranslator(locale);
    context.preferences.language = locale;
    context.preferencesAvailable = true;
    await showLanguage(context);
    await acknowledged;
  });
}
