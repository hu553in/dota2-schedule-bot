import { BotError, GrammyError, HttpError } from "grammy";
import { isHTTPError } from "ky";

import { errorMessage } from "../error-message.ts";
import type { BotContext } from "./context.ts";
import { backHomeKeyboard, tokenKeyboard } from "./keyboards.ts";

export async function replyApiError(
  context: BotContext,
  error: unknown,
  fallbackMessage: string
): Promise<void> {
  if (isHTTPError(error)) {
    const { status } = error.response;
    if (status === 401 || status === 403) {
      await context.reply(context.t("errors.pandaScoreToken"), {
        reply_markup: tokenKeyboard(context.t, "invalid"),
      });
      return;
    }
    if (status === 429) {
      await context.reply(context.t("errors.pandaScoreRateLimit"), {
        reply_markup: backHomeKeyboard(context.t),
      });
      return;
    }
    console.error("PandaScore request failed", {
      message: error.message,
      status,
    });
  } else {
    console.error("PandaScore response failed", {
      message: errorMessage(error),
    });
  }
  await context.reply(fallbackMessage, {
    reply_markup: backHomeKeyboard(context.t),
  });
}

export function logWebhookError(error: unknown): void {
  if (!(error instanceof BotError)) {
    console.error("Webhook failed", {
      message: errorMessage(error),
    });
    return;
  }

  const metadata = {
    chatId: error.ctx.chat?.id,
    updateId: error.ctx.update.update_id,
    userId: error.ctx.from?.id,
  };
  if (error.error instanceof GrammyError) {
    console.error("Telegram API request failed", {
      ...metadata,
      code: error.error.error_code,
      message: error.error.description,
    });
    return;
  }
  if (error.error instanceof HttpError) {
    console.error("Telegram connection failed", {
      ...metadata,
      message: errorMessage(error.error.error),
    });
    return;
  }
  console.error("Bot middleware failed", {
    ...metadata,
    message: errorMessage(error.error),
  });
}
