import type { Update, UserFromGetMe } from "grammy/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityType, MatchDirection } from "../src/api/pandascore.ts";
import type { Match } from "../src/api/schemas.ts";
import {
  type BotApi,
  type BotFavoritesStore,
  type BotPreferencesStore,
  type BotTokenStore,
  createBot,
} from "../src/bot/create-bot.ts";
import type { Page } from "../src/pagination.ts";
import type { Favorite } from "../src/storage/favorites-store.ts";
import type { UserPreferences } from "../src/storage/preferences-store.ts";
import { TokenIntegrityError } from "../src/storage/token-store.ts";
import { TelegramFake } from "./helpers/telegram.ts";

const USER = {
  first_name: "Test",
  id: 42,
  is_bot: false,
  language_code: "ru-RU",
} as const;
const PRIVATE_CHAT = { first_name: "Test", id: 42, type: "private" } as const;
const GROUP_CHAT = { id: -100, title: "Group", type: "supergroup" } as const;
const BOT_INFO = {
  allows_users_to_create_topics: false,
  can_connect_to_business: false,
  can_join_groups: true,
  can_manage_bots: false,
  can_read_all_group_messages: false,
  first_name: "Test Bot",
  has_main_web_app: false,
  has_topics_enabled: false,
  id: 123_456_789,
  is_bot: true,
  supports_inline_queries: false,
  supports_join_request_queries: false,
  username: "test_bot",
} satisfies UserFromGetMe;
const TEAM = { acronym: "TS", id: 7, name: "Team Spirit" };
const SERIES = {
  full_name: "2026",
  id: 10_728,
  league: { name: "Esports World Cup" },
};
const MATCH: Match = {
  begin_at: null,
  draw: false,
  match_type: "best_of",
  number_of_games: 3,
  opponents: [],
  results: [],
  scheduled_at: "2026-07-13T10:00:00Z",
  status: "not_started",
  streams_list: [],
  tournament: null,
};
const VALID_TOKEN = "valid_PandaScore_token_123456789";
const HREF_PATTERN = /href="([^"]+)"/;

let updateId = 0;

function inputPrompt(mode: "series" | "team" | "timezone" | "token"): string {
  return `<a href="http://t.me/#input%3A${mode}#">‌</a>`;
}

function commandUpdate(
  text: string,
  options: {
    from?: boolean;
    languageCode?: string;
    private?: boolean;
  } = {}
): Update {
  updateId += 1;
  const command = text.split(" ")[0] ?? text;
  return {
    message: {
      chat: options.private === false ? GROUP_CHAT : PRIVATE_CHAT,
      date: 1,
      entities: [{ length: command.length, offset: 0, type: "bot_command" }],
      ...(options.from === false
        ? {}
        : {
            from: {
              ...USER,
              language_code: options.languageCode ?? USER.language_code,
            },
          }),
      message_id: updateId,
      text,
    },
    update_id: updateId,
  } as Update;
}

function textUpdate(
  text: string,
  options: {
    from?: boolean;
    private?: boolean;
    replyText?: string;
    replyingBotId?: number;
  } = {}
): Update {
  updateId += 1;
  const chat = options.private === false ? GROUP_CHAT : PRIVATE_CHAT;
  return {
    message: {
      chat,
      date: 1,
      ...(options.from === false ? {} : { from: USER }),
      message_id: updateId,
      ...(options.replyText
        ? {
            reply_to_message: {
              chat,
              date: 1,
              entities: [
                {
                  length: 1,
                  offset: 0,
                  type: "text_link",
                  url:
                    HREF_PATTERN.exec(options.replyText)?.[1] ??
                    "http://t.me/#unrelated#",
                },
              ],
              from: {
                first_name: "Bot",
                id: options.replyingBotId ?? BOT_INFO.id,
                is_bot: true,
              },
              message_id: 99,
              text: options.replyText,
            },
          }
        : {}),
      text,
    },
    update_id: updateId,
  } as Update;
}

function callbackUpdate(
  data: string,
  messageText = "Главное меню",
  privateChat = true,
  from = true
): Update {
  updateId += 1;
  const chat = privateChat ? PRIVATE_CHAT : GROUP_CHAT;
  return {
    callback_query: {
      chat_instance: "instance",
      data,
      ...(from ? { from: USER } : {}),
      id: `callback-${updateId}`,
      message: {
        chat,
        date: 1,
        from: BOT_INFO,
        message_id: 77,
        text: messageText,
      },
    },
    update_id: updateId,
  } as Update;
}

function matchPage(page = 1): Page<Match> {
  return { data: [MATCH], hasNext: page < 2, page };
}

