import { describe, expect, it, vi } from "vitest";
import { type BotContext, localizationMiddleware } from "../src/bot/context.ts";

describe("localization middleware", () => {
  it("uses English without a Telegram user and skips D1", async () => {
    const preferencesStore = {
      get: vi.fn(),
      setLanguage: vi.fn(),
      setUtcOffset: vi.fn(),
    };
    const middleware = localizationMiddleware(preferencesStore);
    const context = {} as BotContext;
    const next = vi.fn(async () => undefined);
    await middleware(context, next);
    expect(preferencesStore.get).not.toHaveBeenCalled();
    expect(context.locale).toBe("en");
    expect(context.preferencesAvailable).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it("falls back safely when D1 rejects with a non-Error value", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const middleware = localizationMiddleware({
      get: vi.fn().mockRejectedValue("database unavailable"),
      setLanguage: vi.fn(),
      setUtcOffset: vi.fn(),
    });
    const context = {
      from: {
        first_name: "Test",
        id: 42,
        is_bot: false,
        language_code: "ru-RU",
      },
    } as BotContext;
    await middleware(
      context,
      vi.fn(async () => undefined)
    );
    expect(context.locale).toBe("ru");
    expect(context.preferencesAvailable).toBe(false);
    expect(log).toHaveBeenCalledWith("Preferences storage read failed", {
      message: "database unavailable",
    });
  });
});
