import type { Bot } from "grammy";
import { z } from "zod";
import type { BotContext } from "./context.ts";
import type { BotDependencies } from "./dependencies.ts";
import { replyApiError } from "./errors.ts";
import type { InputRouter } from "./input.ts";
import {
  homeKeyboard,
  privateChatKeyboard,
  tokenDeleteKeyboard,
  tokenGuideKeyboard,
  tokenKeyboard,
} from "./keyboards.ts";
import {
  tokenDeleteConfirmationMessage,
  tokenGuideMessage,
  tokenSavedMessage,
  tokenScreenMessage,
} from "./messages.ts";
import {
  acknowledge,
  deleteSensitiveMessage,
  privateCommandOnly,
  readStoredToken,
  replyStorageError,
  showScreen,
  showTokenScreen,
} from "./runtime.ts";

const tokenCandidateSchema = z
  .string()
  .trim()
  .min(20)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

export function registerTokenHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies,
  input: InputRouter
): void {
  const { api, botInfo, tokenStore } = dependencies;

  async function acceptToken(
    context: BotContext,
    rawToken: string
  ): Promise<void> {
    const deletion = deleteSensitiveMessage(context);
    if (context.chat?.type !== "private") {
      const deleted = await deletion;
      await context.reply(
        context.t(deleted ? "token.groupDeleted" : "token.groupNotDeleted"),
        {
          reply_markup: privateChatKeyboard(context.t, botInfo.username),
        }
      );
      return;
    }
    if (!context.from) {
      await deletion;
      return;
    }
    const parsedToken = tokenCandidateSchema.safeParse(rawToken);
    if (!parsedToken.success) {
      await deletion;
      await context.reply(context.t("token.invalidCandidate"), {
        reply_markup: tokenGuideKeyboard(context.t),
      });
      return;
    }
    let valid: boolean;
    try {
      valid = await api.validateToken(parsedToken.data);
    } catch (error) {
      await deletion;
      await replyApiError(context, error, context.t("errors.tokenValidate"));
      return;
    }
    const deleted = await deletion;
    if (!deleted) {
      await context.reply(context.t("token.notDeleted"), {
        reply_markup: tokenGuideKeyboard(context.t),
      });
      return;
    }
    if (!valid) {
      await showScreen(
        context,
        tokenScreenMessage(context.t, "invalid"),
        tokenKeyboard(context.t, "invalid"),
        "reply"
      );
      return;
    }
    try {
      await tokenStore.set(context.from.id, parsedToken.data);
    } catch (error) {
      await replyStorageError(context, error, context.t("errors.tokenSave"));
      return;
    }
    await showScreen(
      context,
      tokenSavedMessage(context.t),
      homeKeyboard(context.t, true),
      "reply"
    );
  }

  input.handle("token", acceptToken);

  bot.command("settoken", async (context) => {
    const token = context.match.trim();
    if (token) {
      await acceptToken(context, token);
      return;
    }
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    await input.prompt(context, "token");
  });

  bot.command("cleartoken", async (context) => {
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    await showScreen(
      context,
      tokenDeleteConfirmationMessage(context.t),
      tokenDeleteKeyboard(context.t),
      "reply"
    );
  });

  bot.command("status", async (context) => {
    if (!(await privateCommandOnly(context, botInfo.username))) {
      return;
    }
    const stored = await readStoredToken(context, tokenStore);
    if (!stored.token) {
      await showTokenScreen(context, tokenStore, "reply", stored.state);
      return;
    }
    let valid: boolean;
    try {
      valid = await api.validateToken(stored.token);
    } catch (error) {
      await replyApiError(context, error, context.t("errors.tokenCheck"));
      return;
    }
    await showTokenScreen(
      context,
      tokenStore,
      "reply",
      valid ? "valid" : "invalid"
    );
  });

  bot.callbackQuery("menu:token", async (context) => {
    const acknowledged = acknowledge(context);
    await showTokenScreen(context, tokenStore, "edit");
    await acknowledged;
  });

  bot.callbackQuery("token:guide", async (context) => {
    const acknowledged = acknowledge(context);
    await showScreen(
      context,
      tokenGuideMessage(context.t),
      tokenGuideKeyboard(context.t),
      "edit"
    );
    await acknowledged;
  });

  bot.callbackQuery("token:add", async (context) => {
    const acknowledged = acknowledge(context);
    await input.prompt(context, "token");
    await acknowledged;
  });

  bot.callbackQuery("token:check", async (context) => {
    const acknowledged = acknowledge(context);
    const stored = await readStoredToken(context, tokenStore);
    if (!stored.token) {
      await showTokenScreen(context, tokenStore, "edit", stored.state);
      await acknowledged;
      return;
    }
    let valid: boolean;
    try {
      valid = await api.validateToken(stored.token);
    } catch (error) {
      await replyApiError(context, error, context.t("errors.tokenCheck"));
      await acknowledged;
      return;
    }
    await showTokenScreen(
      context,
      tokenStore,
      "edit",
      valid ? "valid" : "invalid"
    );
    await acknowledged;
  });

  bot.callbackQuery("token:delete:confirm", async (context) => {
    const acknowledged = acknowledge(context);
    await showScreen(
      context,
      tokenDeleteConfirmationMessage(context.t),
      tokenDeleteKeyboard(context.t),
      "edit"
    );
    await acknowledged;
  });

  bot.callbackQuery("token:delete", async (context) => {
    const acknowledged = acknowledge(context);
    try {
      await tokenStore.delete(context.from.id);
    } catch (error) {
      await replyStorageError(context, error, context.t("errors.tokenDelete"));
      await acknowledged;
      return;
    }
    await showTokenScreen(context, tokenStore, "edit", "missing");
    await acknowledged;
  });
}