function createDependencies() {
  const api = {
    getMatches: vi.fn(
      async (
        _type: EntityType,
        _id: number,
        _direction: MatchDirection,
        page: number
      ) => matchPage(page)
    ),
    getSeries: vi.fn(async () => SERIES),
    getTeam: vi.fn(async () => TEAM),
    searchSeries: vi.fn(
      async (): Promise<Page<typeof SERIES>> => ({
        data: [SERIES],
        hasNext: false,
        page: 1,
        total: 1,
        totalPages: 1,
      })
    ),
    searchTeams: vi.fn(
      async (): Promise<Page<typeof TEAM>> => ({
        data: [TEAM],
        hasNext: false,
        page: 1,
        total: 1,
        totalPages: 1,
      })
    ),
    validateToken: vi.fn(async () => true),
  } satisfies BotApi;
  const tokenStore = {
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => "stored-pandascore-token" as null | string),
    set: vi.fn(async () => undefined),
  } satisfies BotTokenStore;
  const preferencesStore = {
    get: vi.fn(
      async (): Promise<UserPreferences> => ({
        language: null,
        utcOffsetMinutes: null,
      })
    ),
    setLanguage: vi.fn(async () => undefined),
    setUtcOffset: vi.fn(async () => undefined),
  } satisfies BotPreferencesStore;
  const favoritesStore = {
    has: vi.fn(async () => false),
    list: vi.fn(
      async (): Promise<Page<Favorite>> => ({
        data: [],
        hasNext: false,
        page: 1,
        total: 0,
        totalPages: 1,
      })
    ),
    set: vi.fn(async () => undefined),
  } satisfies BotFavoritesStore;
  const telegram = new TelegramFake();
  const bot = createBot({
    api,
    botInfo: BOT_INFO,
    botToken: "123456789:test_bot_token_12345678901234567890",
    favoritesStore,
    preferencesStore,
    telegramFetch: telegram.fetch,
    tokenStore,
  });
  return {
    api,
    bot,
    favoritesStore,
    preferencesStore,
    telegram,
    tokenStore,
  };
}

function encoded(value: unknown): string {
  return JSON.stringify(value);
}

