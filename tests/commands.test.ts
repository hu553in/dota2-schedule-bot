import { describe, expect, it, vi } from "vitest";
import {
  botCommands,
  configureBotCommands,
  configureBotWebhook,
} from "../src/bot/commands.ts";

describe("Telegram commands", () => {
  it("provides complete English and Russian descriptions", () => {
    const english = botCommands("en");
    const russian = botCommands("ru");
    expect(english.map(({ command }) => command)).toEqual(
      russian.map(({ command }) => command)
    );
    expect(english).toContainEqual({
      command: "start",
      description: "Open the main menu",
    });
    expect(russian).toContainEqual({
      command: "start",
      description: "Открыть главное меню",
    });
    expect(
      [...english, ...russian].every(
        ({ command, description }) =>
          command.length <= 32 &&
          description.length > 0 &&
          description.length <= 256
      )
    ).toBe(true);
  });

  it("configures default English and Telegram's Russian locale", async () => {
    const setMyCommands = vi.fn(async () => true as const);
    await configureBotCommands({ setMyCommands } as never);
    expect(setMyCommands).toHaveBeenCalledTimes(2);
    expect(setMyCommands).toHaveBeenNthCalledWith(1, botCommands("en"));
    expect(setMyCommands).toHaveBeenNthCalledWith(2, botCommands("ru"), {
      language_code: "ru",
    });
  });

  it("configures and verifies the production webhook", async () => {
    const setWebhook = vi.fn(async () => true as const);
    const getWebhookInfo = vi.fn(async () => ({
      has_custom_certificate: false,
      pending_update_count: 0,
      url: "https://bot.example.workers.dev/",
    }));

    await configureBotWebhook(
      { getWebhookInfo, setWebhook } as never,
      "https://bot.example.workers.dev",
      "webhook_secret_1234567890_abcdefgh"
    );

    expect(setWebhook).toHaveBeenCalledWith("https://bot.example.workers.dev", {
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
      secret_token: "webhook_secret_1234567890_abcdefgh",
    });
    expect(getWebhookInfo).toHaveBeenCalledOnce();
  });

  it("rejects a webhook URL that Telegram did not keep", async () => {
    const setWebhook = vi.fn(async () => true as const);
    const getWebhookInfo = vi.fn(async () => ({
      has_custom_certificate: false,
      pending_update_count: 0,
      url: "https://another-worker.example.workers.dev",
    }));

    await expect(
      configureBotWebhook(
        { getWebhookInfo, setWebhook } as never,
        "https://bot.example.workers.dev",
        "webhook_secret_1234567890_abcdefgh"
      )
    ).rejects.toThrow("Telegram returned an unexpected webhook URL");
  });

  it("reports when Telegram has no webhook URL", async () => {
    const setWebhook = vi.fn(async () => true as const);
    const getWebhookInfo = vi.fn(async () => ({
      has_custom_certificate: false,
      pending_update_count: 0,
      url: undefined,
    }));

    await expect(
      configureBotWebhook(
        { getWebhookInfo, setWebhook } as never,
        "https://bot.example.workers.dev",
        "webhook_secret_1234567890_abcdefgh"
      )
    ).rejects.toThrow("Telegram returned an unexpected webhook URL: none");
  });
});
