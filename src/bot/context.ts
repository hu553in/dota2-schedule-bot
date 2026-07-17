import type { Context, MiddlewareFn } from "grammy";

import { errorMessage } from "../error-message.ts";
import { getTranslator, localeFromLanguageCode } from "../localization.ts";
import type { Locale, Translate } from "../localization.ts";
import type { UserPreferences } from "../storage/preferences-store.ts";
import type { BotPreferencesStore } from "./dependencies.ts";

interface LocalizationFlavor {
  locale: Locale;
  preferences: UserPreferences;
  preferencesAvailable: boolean;
  t: Translate;
}

export type BotContext = Context & LocalizationFlavor;

export function localizationMiddleware(
  preferencesStore: BotPreferencesStore
): MiddlewareFn<BotContext> {
  return async (context, next) => {
    let preferences: UserPreferences = {
      language: null,
      utcOffsetMinutes: null,
    };
    let preferencesAvailable = true;
    if (context.from) {
      try {
        preferences = await preferencesStore.get(context.from.id);
      } catch (error) {
        preferencesAvailable = false;
        console.error("Preferences storage read failed", {
          message: errorMessage(error),
        });
      }
    }
    const locale =
      preferences.language ??
      localeFromLanguageCode(context.from?.language_code);
    context.locale = locale;
    context.preferences = preferences;
    context.preferencesAvailable = preferencesAvailable;
    context.t = getTranslator(locale);
    await next();
  };
}
