import type { MessageEntity } from "grammy/types";
import { describe, expect, it, vi } from "vitest";
import type { BotContext } from "../src/bot/context.ts";
import { createInputRouter } from "../src/bot/input.ts";
import { getTranslator } from "../src/localization.ts";

const BOT_ID = 123;
const BOT = { id: BOT_ID, username: "test_bot" };
const QUESTION_ENTITY: MessageEntity = {
  length: 1,
  offset: 0,
  type: "text_link",
  url: "http://t.me/#input%3Ateam#",
};

function answerContext(text?: string, privateChat = true): BotContext {
  const reply = vi.fn(async () => ({ message_id: 2 }));
  const chat = privateChat
    ? ({ first_name: "Test", id: 42, type: "private" } as const)
    : ({ id: -42, title: "Group", type: "supergroup" } as const);
  return {
    chat,
    locale: "en",
    message: {
      chat,
      date: 1,
      from: { first_name: "Test", id: 42, is_bot: false },
      message_id: 2,
      reply_to_message: {
        chat,
        date: 1,
        entities: [QUESTION_ENTITY],
        from: { first_name: "Bot", id: BOT_ID, is_bot: true },
        message_id: 1,
        text: "Question",
      },
      ...(text === undefined ? { photo: [] } : { text }),
    },
    preferences: { language: null, utcOffsetMinutes: null },
    preferencesAvailable: true,
    reply,
    t: getTranslator("en"),
    update: { update_id: 1 },
  } as unknown as BotContext;
}

describe("stateless input router", () => {
  it("rejects duplicate handlers and missing registrations", async () => {
    const router = createInputRouter(BOT);
    const handler = vi.fn(async () => undefined);
    const context = answerContext("Spirit");
    await expect(router.middleware()(context, vi.fn())).rejects.toThrow(
      "No input handler registered for team"
    );
    router.handle("team", handler);
    expect(() => router.handle("team", handler)).toThrow(
      "Input handler already registered for team"
    );
    await router.middleware()(context, vi.fn());
    expect(handler).toHaveBeenCalledWith(context, "Spirit");
  });

  it("re-prompts for non-text answers and escapes custom prompt text", async () => {
    const router = createInputRouter(BOT);
    router.handle(
      "team",
      vi.fn(async () => undefined)
    );
    const context = answerContext();
    await router.middleware()(context, vi.fn());
    expect(context.reply).toHaveBeenCalledWith("Please reply with text.");
    expect(context.reply).toHaveBeenCalledWith(
      expect.stringContaining("Team search"),
      expect.objectContaining({ parse_mode: "HTML" })
    );

    await router.prompt(context, "team", "<search & reply>");
    expect(context.reply).toHaveBeenLastCalledWith(
      expect.stringContaining("&lt;search &amp; reply&gt;"),
      expect.objectContaining({ parse_mode: "HTML" })
    );

    const groupContext = answerContext(undefined, false);
    await router.middleware()(groupContext, vi.fn());
    expect(groupContext.reply).toHaveBeenCalledWith(
      expect.stringContaining("private chat"),
      expect.objectContaining({ reply_markup: expect.any(Object) })
    );
  });
});
