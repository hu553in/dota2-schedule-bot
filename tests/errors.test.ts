import { BotError, type Context, GrammyError, HttpError } from "grammy";
import { describe, expect, it, vi } from "vitest";
import { PandaScoreApi } from "../src/api/pandascore.ts";
import type { BotContext } from "../src/bot/context.ts";
import { logWebhookError, replyApiError } from "../src/bot/errors.ts";
import { getTranslator } from "../src/localization.ts";

function botContext(reply: ReturnType<typeof vi.fn>): BotContext {
  return {
    locale: "ru",
    preferences: { language: null, utcOffsetMinutes: null },
    preferencesAvailable: true,
    reply,
    t: getTranslator("ru"),
  } as unknown as BotContext;
}

async function httpError(status: number): Promise<unknown> {
  const api = new PandaScoreApi({
    baseUrl: "https://pandascore.test/",
    fetch: async () => Response.json({}, { status }),
  });
  try {
    await api.getTeam(1, "token");
  } catch (error) {
    return error;
  }
  throw new Error("Expected PandaScore request to fail");
}

describe("replyApiError", () => {
  it.each([401, 403])("explains rejected tokens (%s)", async (status) => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await replyApiError(botContext(reply), await httpError(status), "fallback");
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining("Замени"),
      expect.objectContaining({ reply_markup: expect.anything() })
    );
  });

  it("explains PandaScore rate limits", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await replyApiError(botContext(reply), await httpError(429), "fallback");
    expect(reply).toHaveBeenCalledWith(
      expect.stringContaining("Лимит"),
      expect.objectContaining({ reply_markup: expect.anything() })
    );
  });

  it("logs sanitized HTTP failures and uses the fallback", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await replyApiError(botContext(reply), await httpError(500), "fallback");
    expect(error).toHaveBeenCalledWith(
      "PandaScore request failed",
      expect.objectContaining({ status: 500 })
    );
    expect(reply).toHaveBeenCalledWith(
      "fallback",
      expect.objectContaining({ reply_markup: expect.anything() })
    );
  });

  it("logs non-HTTP failures and uses the fallback", async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await replyApiError(
      botContext(reply),
      new Error("invalid payload"),
      "fallback"
    );
    expect(error).toHaveBeenCalledWith(
      "PandaScore response failed",
      expect.objectContaining({ message: "invalid payload" })
    );
    expect(reply).toHaveBeenCalledWith(
      "fallback",
      expect.objectContaining({ reply_markup: expect.anything() })
    );
  });
});

describe("logWebhookError", () => {
  const context = {
    chat: { id: 1 },
    from: { id: 2 },
    update: { update_id: 3 },
  } as unknown as Context;

  it("logs errors outside grammY without dumping request objects", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logWebhookError(new Error("startup failed"));
    logWebhookError("unknown failure");
    expect(log).toHaveBeenCalledWith("Webhook failed", {
      message: "startup failed",
    });
    expect(log).toHaveBeenCalledWith("Webhook failed", {
      message: "unknown failure",
    });
  });

  it("logs sanitized Telegram API errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const telegramError = new GrammyError(
      "bad request",
      {
        description: "bad request",
        error_code: 400,
        ok: false,
      },
      "sendMessage",
      {}
    );
    logWebhookError(new BotError(telegramError, context));
    expect(log).toHaveBeenCalledWith(
      "Telegram API request failed",
      expect.objectContaining({ code: 400, updateId: 3 })
    );
  });

  it("logs sanitized Telegram connection errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logWebhookError(
      new BotError(
        new HttpError("offline", new Error("socket closed")),
        context
      )
    );
    logWebhookError(new BotError(new HttpError("offline", "network"), context));
    expect(log).toHaveBeenCalledWith(
      "Telegram connection failed",
      expect.objectContaining({ message: "socket closed" })
    );
    expect(log).toHaveBeenCalledWith(
      "Telegram connection failed",
      expect.objectContaining({ message: "network" })
    );
  });

  it("logs sanitized middleware errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logWebhookError(new BotError(new Error("database down"), context));
    logWebhookError(new BotError("unknown", context));
    expect(log).toHaveBeenCalledWith(
      "Bot middleware failed",
      expect.objectContaining({ message: "database down" })
    );
    expect(log).toHaveBeenCalledWith(
      "Bot middleware failed",
      expect.objectContaining({ message: "unknown" })
    );
  });
});
