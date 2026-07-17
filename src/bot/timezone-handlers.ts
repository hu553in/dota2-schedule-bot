import type { Bot } from "grammy";

import { parseTimezoneInput } from "../timezone.ts";
import type { BotContext } from "./context.ts";
import type { BotDependencies } from "./dependencies.ts";
import type { InputRouter } from "./input.ts";
import { timezoneKeyboard } from "./keyboards.ts";
import { timezoneMessage } from "./messages.ts";
import {
  acknowledge,
  privateCommandOnly,
  replyStorageError,
  showScreen,
} from "./runtime.ts";
import type { ScreenMode } from "./runtime.ts";

async function showTimezone(
  context: BotContext,
  mode: ScreenMode,
  knownOffset?: null | number
): Promise<void> {
  if (!context.preferencesAvailable && knownOffset === undefined) {
    await replyStorageError(
      context,
      new Error("Preferences are unavailable"),
      context.t("errors.timezoneOpen")
    );
    return;
  }
  const offset =
    knownOffset === undefined
      ? context.preferences.utcOffsetMinutes
      : knownOffset;
  await showScreen(
    context,
    timezoneMessage(context.t, offset),
    timezoneKeyboard(context.t, offset === null),
    mode
  );
}

export function registerTimezoneHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies,
  input: InputRouter
): void {
  const { botInfo, preferencesStore } = dependencies;

  async function saveTimezone(
    context: BotContext,
    offsetMinutes: null | number
  ): Promise<boolean> {
    if (!context.from) {
      return false;
    }
    try {
      await preferencesStore.setUtcOffset(context.from.id, offsetMinutes);
      context.preferences.utcOffsetMinutes = offsetMinutes;
      context.preferencesAvailable = true;
      return true;
    } catch (error) {
      await replyStorageError(context, error, context.t("errors.timezoneSave"));
      return false;
    }
  }

  input.handle("timezone", async (context, rawText) => {
    if (!context.from) {
      return;
    }
    const timezone = parseTimezoneInput(rawText);
    if (!timezone) {
      await context.reply(context.t("timezone.invalid"));
      await input.prompt(context, "timezone");
      return;
    }
    const offsetMinutes =
      timezone.mode === "automatic" ? null : timezone.minutes;
    if (!(await saveTimezone(context, offsetMinutes))) {
      return;
    }
    await showTimezone(context, "reply", offsetMinutes);
  });

  bot.command("timezone", async (context) => {
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    await showTimezone(context, "reply");
  });

  bot.callbackQuery("menu:timezone", async (context) => {
    const acknowledged = acknowledge(context);
    await showTimezone(context, "edit");
    await acknowledged;
  });

  bot.callbackQuery("timezone:change", async (context) => {
    const acknowledged = acknowledge(context);
    await input.prompt(context, "timezone");
    await acknowledged;
  });

  bot.callbackQuery("timezone:auto", async (context) => {
    const acknowledged = acknowledge(context);
    if (await saveTimezone(context, null)) {
      await showTimezone(context, "edit", null);
    }
    await acknowledged;
  });
}
