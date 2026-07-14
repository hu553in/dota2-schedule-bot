import type { FormattedString } from "@grammyjs/parse-mode";
import { GrammyError, type InlineKeyboard } from "grammy";
import { errorMessage } from "../error-message.ts";
import type { Translate } from "../localization.ts";
import { TokenIntegrityError } from "../storage/token-store.ts";
import type { BotContext } from "./context.ts";
import type { BotTokenStore } from "./dependencies.ts";
import {
  backHomeKeyboard,
  homeKeyboard,
  privateChatKeyboard,
  tokenKeyboard,
} from "./keyboards.ts";
import {
  homeMessage,
  type TokenScreenState,
  tokenScreenMessage,
} from "./messages.ts";

export type ScreenMode = "edit" | "reply";

export interface StoredToken {
  state: TokenScreenState;
  token: null | string;
}

export function storedTokenKeyboard(
  t: Translate,
  stored: StoredToken
): InlineKeyboard {
  return stored.state === "corrupt" || stored.state === "unavailable"
    ? tokenKeyboard(t, stored.state)
    : homeKeyboard(t, stored.token !== null);
}

function isHarmlessEditError(error: unknown): boolean {
  if (!(error instanceof GrammyError)) {
    return false;
  }
  const description = error.description.toLowerCase();
  return (
    description.includes("message is not modified") ||
    description.includes("message to edit not found") ||
    description.includes("message can't be edited")
  );
}

function requiresReplacementMessage(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    !error.description.toLowerCase().includes("not modified")
  );
}

function isAlreadyDeletedError(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.description.toLowerCase().includes("message to delete not found")
  );
}

export async function showScreen(
  context: BotContext,
  message: FormattedString,
  keyboard: InlineKeyboard,
  mode: ScreenMode
): Promise<void> {
  const options = {
    entities: message.entities,
    reply_markup: keyboard,
  };
  if (mode === "reply") {
    await context.reply(message.text, options);
    return;
  }
  try {
    await context.editMessageText(message.text, options);
  } catch (error) {
    if (!isHarmlessEditError(error)) {
      throw error;
    }
    if (requiresReplacementMessage(error)) {
      await context.reply(message.text, options);
    }
  }
}

export async function editKeyboard(
  context: BotContext,
  keyboard: InlineKeyboard
): Promise<void> {
  try {
    await context.editMessageReplyMarkup({ reply_markup: keyboard });
  } catch (error) {
    if (!isHarmlessEditError(error)) {
      throw error;
    }
    const { message } = context.callbackQuery ?? {};
    if (requiresReplacementMessage(error) && message && "text" in message) {
      await context.reply(message.text, {
        ...(message.entities ? { entities: message.entities } : {}),
        reply_markup: keyboard,
      });
    }
  }
}

export function acknowledge(context: BotContext): Promise<void> {
  return context
    .answerCallbackQuery()
    .then(() => undefined)
    .catch((error) => {
      console.error("Callback acknowledgement failed", {
        message: errorMessage(error),
      });
    });
}

export async function answerCallbackAlert(
  context: BotContext,
  text: string
): Promise<void> {
  await context.answerCallbackQuery({ show_alert: true, text });
}

export async function readStoredToken(
  context: BotContext,
  tokenStore: BotTokenStore
): Promise<StoredToken> {
  if (!context.from) {
    return { state: "missing", token: null };
  }
  try {
    const token = await tokenStore.get(context.from.id);
    return token
      ? { state: "connected", token }
      : { state: "missing", token: null };
  } catch (error) {
    if (error instanceof TokenIntegrityError) {
      return { state: "corrupt", token: null };
    }
    console.error("Token storage read failed", {
      message: errorMessage(error),
    });
    return { state: "unavailable", token: null };
  }
}

export async function showTokenScreen(
  context: BotContext,
  tokenStore: BotTokenStore,
  mode: ScreenMode,
  knownState?: TokenScreenState
): Promise<void> {
  const state =
    knownState ?? (await readStoredToken(context, tokenStore)).state;
  await showScreen(
    context,
    tokenScreenMessage(context.t, state),
    tokenKeyboard(context.t, state),
    mode
  );
}

export async function showHome(
  context: BotContext,
  tokenStore: BotTokenStore,
  mode: ScreenMode
): Promise<void> {
  const stored = await readStoredToken(context, tokenStore);
  if (stored.state === "corrupt" || stored.state === "unavailable") {
    await showTokenScreen(context, tokenStore, mode, stored.state);
    return;
  }
  const hasToken = stored.token !== null;
  await showScreen(
    context,
    homeMessage(context.t, hasToken),
    storedTokenKeyboard(context.t, stored),
    mode
  );
}

export async function requireToken(
  context: BotContext,
  tokenStore: BotTokenStore,
  mode: ScreenMode
): Promise<null | string> {
  const stored = await readStoredToken(context, tokenStore);
  if (stored.token) {
    return stored.token;
  }
  await showTokenScreen(context, tokenStore, mode, stored.state);
  return null;
}

export async function privateCommandOnly(
  context: BotContext,
  username: string
): Promise<boolean> {
  if (context.chat?.type === "private") {
    return true;
  }
  await context.reply(context.t("privateChat.command"), {
    reply_markup: privateChatKeyboard(context.t, username),
  });
  return false;
}

export async function privateCallbackOnly(
  context: BotContext
): Promise<boolean> {
  if (context.chat?.type === "private") {
    return true;
  }
  await answerCallbackAlert(context, context.t("privateChat.callback"));
  return false;
}

export async function deleteSensitiveMessage(
  context: BotContext
): Promise<boolean> {
  try {
    await context.deleteMessage();
    return true;
  } catch (error) {
    if (isAlreadyDeletedError(error)) {
      return true;
    }
    console.error("Sensitive Telegram message could not be deleted");
    return false;
  }
}

export async function replyStorageError(
  context: BotContext,
  error: unknown,
  message: string
): Promise<void> {
  console.error("D1 request failed", { message: errorMessage(error) });
  await context.reply(message, {
    reply_markup: backHomeKeyboard(context.t),
  });
}
