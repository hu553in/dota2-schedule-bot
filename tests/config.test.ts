import { describe, expect, it } from "vitest";

import { parseConfig } from "../src/config.ts";

const VALID_ENV = {
  BOT_NAME: "Dota 2 schedule bot",
  BOT_TOKEN: "123456789:telegram_bot_token_123456789012345",
  BOT_USERNAME: "d2_schedule_bot",
  DB: {} as D1Database,
  PS_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  TELEGRAM_PREMIUM: "false",
  WEBHOOK_SECRET: "webhook_secret_1234567890_abcdefgh",
} as const;

describe(parseConfig, () => {
  it("returns validated Worker bindings", () => {
    const config = parseConfig(VALID_ENV);
    expect(config.botInfo).toStrictEqual({
      allows_users_to_create_topics: false,
      can_connect_to_business: false,
      can_join_groups: true,
      can_manage_bots: false,
      can_read_all_group_messages: false,
      first_name: "Dota 2 schedule bot",
      has_main_web_app: false,
      has_topics_enabled: false,
      id: 123_456_789,
      is_bot: true,
      supports_inline_queries: false,
      supports_join_request_queries: false,
      username: "d2_schedule_bot",
    });
    expect(config.botToken).toBe(VALID_ENV.BOT_TOKEN);
    expect(config.masterKey).toStrictEqual(new Uint8Array(32));
    expect(config.telegramPremium).toBeFalsy();
    expect(config.webhookSecret).toBe(VALID_ENV.WEBHOOK_SECRET);
  });

  it("defaults Premium support to off and accepts an explicit opt-in", () => {
    expect(
      parseConfig({
        ...VALID_ENV,
        TELEGRAM_PREMIUM: undefined,
      }).telegramPremium
    ).toBeFalsy();
    expect(
      parseConfig({
        ...VALID_ENV,
        TELEGRAM_PREMIUM: "true",
      }).telegramPremium
    ).toBeTruthy();
  });

  it.each([
    [{ ...VALID_ENV, BOT_TOKEN: "not-a-token" }, "BOT_TOKEN"],
    [
      { ...VALID_ENV, BOT_TOKEN: "0:telegram_bot_token_123456789012345" },
      "BOT_TOKEN",
    ],
    [
      {
        ...VALID_ENV,
        BOT_TOKEN: "9007199254740992:telegram_bot_token_123456789012345",
      },
      "BOT_TOKEN",
    ],
    [{ ...VALID_ENV, BOT_USERNAME: "not valid" }, "BOT_USERNAME"],
    [{ ...VALID_ENV, PS_MASTER_KEY: "not-base64" }, "PS_MASTER_KEY"],
    [
      { ...VALID_ENV, PS_MASTER_KEY: "c2hvcnQ=" },
      "PS_MASTER_KEY must be base64-encoded 32 random bytes",
    ],
    [
      { ...VALID_ENV, TELEGRAM_PREMIUM: "yes" },
      "TELEGRAM_PREMIUM must be true or false",
    ],
    [{ ...VALID_ENV, WEBHOOK_SECRET: "short" }, "WEBHOOK_SECRET"],
    [{ ...VALID_ENV, WEBHOOK_SECRET: `${"a".repeat(31)}!` }, "WEBHOOK_SECRET"],
  ])("rejects invalid configuration %#", (environment, message) => {
    expect(() => parseConfig(environment)).toThrow(message);
  });
});
