import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { createWebhook } from "../src/index.ts";
import { TelegramFake } from "./helpers/telegram.ts";
import { testEnv } from "./setup.ts";

function commandRequest(
  command: string,
  secret = testEnv.WEBHOOK_SECRET
): Request<unknown, IncomingRequestCfProperties> {
  return new Request("https://worker.test/", {
    body: JSON.stringify({
      message: {
        chat: { first_name: "Test", id: 42, type: "private" },
        date: 1,
        entities: [{ length: command.length, offset: 0, type: "bot_command" }],
        from: { first_name: "Test", id: 42, is_bot: false },
        message_id: 1,
        text: command,
      },
      update_id: 1,
    }),
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    method: "POST",
  }) as unknown as Request<unknown, IncomingRequestCfProperties>;
}

beforeEach(async () => {
  await testEnv.DB.exec(
    "DELETE FROM user_tokens; DELETE FROM user_favorites; DELETE FROM user_preferences;"
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Worker webhook", () => {
  it("validates secrets, caches the app and keeps failures at the boundary", async () => {
    const telegram = new TelegramFake();
    vi.stubGlobal("fetch", telegram.fetch);

    const webhook = await createWebhook(testEnv);
    const unauthorized = await webhook(commandRequest("/start", "wrong"));
    expect(unauthorized.status).toBe(401);

    const authorized = await webhook(commandRequest("/start"));
    expect(authorized.status).toBe(200);
    expect(telegram.last("sendMessage")).toBeDefined();

    await expect(
      worker.fetch(commandRequest("/help"), testEnv)
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      worker.fetch(commandRequest("/start"), testEnv)
    ).resolves.toMatchObject({ status: 200 });

    const rotatedEnvironment = {
      ...testEnv,
      WEBHOOK_SECRET: "rotated_webhook_secret_1234567890_ab",
    };
    await expect(
      worker.fetch(
        commandRequest("/help", rotatedEnvironment.WEBHOOK_SECRET),
        rotatedEnvironment
      )
    ).resolves.toMatchObject({ status: 200 });

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    telegram.failures.add("sendMessage");
    const failed = await worker.fetch(commandRequest("/start"), testEnv);
    expect(failed.status).toBe(500);
    expect(log).toHaveBeenCalledWith(
      "Telegram API request failed",
      expect.objectContaining({ code: 400 })
    );
  });
});