describe("createBot", () => {
  beforeEach(() => {
    updateId = 0;
  });

  it("shows token-aware onboarding and a recovery path for corrupt storage", async () => {
    const { bot, telegram, tokenStore } = createDependencies();
    await bot.init();

    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(commandUpdate("/start"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "бесплатный личный токен"
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("token:add");
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("menu:favorites");
    expect(
      telegram.required("sendMessage").payload.link_preview_options
    ).toEqual({ is_disabled: true });

    await bot.handleUpdate(commandUpdate("/start"));
    const homeNavigation = encoded(
      telegram.required("sendMessage").payload.reply_markup
    );
    expect(homeNavigation).toContain("menu:settings");
    expect(homeNavigation).toContain("menu:favorites");
    expect(homeNavigation.indexOf("menu:favorites")).toBeLessThan(
      homeNavigation.indexOf("menu:settings")
    );
    expect(homeNavigation).not.toContain("menu:timezone");
    expect(homeNavigation).not.toContain("menu:token");

    await bot.handleUpdate(callbackUpdate("menu:settings"));
    const settings = telegram.required("editMessageText").payload;
    expect(settings.text).toContain("⚙️ Настройки");
    expect(encoded(settings.reply_markup)).toContain("menu:timezone");
    expect(encoded(settings.reply_markup)).toContain("menu:language");
    expect(encoded(settings.reply_markup)).toContain("menu:token");
    expect(encoded(settings.reply_markup)).not.toContain("menu:favorites");
    expect(settings.link_preview_options).toEqual({ is_disabled: true });

    tokenStore.get.mockRejectedValueOnce(new TokenIntegrityError());
    await bot.handleUpdate(commandUpdate("/status"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "повреждён"
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("token:delete:confirm");

    tokenStore.get.mockRejectedValueOnce(new TokenIntegrityError());
    await bot.handleUpdate(textUpdate("unexpected"));
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("token:delete:confirm");
  });

  it("uses device language by default and persists an explicit choice", async () => {
    const { bot, preferencesStore, telegram } = createDependencies();
    await bot.init();

    await bot.handleUpdate(commandUpdate("/start", { languageCode: "de-DE" }));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Dota 2 schedule"
    );

    await bot.handleUpdate(callbackUpdate("menu:language"));
    const automatic = telegram.required("editMessageText").payload;
    expect(automatic.text).toContain("языку устройства");
    expect(encoded(automatic.reply_markup)).toContain("language:en");
    expect(encoded(automatic.reply_markup)).toContain("language:ru");

    await bot.handleUpdate(callbackUpdate("language:en"));
    expect(preferencesStore.setLanguage).toHaveBeenCalledWith(42, "en");
    expect(telegram.required("editMessageText").payload.text).toContain(
      "Selected manually"
    );

    telegram.networkFailures.add("editMessageText");
    await expect(
      bot.handleUpdate(callbackUpdate("language:en"))
    ).rejects.toThrow();
    expect(preferencesStore.setLanguage).toHaveBeenLastCalledWith(42, "en");
    telegram.networkFailures.delete("editMessageText");

    preferencesStore.get.mockResolvedValueOnce({
      language: "en",
      utcOffsetMinutes: null,
    });
    await bot.handleUpdate(commandUpdate("/start"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Where should we start?"
    );

    preferencesStore.setLanguage.mockRejectedValueOnce(
      new Error("D1 unavailable")
    );
    await bot.handleUpdate(callbackUpdate("language:ru"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Не удалось сохранить язык"
    );

    preferencesStore.get.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(callbackUpdate("menu:language"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Не удалось открыть настройку языка"
    );
  });

  it("deletes token-bearing messages before saving and never echoes secrets", async () => {
    const { api, bot, telegram, tokenStore } = createDependencies();
    await bot.init();
    let finishValidation: ((valid: boolean) => void) | undefined;
    api.validateToken.mockImplementationOnce(
      async () =>
        await new Promise<boolean>((resolve) => {
          finishValidation = resolve;
        })
    );

    const handling = bot.handleUpdate(
      commandUpdate(`/settoken ${VALID_TOKEN}`)
    );
    await vi.waitFor(() => {
      expect(telegram.last("deleteMessage")).toBeDefined();
    });
    expect(tokenStore.set).not.toHaveBeenCalled();
    if (!finishValidation) {
      throw new Error("Token validation did not start");
    }
    finishValidation(true);
    await handling;

    expect(tokenStore.set).toHaveBeenCalledWith(42, VALID_TOKEN);
    expect(encoded(telegram.calls)).not.toContain(VALID_TOKEN);
    expect(telegram.required("sendMessage").payload.text).toContain(
      "токен подключён"
    );
  });

  it("retries token saving safely after the secret message was already deleted", async () => {
    const { bot, telegram, tokenStore } = createDependencies();
    await bot.init();
    const update = commandUpdate(`/settoken ${VALID_TOKEN}`);

    telegram.networkFailures.add("sendMessage");
    await expect(bot.handleUpdate(update)).rejects.toThrow();
    expect(tokenStore.set).toHaveBeenCalledOnce();

    telegram.networkFailures.delete("sendMessage");
    telegram.failures.add("deleteMessage");
    telegram.failureDescriptions.set(
      "deleteMessage",
      "Bad Request: message to delete not found"
    );
    await bot.handleUpdate(update);

    expect(tokenStore.set).toHaveBeenCalledTimes(2);
    expect(telegram.required("sendMessage").payload.text).toContain(
      "токен подключён"
    );
    expect(telegram.required("sendMessage").payload.text).not.toContain(
      "не стал его сохранять"
    );
  });

  it("does not store exposed, malformed or rejected tokens", async () => {
    const { api, bot, telegram, tokenStore } = createDependencies();
    await bot.init();

    telegram.failures.add("deleteMessage");
    await bot.handleUpdate(commandUpdate(`/settoken ${VALID_TOKEN}`));
    expect(tokenStore.set).not.toHaveBeenCalled();
    expect(telegram.required("sendMessage").payload.text).toContain(
      "не стал его сохранять"
    );

    await bot.handleUpdate(
      commandUpdate(`/settoken ${VALID_TOKEN}`, { private: false })
    );
    expect(telegram.required("sendMessage").payload.text).toContain(
      "не смог удалить"
    );

    telegram.failures.delete("deleteMessage");
    const validationsBeforeGroupReply = api.validateToken.mock.calls.length;
    await bot.handleUpdate(
      textUpdate(VALID_TOKEN, {
        private: false,
        replyText: inputPrompt("token"),
      })
    );
    expect(api.validateToken).toHaveBeenCalledTimes(
      validationsBeforeGroupReply
    );
    expect(telegram.required("sendMessage").payload.text).toContain(
      "только в личном чате"
    );

    await bot.handleUpdate(commandUpdate("/settoken short"));
    expect(api.validateToken).toHaveBeenCalledTimes(1);

    api.validateToken.mockResolvedValueOnce(false);
    await bot.handleUpdate(commandUpdate(`/settoken ${VALID_TOKEN}`));
    expect(tokenStore.set).not.toHaveBeenCalled();

    api.validateToken.mockClear();
    await bot.handleUpdate(
      commandUpdate(`/settoken ${VALID_TOKEN}`, { private: false })
    );
    expect(api.validateToken).not.toHaveBeenCalled();
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("https://t.me/test_bot");
  });

  it("uses self-explanatory ForceReply search and canonical result buttons", async () => {
    const { api, bot, telegram } = createDependencies();
    await bot.init();

    await bot.handleUpdate(callbackUpdate("menu:team"));
    const prompt = telegram.required("sendMessage").payload;
    expect(prompt.text).toContain(inputPrompt("team"));
    expect(prompt.reply_markup).toMatchObject({ force_reply: true });

    await bot.handleUpdate(
      textUpdate("  Team   Spirit ", { replyText: inputPrompt("team") })
    );
    expect(api.searchTeams).toHaveBeenCalledWith(
      "Team Spirit",
      1,
      6,
      "stored-pandascore-token"
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("matches:team:7:upcoming:1");

    await bot.handleUpdate(
      textUpdate("Esports World Cup 2026", {
        replyText: inputPrompt("series"),
      })
    );
    expect(api.searchSeries).toHaveBeenCalledWith(
      "Esports World Cup 2026",
      1,
      6,
      "stored-pandascore-token"
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("Esports World Cup · 2026");

    api.searchTeams.mockResolvedValueOnce({
      data: [],
      hasNext: false,
      page: 1,
    });
    await bot.handleUpdate(
      textUpdate("Nobody", { replyText: inputPrompt("team") })
    );
    const empty = telegram.required("sendMessage").payload;
    expect(empty.text).toContain("Ничего не нашлось");
    expect(empty.reply_markup).toMatchObject({ force_reply: true });
    expect(encoded(empty.reply_markup)).not.toContain("menu:team");

    await bot.handleUpdate(
      textUpdate("Liquid", { replyText: String(empty.text) })
    );
    expect(api.searchTeams).toHaveBeenLastCalledWith(
      "Liquid",
      1,
      6,
      "stored-pandascore-token"
    );
  });

  it("stores a timezone fallback and renders match times with it", async () => {
    const { bot, preferencesStore, telegram } = createDependencies();
    await bot.init();

    await bot.handleUpdate(commandUpdate("/timezone"));
    const automatic = telegram.required("sendMessage").payload;
    expect(automatic.text).toContain("Автоматически через Telegram");
    expect(encoded(automatic.reply_markup)).toContain("timezone:change");
    expect(encoded(automatic.reply_markup)).not.toContain("timezone:auto");

    await bot.handleUpdate(callbackUpdate("menu:timezone"));
    expect(telegram.required("editMessageText").payload.text).toContain(
      "Автоматически через Telegram"
    );

    await bot.handleUpdate(callbackUpdate("timezone:change"));
    const prompt = telegram.required("sendMessage").payload;
    expect(prompt.text).toContain(inputPrompt("timezone"));
    expect(prompt.reply_markup).toMatchObject({ force_reply: true });

    await bot.handleUpdate(
      textUpdate("+6", { replyText: inputPrompt("timezone") })
    );
    expect(preferencesStore.setUtcOffset).toHaveBeenLastCalledWith(42, 360);
    expect(telegram.required("sendMessage").payload.text).toContain(
      "+06:00 · задан вручную"
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("timezone:auto");

    preferencesStore.get.mockResolvedValueOnce({
      language: null,
      utcOffsetMinutes: 360,
    });
    await bot.handleUpdate(
      callbackUpdate("matches:team:7:upcoming:1", "Результаты поиска")
    );
    const matchScreen = telegram.required("editMessageText").payload;
    expect(matchScreen.text).toContain("16:00 · +06:00");
    expect(matchScreen.text).not.toContain("UTC+06:00");
    expect(matchScreen.entities).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "date_time" })])
    );

    preferencesStore.get.mockResolvedValueOnce({
      language: null,
      utcOffsetMinutes: 360,
    });
    await bot.handleUpdate(callbackUpdate("menu:timezone"));
    expect(telegram.required("editMessageText").payload.text).toContain(
      "+06:00 · задан вручную"
    );

    await bot.handleUpdate(callbackUpdate("timezone:auto"));
    expect(preferencesStore.setUtcOffset).toHaveBeenLastCalledWith(42, null);
    expect(telegram.required("editMessageText").payload.text).toContain(
      "Автоматически через Telegram"
    );

    await bot.handleUpdate(
      textUpdate("wrong", { replyText: inputPrompt("timezone") })
    );
    expect(telegram.required("sendMessage").payload.reply_markup).toMatchObject(
      { force_reply: true }
    );

    await bot.handleUpdate(
      textUpdate("авто", { replyText: inputPrompt("timezone") })
    );
    expect(preferencesStore.setUtcOffset).toHaveBeenLastCalledWith(42, null);

    await bot.handleUpdate(
      textUpdate("+6", {
        from: false,
        replyText: inputPrompt("timezone"),
      })
    );
    await bot.handleUpdate(commandUpdate("/timezone", { from: false }));
    await bot.handleUpdate(
      callbackUpdate("timezone:auto", "Часовой пояс", true, false)
    );
    expect(preferencesStore.setUtcOffset).toHaveBeenCalledTimes(3);
  });

  it("paginates search results with the shared navigation", async () => {
    const { api, bot, telegram, tokenStore } = createDependencies();
    await bot.init();
    api.searchSeries
      .mockResolvedValueOnce({
        data: [SERIES],
        hasNext: true,
        page: 1,
        total: 7,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        data: [],
        hasNext: false,
        page: 2,
        total: 7,
        totalPages: 2,
      });

    await bot.handleUpdate(
      textUpdate("Esports World Cup", {
        replyText: inputPrompt("series"),
      })
    );
    const firstPage = telegram.required("sendMessage").payload;
    expect(firstPage.text).toContain("Страница 1 из 2");
    expect(encoded(firstPage.reply_markup)).toContain("search:series:2");

    await bot.handleUpdate(
      callbackUpdate("search:series:2", String(firstPage.text))
    );
    expect(api.searchSeries).toHaveBeenLastCalledWith(
      "Esports World Cup",
      2,
      6,
      "stored-pandascore-token"
    );
    const secondPage = telegram.required("editMessageText").payload;
    expect(secondPage.text).toContain("Страница 2 из 2");
    expect(secondPage.text).toContain("Вернись назад");
    expect(encoded(secondPage.reply_markup)).toContain("search:series:1");

    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(
      callbackUpdate("search:series:1", String(secondPage.text))
    );
    expect(api.searchSeries).toHaveBeenCalledTimes(2);
    expect(telegram.required("editMessageText").payload.text).toContain(
      "Токен PandaScore"
    );
  });

  it("loads only the active match direction and reuses the title on navigation", async () => {
    const { api, bot, favoritesStore, telegram } = createDependencies();
    await bot.init();

    await bot.handleUpdate(
      callbackUpdate("matches:team:7:upcoming:1", "Результаты поиска")
    );
    expect(api.getTeam).toHaveBeenCalledTimes(1);
    expect(api.getMatches).toHaveBeenLastCalledWith(
      "team",
      7,
      "upcoming",
      1,
      6,
      "stored-pandascore-token"
    );
    expect(favoritesStore.has).toHaveBeenCalledWith(42, "team", 7);
    const firstCard = telegram.required("editMessageText").payload;
    expect(firstCard.text).toContain("🎮 Team Spirit (TS)");
    expect(firstCard.entities).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "date_time" })])
    );

    await bot.handleUpdate(
      callbackUpdate("matches:team:7:running:1", String(firstCard.text ?? ""))
    );
    expect(api.getTeam).toHaveBeenCalledTimes(1);
    expect(api.getMatches).toHaveBeenCalledTimes(2);
    expect(api.getMatches).toHaveBeenLastCalledWith(
      "team",
      7,
      "running",
      1,
      6,
      "stored-pandascore-token"
    );
    const runningCard = telegram.required("editMessageText").payload;
    expect(runningCard.text).toContain("Идут сейчас");
    expect(encoded(runningCard.reply_markup)).toContain(
      "matches:team:7:past:1"
    );

    await bot.handleUpdate(
      callbackUpdate("matches:team:7:past:2", String(runningCard.text ?? ""))
    );
    expect(api.getTeam).toHaveBeenCalledTimes(1);
    expect(api.getMatches).toHaveBeenCalledTimes(3);
    expect(api.getMatches).toHaveBeenLastCalledWith(
      "team",
      7,
      "past",
      2,
      6,
      "stored-pandascore-token"
    );
  });

  it("acknowledges slow match callbacks before PandaScore finishes", async () => {
    const { api, bot, telegram } = createDependencies();
    await bot.init();
    let finishMatches: ((page: Page<Match>) => void) | undefined;
    api.getMatches.mockImplementationOnce(
      async () =>
        await new Promise<Page<Match>>((resolve) => {
          finishMatches = resolve;
        })
    );

    const handling = bot.handleUpdate(
      callbackUpdate("matches:team:7:upcoming:1", "Результаты поиска")
    );
    await vi.waitFor(() => {
      expect(telegram.last("answerCallbackQuery")).toBeDefined();
    });
    expect(telegram.last("editMessageText")).toBeUndefined();
    if (!finishMatches) {
      throw new Error("Match loading did not start");
    }
    finishMatches(matchPage());
    await handling;
    expect(telegram.last("editMessageText")).toBeDefined();
  });

  it("sets favorites idempotently without refetching PandaScore", async () => {
    const { api, bot, favoritesStore, telegram } = createDependencies();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await bot.init();

    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:7:upcoming:1:1:1",
        "🎮 Team Spirit (TS)\nБлижайшие матчи · страница 1"
      )
    );
    expect(favoritesStore.set).toHaveBeenCalledWith(
      42,
      {
        id: 7,
        name: "Team Spirit (TS)",
        type: "team",
      },
      true
    );
    expect(api.getMatches).not.toHaveBeenCalled();
    expect(api.getTeam).not.toHaveBeenCalled();
    expect(
      encoded(telegram.required("editMessageReplyMarkup").payload.reply_markup)
    ).toContain("Удалить из избранного");

    telegram.failures.add("editMessageReplyMarkup");
    telegram.failureDescriptions.set(
      "editMessageReplyMarkup",
      "Bad Request: message is not modified"
    );
    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:7:upcoming:1:1:1",
        "🎮 Team Spirit (TS)\nБлижайшие матчи · страница 1"
      )
    );
    expect(favoritesStore.set).toHaveBeenCalledTimes(2);

    telegram.failureDescriptions.set(
      "editMessageReplyMarkup",
      "Bad Request: message to edit not found"
    );
    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:7:upcoming:1:1:1",
        "🎮 Team Spirit (TS)\nБлижайшие матчи · страница 1"
      )
    );
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Team Spirit"
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("Удалить из избранного");

    telegram.failures.delete("editMessageReplyMarkup");
    telegram.networkFailures.add("editMessageReplyMarkup");
    const acknowledgementsBefore = telegram.all("answerCallbackQuery").length;
    await expect(
      bot.handleUpdate(
        callbackUpdate(
          "favorite:set:team:7:upcoming:1:1:1",
          "🎮 Team Spirit (TS)\nБлижайшие матчи · страница 1"
        )
      )
    ).rejects.toThrow();
    expect(favoritesStore.set).toHaveBeenCalledTimes(4);
    expect(telegram.all("answerCallbackQuery")).toHaveLength(
      acknowledgementsBefore
    );
  });

  it("opens paginated favorites directly from D1-backed data", async () => {
    const { bot, favoritesStore, telegram } = createDependencies();
    await bot.init();
    favoritesStore.list.mockResolvedValueOnce({
      data: [
        {
          createdAt: 1,
          id: 10_728,
          name: "Esports World Cup · 2026",
          type: "series",
        },
      ],
      hasNext: true,
      page: 1,
      total: 9,
      totalPages: 2,
    });

    await bot.handleUpdate(commandUpdate("/favorites"));
    expect(favoritesStore.list).toHaveBeenCalledWith(42, 1, 6);
    const message = telegram.required("sendMessage").payload;
    expect(message.text).toContain("Страница 1 из 2");
    expect(encoded(message.reply_markup)).toContain(
      "matches:series:10728:upcoming:1"
    );
  });

  it("keeps stale, foreign and group interactions safe", async () => {
    const { api, bot, telegram } = createDependencies();
    await bot.init();

    await bot.handleUpdate(callbackUpdate("matches:team:7:past:10001"));
    await bot.handleUpdate(callbackUpdate("matches:team:0:past:1"));
    await bot.handleUpdate(callbackUpdate("search:team:2", "Старый экран"));
    await bot.handleUpdate(callbackUpdate("unknown:callback"));
    expect(api.getMatches).not.toHaveBeenCalled();
    expect(telegram.required("answerCallbackQuery").payload.show_alert).toBe(
      true
    );

    await bot.handleUpdate(
      textUpdate("Spirit", {
        replyingBotId: 999,
        replyText: inputPrompt("team"),
      })
    );
    expect(api.searchTeams).not.toHaveBeenCalled();

    await bot.handleUpdate(callbackUpdate("menu:team", "menu", false));
    expect(telegram.required("answerCallbackQuery").payload.text).toContain(
      "личный чат"
    );

    const groupCallbacks = [
      "menu:main",
      "menu:help",
      "menu:settings",
      "menu:token",
      "token:guide",
      "token:add",
      "token:check",
      "token:delete:confirm",
      "token:delete",
      "menu:favorites",
      "menu:timezone",
      "menu:language",
      "language:en",
      "timezone:change",
      "timezone:auto",
      "favorites:2",
      "search:team:2",
      "matches:team:7:upcoming:1",
      "matches:team:7:running:1",
      "favorite:set:team:7:upcoming:1:0:1",
      "noop",
      "unknown:callback",
    ];
    const groupAnswersBefore = telegram.all("answerCallbackQuery").length;
    await Promise.all(
      groupCallbacks.map((callback) =>
        bot.handleUpdate(callbackUpdate(callback, "menu", false))
      )
    );
    const groupAnswers = telegram
      .all("answerCallbackQuery")
      .slice(groupAnswersBefore);
    expect(groupAnswers).toHaveLength(groupCallbacks.length);
    expect(
      groupAnswers.every((answer) =>
        answer.payload.text?.includes("личный чат")
      )
    ).toBe(true);

    await Promise.all(
      [
        "/start",
        "/favorites",
        "/timezone",
        "/settoken",
        "/cleartoken",
        "/status",
      ].map((command) =>
        bot.handleUpdate(commandUpdate(command, { private: false }))
      )
    );
    await bot.handleUpdate(commandUpdate("/start", { from: false }));
    await bot.handleUpdate(commandUpdate("/favorites", { from: false }));
  });

  it("keeps every command, menu and token-management exit discoverable", async () => {
    const { api, bot, favoritesStore, telegram, tokenStore } =
      createDependencies();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await bot.init();

    await bot.handleUpdate(commandUpdate("/help"));
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("token:guide");
    expect(
      telegram.required("sendMessage").payload.link_preview_options
    ).toEqual({ is_disabled: true });
    await bot.handleUpdate(commandUpdate("/settoken"));
    await bot.handleUpdate(commandUpdate("/cleartoken"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Удалить сохранённый токен"
    );

    api.validateToken.mockResolvedValueOnce(false);
    await bot.handleUpdate(commandUpdate("/status"));
    await bot.handleUpdate(commandUpdate("/status"));
    api.validateToken.mockRejectedValueOnce(
      new Error("PandaScore unavailable")
    );
    await bot.handleUpdate(commandUpdate("/status"));

    await Promise.all(
      [
        "menu:main",
        "menu:help",
        "menu:settings",
        "menu:token",
        "token:guide",
        "token:add",
        "token:delete:confirm",
        "menu:favorites",
        "favorites:2",
        "noop",
      ].map((callback) => bot.handleUpdate(callbackUpdate(callback)))
    );
    expect(favoritesStore.list).toHaveBeenCalledWith(42, 2, 6);

    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(callbackUpdate("token:check"));
    api.validateToken.mockResolvedValueOnce(false);
    await bot.handleUpdate(callbackUpdate("token:check"));
    api.validateToken.mockRejectedValueOnce(
      new Error("PandaScore unavailable")
    );
    await bot.handleUpdate(callbackUpdate("token:check"));
    await bot.handleUpdate(callbackUpdate("token:check"));
    expect(telegram.required("editMessageText").payload.text).toContain(
      "PandaScore принял токен"
    );

    await bot.handleUpdate(callbackUpdate("token:delete"));
    expect(tokenStore.delete).toHaveBeenCalledWith(42);
    tokenStore.delete.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(callbackUpdate("token:delete"));

    await bot.handleUpdate(callbackUpdate("favorites:10001"));
    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(commandUpdate("/unknown"));
    const unknownCommandKeyboard = encoded(
      telegram.required("sendMessage").payload.reply_markup
    );
    expect(unknownCommandKeyboard).toContain("token:add");
    expect(unknownCommandKeyboard).toContain("menu:favorites");
    expect(unknownCommandKeyboard).not.toContain("menu:team");
    await bot.handleUpdate(textUpdate("обычный текст"));
    await bot.handleUpdate(commandUpdate("/help", { private: false }));
    expect(log).toHaveBeenCalled();
  });

  it("recovers from storage, validation, search and favorite failures", async () => {
    const { api, bot, favoritesStore, preferencesStore, telegram, tokenStore } =
      createDependencies();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await bot.init();

    tokenStore.get.mockRejectedValueOnce("D1 unavailable");
    await bot.handleUpdate(commandUpdate("/start"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "не удалось прочитать"
    );

    favoritesStore.list.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(commandUpdate("/favorites"));
    favoritesStore.list
      .mockResolvedValueOnce({
        data: [],
        hasNext: false,
        page: 5,
        total: 0,
      })
      .mockResolvedValueOnce({
        data: [],
        hasNext: false,
        page: 1,
        total: 0,
        totalPages: 1,
      });
    await bot.handleUpdate(callbackUpdate("favorites:5"));
    expect(favoritesStore.list).toHaveBeenLastCalledWith(42, 1, 6);

    api.validateToken.mockRejectedValueOnce(new Error("network down"));
    await bot.handleUpdate(commandUpdate(`/settoken ${VALID_TOKEN}`));
    tokenStore.set.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(commandUpdate(`/settoken ${VALID_TOKEN}`));

    preferencesStore.get.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(commandUpdate("/timezone"));
    preferencesStore.setUtcOffset.mockRejectedValueOnce(
      new Error("D1 unavailable")
    );
    await bot.handleUpdate(
      textUpdate("+6", { replyText: inputPrompt("timezone") })
    );

    await bot.handleUpdate(
      commandUpdate(`/settoken ${VALID_TOKEN}`, { from: false })
    );
    await bot.handleUpdate(
      textUpdate(VALID_TOKEN, { replyText: inputPrompt("token") })
    );
    expect(tokenStore.set).toHaveBeenCalledWith(42, VALID_TOKEN);

    await bot.handleUpdate(textUpdate("x", { replyText: inputPrompt("team") }));
    expect(telegram.required("sendMessage").payload.reply_markup).toMatchObject(
      { force_reply: true }
    );
    await bot.handleUpdate(
      textUpdate("x".repeat(101), { replyText: inputPrompt("team") })
    );
    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(
      textUpdate("Spirit", { replyText: inputPrompt("team") })
    );
    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(callbackUpdate("menu:team"));
    api.searchTeams.mockRejectedValueOnce(new Error("network down"));
    await bot.handleUpdate(
      textUpdate("Spirit", { replyText: inputPrompt("team") })
    );
    await bot.handleUpdate(textUpdate("group text", { private: false }));
    await bot.handleUpdate(
      textUpdate("Spirit", {
        private: false,
        replyText: inputPrompt("team"),
      })
    );
    expect(
      encoded(telegram.required("sendMessage").payload.reply_markup)
    ).toContain("https://t.me/test_bot");
    const timezoneWrites = preferencesStore.setUtcOffset.mock.calls.length;
    await bot.handleUpdate(
      textUpdate("+6", {
        private: false,
        replyText: inputPrompt("timezone"),
      })
    );
    expect(preferencesStore.setUtcOffset).toHaveBeenCalledTimes(timezoneWrites);
    await bot.handleUpdate(commandUpdate("/unknown", { private: false }));
  });

  it("handles series, missing-token and failed match/favorite paths", async () => {
    const { api, bot, favoritesStore, preferencesStore, telegram, tokenStore } =
      createDependencies();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await bot.init();

    await bot.handleUpdate(
      callbackUpdate("matches:series:10728:upcoming:1", "Результаты поиска")
    );
    expect(api.getSeries).toHaveBeenCalledWith(
      10_728,
      "stored-pandascore-token"
    );

    tokenStore.get.mockResolvedValueOnce(null);
    await bot.handleUpdate(callbackUpdate("matches:team:7:upcoming:1"));

    favoritesStore.has.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(callbackUpdate("matches:team:7:upcoming:1"));
    expect(telegram.required("editMessageText").payload.text).toContain(
      "избранное сейчас недоступно"
    );
    expect(
      encoded(telegram.required("editMessageText").payload.reply_markup)
    ).not.toContain("favorite:set:");
    api.getMatches.mockRejectedValueOnce(new Error("PandaScore unavailable"));
    await bot.handleUpdate(callbackUpdate("matches:team:7:upcoming:1"));

    preferencesStore.get.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(callbackUpdate("matches:team:7:upcoming:1"));
    expect(telegram.required("editMessageText").payload.text).toContain(
      "автоматическая локализация времени Telegram"
    );

    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:7:upcoming:1:0:0",
        "🎮 Team Spirit\nБлижайшие матчи · страница 1"
      )
    );
    expect(telegram.required("answerCallbackQuery").payload.text).toContain(
      "Удалено"
    );

    favoritesStore.set.mockRejectedValueOnce(new Error("D1 unavailable"));
    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:7:past:1:0:1",
        "🎮 Team Spirit\nНедавние результаты · страница 1"
      )
    );
    await bot.handleUpdate(
      callbackUpdate("favorite:set:team:7:past:1:0:1", "Старый экран")
    );
    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:0:past:1:0:1",
        "🎮 Team Spirit\nНедавние результаты · страница 1"
      )
    );
    await bot.handleUpdate(
      callbackUpdate(
        "favorite:set:team:7:past:10001:0:1",
        "🎮 Team Spirit\nНедавние результаты · страница 1"
      )
    );
    expect(log).toHaveBeenCalled();
  });

  it("handles harmless Telegram edits and acknowledgement failures", async () => {
    const { bot, telegram } = createDependencies();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await bot.init();

    telegram.failures.add("editMessageText");
    telegram.failureDescriptions.set(
      "editMessageText",
      "Bad Request: message is not modified"
    );
    await bot.handleUpdate(callbackUpdate("menu:help"));

    telegram.failureDescriptions.set(
      "editMessageText",
      "Bad Request: message to edit not found"
    );
    await bot.handleUpdate(callbackUpdate("menu:help"));
    expect(telegram.last("sendMessage")).toBeDefined();

    telegram.failureDescriptions.set(
      "editMessageText",
      "Bad Request: message can't be edited"
    );
    await bot.handleUpdate(callbackUpdate("token:delete:confirm"));
    expect(telegram.required("sendMessage").payload.text).toContain(
      "Удалить сохранённый токен"
    );

    telegram.failures.delete("editMessageText");
    telegram.networkFailures.add("editMessageText");
    await expect(
      bot.handleUpdate(callbackUpdate("menu:help"))
    ).rejects.toThrow();
    telegram.networkFailures.delete("editMessageText");

    telegram.failures.add("answerCallbackQuery");
    await bot.handleUpdate(callbackUpdate("menu:main"));
    expect(log).toHaveBeenCalledWith(
      "Callback acknowledgement failed",
      expect.any(Object)
    );
  });
});
