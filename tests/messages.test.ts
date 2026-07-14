import { describe, expect, it } from "vitest";
import { matchSchema } from "../src/api/schemas.ts";
import {
  backHomeKeyboard,
  favoritesKeyboard,
  helpKeyboard,
  homeKeyboard,
  languageKeyboard,
  matchesKeyboard,
  searchResultsKeyboard,
  settingsKeyboard,
  timezoneKeyboard,
  tokenDeleteKeyboard,
  tokenGuideKeyboard,
  tokenKeyboard,
} from "../src/bot/keyboards.ts";
import {
  buildDeploymentPrompt,
  buildMatchesMessage,
  emptySearchMessage,
  favoritesMessage,
  helpMessage,
  homeMessage,
  languageMessage,
  matchTitleFromMessage,
  searchResultsMessage,
  searchTermFromMessage,
  seriesDisplayName,
  settingsMessage,
  teamDisplayName,
  timezoneMessage,
  tokenDeleteConfirmationMessage,
  tokenGuideMessage,
  tokenSavedMessage,
  tokenScreenMessage,
} from "../src/bot/messages.ts";
import { getTranslator } from "../src/localization.ts";
import { MAX_PAGE } from "../src/pagination.ts";

const ru = getTranslator("ru");
const en = getTranslator("en");
const TEAM_A = { acronym: "TS", id: 1, name: "Team Spirit" };
const TEAM_B = { acronym: null, id: 2, name: "Liquid" };

function match(status: string, overrides: Record<string, unknown> = {}) {
  return matchSchema.parse({
    begin_at: "2026-07-13T10:00:00Z",
    draw: false,
    id: 1,
    league: { id: 8, name: "DreamLeague" },
    match_type: "best_of",
    number_of_games: 3,
    opponents: [{ opponent: TEAM_A }, { opponent: TEAM_B }],
    results: [
      { score: 2, team_id: 1 },
      { score: 1, team_id: 2 },
    ],
    scheduled_at: "2026-07-13T09:00:00Z",
    serie: { full_name: "Season 29 2026", id: 10, name: "Season 29" },
    status,
    streams_list: [],
    tournament: { id: 9, name: "Group Stage" },
    ...overrides,
  });
}

function keyboardRows(
  keyboard: unknown
): { callback_data?: string; style?: string; text: string }[][] {
  return (
    JSON.parse(JSON.stringify(keyboard)) as {
      inline_keyboard: {
        callback_data?: string;
        style?: string;
        text: string;
      }[][];
    }
  ).inline_keyboard;
}

function callbackData(keyboard: unknown): string[] {
  return keyboardRows(keyboard)
    .flat()
    .flatMap((button) =>
      button.callback_data === undefined ? [] : [button.callback_data]
    );
}

function labels(keyboard: unknown): string[][] {
  return keyboardRows(keyboard).map((row) => row.map((button) => button.text));
}

describe("bot messages", () => {
  it("builds localized labels for teams and whole tournament series", () => {
    expect(teamDisplayName(TEAM_A, ru)).toBe("Team Spirit (TS)");
    expect(teamDisplayName({ ...TEAM_A, acronym: "team spirit" }, ru)).toBe(
      "Team Spirit"
    );
    expect(teamDisplayName(TEAM_B, en)).toBe("Liquid");
    expect(teamDisplayName({ acronym: null, id: 3, name: "   " }, ru)).toBe(
      "Команда без названия"
    );
    const series = {
      full_name: "2026",
      id: 5,
      league: { name: "PGL" },
    };
    expect(seriesDisplayName(series, en)).toBe("PGL · 2026");
    expect(
      seriesDisplayName(
        { ...series, full_name: " ", league: { name: " " } },
        en
      )
    ).toBe("Unnamed tournament");
  });

  it("prevents Telegram from turning provider names into automatic links", () => {
    const message = buildMatchesMessage(
      en,
      "en",
      "Virtus.pro",
      "team",
      "upcoming",
      {
        data: [
          match("not_started", {
            opponents: [
              {
                opponent: {
                  acronym: "VP",
                  id: 3,
                  name: "Virtus.pro",
                },
              },
              { opponent: TEAM_B },
            ],
          }),
        ],
        hasNext: false,
        page: 1,
      }
    );
    expect(message.text).toContain("Virtus.\u2060pro");
    expect(message.text).not.toContain("Virtus.pro");
    expect(matchTitleFromMessage(message.text)).toBe("Virtus.pro");

    const search = searchResultsMessage(en, "team", "virtus.pro", {
      data: [{}],
      hasNext: false,
      page: 1,
    });
    expect(search.text).toContain("virtus.\u2060pro");
    expect(searchTermFromMessage(search.text)).toBe("virtus.pro");
  });

  it("renders every match state, localized details and native date entities", () => {
    const upcoming = buildMatchesMessage(
      ru,
      "ru",
      "Team Spirit",
      "team",
      "upcoming",
      { data: [match("not_started")], hasNext: true, page: 2 }
    );
    expect(upcoming.text).toContain("Ближайшие матчи · Страница 2");
    expect(upcoming.text).toContain("Team Spirit (TS) — Liquid");
    expect(upcoming.text).toContain("Турнир: DreamLeague · Season 29 2026");
    expect(upcoming.text).toContain("Стадия: Group Stage");
    expect(upcoming.entities).toContainEqual(
      expect.objectContaining({ type: "date_time" })
    );
    expect(matchTitleFromMessage(upcoming.text)).toBe("Team Spirit");
    expect(matchTitleFromMessage("Old screen")).toBeNull();
    expect(matchTitleFromMessage("🎮   ")).toBeNull();

    const series = buildMatchesMessage(
      en,
      "en",
      "DreamLeague · Season 29 2026",
      "series",
      "upcoming",
      { data: [match("not_started")], hasNext: false, page: 1 }
    );
    expect(series.text).toContain("Upcoming matches · Page 1");
    expect(series.text).not.toContain("Tournament: DreamLeague");
    expect(series.text).toContain("Stage: Group Stage");

    const finished = buildMatchesMessage(
      ru,
      "ru",
      "Team Spirit",
      "team",
      "past",
      {
        data: [match("finished")],
        hasNext: false,
        page: 1,
      }
    );
    expect(finished.text).toContain("2️⃣ : 1️⃣");
    expect(finished.text).toContain("2026-07-13 10:00 UTC");

    const running = buildMatchesMessage(
      ru,
      "ru",
      "Team Spirit",
      "team",
      "running",
      { data: [match("running")], hasNext: false, page: 1 }
    );
    expect(running.text).toContain("Идут сейчас · Страница 1");
    expect(running.text).toContain("🔴 Team Spirit (TS)  2️⃣ : 1️⃣  Liquid");

    const fixedOffset = buildMatchesMessage(
      en,
      "en",
      "Team Spirit",
      "team",
      "upcoming",
      { data: [match("not_started")], hasNext: false, page: 1 },
      360,
      "Favorites are temporarily unavailable."
    );
    expect(fixedOffset.text).toContain("15:00 · +06:00");
    expect(fixedOffset.text).not.toContain("UTC+06:00");
    expect(fixedOffset.text).toContain(
      "⚠️ Favorites are temporarily unavailable."
    );
    expect(fixedOffset.entities).not.toContainEqual(
      expect.objectContaining({ type: "date_time" })
    );
  });

  it("does not invent participants, scores or dates", () => {
    expect(match("unexpected").status).toBe("unknown");
    const message = buildMatchesMessage(en, "en", "Unknown", "series", "past", {
      data: [
        match("finished", {
          begin_at: null,
          number_of_games: 0,
          opponents: [{ opponent: TEAM_A }, { opponent: null }],
          results: [{ score: 2 }, { score: 1 }],
          scheduled_at: null,
          tournament: null,
        }),
        match("not_started", {
          begin_at: null,
          id: 2,
          scheduled_at: "not-a-date",
        }),
        match("not_started", {
          begin_at: "2026-07-14T10:00:00Z",
          id: 3,
          match_type: "custom",
          number_of_games: 0,
          scheduled_at: null,
        }),
      ],
      hasNext: false,
      page: 1,
    });
    expect(message.text).toContain("Participant TBD");
    expect(message.text).toContain("❔ : ❔");
    expect(message.text).toContain("2026-07-14 10:00 UTC · Custom format");
    expect(message.text.match(/Time TBD/g)).toHaveLength(2);
  });

  it.each([
    ["canceled", "🚫", "Canceled"],
    ["postponed", "⏸", "Postponed"],
    ["unexpected", "❔", "Status unknown"],
  ])("renders the %s match status explicitly", (status, icon, label) => {
    const message = buildMatchesMessage(en, "en", "Status", "series", "past", {
      data: [match(status)],
      hasNext: false,
      page: 1,
    });
    expect(message.text).toContain(`${icon} Team Spirit (TS) — Liquid`);
    expect(message.text).toContain(label);
  });

  it("uses the current time for every match lifecycle state", () => {
    const message = buildMatchesMessage(en, "en", "Times", "series", "past", {
      data: [
        match("not_started", {
          begin_at: "2026-07-13T09:00:00Z",
          original_scheduled_at: "2026-07-13T08:00:00Z",
          rescheduled: true,
          scheduled_at: "2026-07-13T11:00:00Z",
        }),
        match("running", {
          begin_at: "2026-07-13T12:00:00Z",
          scheduled_at: "2026-07-13T11:00:00Z",
        }),
        match("finished", {
          begin_at: "2026-07-13T13:00:00Z",
          end_at: "2026-07-13T15:00:00Z",
          scheduled_at: "2026-07-13T12:00:00Z",
        }),
        match("postponed", {
          scheduled_at: "2026-07-13T14:00:00Z",
        }),
        match("canceled", {
          scheduled_at: "2026-07-13T16:00:00Z",
        }),
      ],
      hasNext: false,
      page: 1,
    });
    expect(message.text).toContain("2026-07-13 11:00 UTC");
    expect(message.text).toContain("2026-07-13 12:00 UTC");
    expect(message.text).toContain("2026-07-13 13:00 UTC");
    expect(message.text).not.toContain("2026-07-13 15:00 UTC");
    expect(message.text).not.toContain("2026-07-13 16:00 UTC");
    expect(message.text.match(/Time TBD/g)).toHaveLength(2);
  });

  it.each([
    ["best_of", "BO3"],
    ["first_to", "FT3"],
    ["all_games_played", "3 games"],
    ["custom", "Custom format · 3 games"],
    ["ow_best_of", "OW BO3"],
    ["red_bull_home_ground", "RBHG BO3"],
    ["future_format", "3 games"],
  ])("renders the %s match format correctly", (matchType, expected) => {
    const message = buildMatchesMessage(
      en,
      "en",
      "Format",
      "series",
      "upcoming",
      {
        data: [match("not_started", { match_type: matchType })],
        hasNext: false,
        page: 1,
      }
    );
    expect(message.text).toContain(expected);
  });

  it("labels a finished draw", () => {
    const draw = buildMatchesMessage(en, "en", "Draw", "series", "past", {
      data: [match("finished", { draw: true })],
      hasNext: false,
      page: 1,
    });
    expect(draw.text).toContain("✅ Team Spirit (TS)  2️⃣ : 1️⃣  Liquid");
    expect(draw.text).toContain("Draw");
  });

  it("links and ranks broadcasts only for upcoming and live matches", () => {
    const streams = [
      {
        language: "en",
        main: false,
        official: true,
        raw_url: "https://kick.com/official-en",
      },
      {
        language: "ru",
        main: false,
        official: false,
        raw_url: "https://kick.com/community-ru",
      },
      {
        language: "ru",
        main: true,
        official: true,
        raw_url: "https://www.twitch.tv/main-ru",
      },
    ];
    const upcoming = buildMatchesMessage(
      en,
      "en",
      "Streams",
      "series",
      "upcoming",
      {
        data: [match("not_started", { streams_list: streams })],
        hasNext: false,
        page: 1,
      }
    );
    expect(upcoming.text).toContain(
      "Twitch (RU main), Kick (EN official), Kick (RU unofficial)"
    );
    expect(
      upcoming.entities.flatMap((entity) =>
        entity.type === "text_link" ? [entity.url] : []
      )
    ).toEqual([
      "https://www.twitch.tv/main-ru",
      "https://kick.com/official-en",
      "https://kick.com/community-ru",
    ]);

    const russian = buildMatchesMessage(
      ru,
      "ru",
      "Трансляции",
      "series",
      "upcoming",
      {
        data: [match("not_started", { streams_list: streams })],
        hasNext: false,
        page: 1,
      }
    );
    expect(russian.text).toContain(
      "Twitch (RU основной), Kick (EN официальный), Kick (RU неофициальный)"
    );

    const past = buildMatchesMessage(en, "en", "Streams", "series", "past", {
      data: [match("finished", { streams_list: streams })],
      hasNext: false,
      page: 1,
    });
    expect(past.text).not.toContain("main");
    expect(past.entities).not.toContainEqual(
      expect.objectContaining({ type: "text_link" })
    );
  });

  it("keeps the best duplicate broadcast and labels unknown providers", () => {
    const duplicateUrl = "https://www.twitch.tv/main-ru";
    const message = buildMatchesMessage(
      en,
      "en",
      "Streams",
      "series",
      "upcoming",
      {
        data: [
          match("not_started", {
            streams_list: [
              {
                language: "ru",
                main: false,
                official: false,
                raw_url: duplicateUrl,
              },
              {
                language: "ru",
                main: true,
                official: true,
                raw_url: duplicateUrl,
              },
              {
                language: "   ",
                main: false,
                official: true,
                raw_url: "https://stream.example.org/live",
              },
            ],
          }),
        ],
        hasNext: false,
        page: 1,
      }
    );

    expect(message.text).toContain(
      "Twitch (RU main), stream.example.org (official)"
    );
    expect(message.text.match(/Twitch/g)).toHaveLength(1);
  });

  it("renders all empty, pagination and reusable search branches", () => {
    for (const [direction, expected] of [
      ["upcoming", "Запланированных матчей пока нет"],
      ["past", "Завершённых матчей пока нет"],
      ["running", "Сейчас матчей нет"],
    ] as const) {
      expect(
        buildMatchesMessage(ru, "ru", "Empty", "team", direction, {
          data: [],
          hasNext: false,
          page: 1,
        }).text
      ).toContain(expected);
    }
    expect(
      buildMatchesMessage(ru, "ru", "Empty", "team", "past", {
        data: [],
        hasNext: true,
        page: 2,
      }).text
    ).toContain("Перейди дальше");

    const search = searchResultsMessage(ru, "team", "Spirit", {
      data: [{}],
      hasNext: true,
      page: 1,
      totalPages: 2,
    });
    expect(search.text).toContain("Результаты поиска команд");
    expect(search.text).toContain("Страница 1 из 2");
    expect(searchTermFromMessage(search.text)).toBe("Spirit");
    const emptyPage = searchResultsMessage(en, "series", "EWC", {
      data: [],
      hasNext: false,
      page: 2,
    });
    expect(emptyPage.text).toContain("Go back");
    expect(searchTermFromMessage("Old screen")).toBeNull();
    expect(emptySearchMessage(en, "series").text).toContain(
      "shorter tournament name"
    );
  });

  it("caps provider text and builds complete localized guidance", () => {
    const huge = "Very long provider name ".repeat(100);
    const message = buildMatchesMessage(en, "en", huge, "team", "past", {
      data: Array.from({ length: 6 }, (_, index) =>
        match("finished", {
          id: index + 1,
          opponents: [
            { opponent: { acronym: huge, id: 1, name: huge } },
            { opponent: { acronym: huge, id: 2, name: huge } },
          ],
          tournament: { id: index + 1, name: huge },
        })
      ),
      hasNext: false,
      page: 1,
    });
    expect(message.text.length).toBeLessThanOrEqual(4096);
    const truncated = buildMatchesMessage(
      en,
      "en",
      "Streams",
      "team",
      "upcoming",
      {
        data: [
          match("not_started", {
            streams_list: Array.from({ length: 200 }, (_, index) => ({
              language: "en",
              main: false,
              official: true,
              raw_url: `https://stream-${index}.example.org/live`,
            })),
          }),
        ],
        hasNext: false,
        page: 1,
      }
    );
    expect(truncated.text.length).toBeLessThanOrEqual(4096);
    expect(truncated.text.endsWith("…")).toBe(true);
    expect(buildDeploymentPrompt("Kazakh")).toContain(
      "step-by-step instructions in Kazakh"
    );

    const guide = tokenGuideMessage(ru);
    expect(guide.text).toContain("1000 HTTP-запросов в час");
    expect(guide.text).toContain("Cloudflare Workers");
    expect(guide.text).not.toContain("Отдельный большой гайд");
    const links = guide.entities.flatMap((entity) =>
      entity.type === "text_link" ? [entity.url] : []
    );
    expect(links).toContain("https://app.pandascore.co/signup");
    expect(links).toContain("https://app.pandascore.co/dashboard/main");
    expect(links).toContain("https://github.com/hu553in/dota2-schedule-bot");
    for (const origin of ["https://chatgpt.com", "https://claude.ai"]) {
      const link = links.find((url) => url?.startsWith(origin));
      const prompt = new URL(link ?? origin).searchParams.get("q");
      expect(prompt).toContain("step-by-step instructions in Russian");
      expect(prompt).toContain("Cloudflare Workers and D1");
      expect(link?.length).toBeLessThan(2048);
    }
  });

  it("localizes every static screen in both languages", () => {
    expect(homeMessage(ru, false).text).toContain("бесплатный личный токен");
    expect(homeMessage(en, true).text).toContain("favorites");
    expect(helpMessage(en).text).toContain("fully open source");
    expect(helpMessage(en).text).toContain("only finished matches");
    expect(helpMessage(en).text).toContain("Settings → PandaScore token");
    expect(settingsMessage(ru).text).toContain("настроить язык");
    expect(languageMessage(en, "en", false).text).toContain("device language");
    expect(languageMessage(ru, "ru", true).text).toContain(
      "ручном смещении UTC"
    );
    expect(timezoneMessage(ru, 360).text).toContain("+06:00 · задан вручную");
    expect(timezoneMessage(en, null).text).toContain("Automatic via Telegram");
    expect(
      favoritesMessage(ru, {
        data: [],
        hasNext: false,
        page: 1,
        total: 0,
        totalPages: 1,
      }).text
    ).toContain("☆ Добавить в избранное");
    expect(
      favoritesMessage(en, {
        data: [],
        hasNext: false,
        page: 2,
        total: 1,
      }).text
    ).toContain("Page 2");
    expect(tokenScreenMessage(en, "valid").text).toContain("accepted");
    expect(tokenDeleteConfirmationMessage(en).text).toContain(
      "Delete the saved PandaScore token"
    );
    expect(tokenSavedMessage(ru).text).toContain("токен подключён");
  });
});

describe("bot keyboards", () => {
  it("uses the requested menu hierarchy in both locales", () => {
    expect(labels(homeKeyboard(ru, true)).slice(0, 3)).toEqual([
      ["🔎 Найти команду", "🏆 Найти турнир"],
      ["⭐ Избранное"],
      ["⚙️ Настройки", "❓ Помощь"],
    ]);
    expect(callbackData(homeKeyboard(en, false))).toContain("token:add");
    expect(callbackData(homeKeyboard(en, false))).toContain("menu:favorites");
    expect(labels(settingsKeyboard(ru))).toEqual([
      ["🌐 Язык"],
      ["🕐 Часовой пояс"],
      ["🔐 Токен PandaScore"],
      ["🏠 Главное меню"],
    ]);
    expect(callbackData(settingsKeyboard(en))).not.toContain("menu:favorites");
    expect(callbackData(helpKeyboard(en))).toEqual([
      "token:guide",
      "menu:main",
    ]);
    expect(callbackData(backHomeKeyboard(ru))).toContain("menu:favorites");
  });

  it("builds every token, time zone and language submenu", () => {
    for (const state of [
      "missing",
      "unavailable",
      "corrupt",
      "connected",
      "invalid",
      "valid",
    ] as const) {
      const data = callbackData(tokenKeyboard(ru, state));
      expect(data).toContain("menu:settings");
      expect(data).toContain("menu:main");
      expect(data).not.toContain("menu:favorites");
    }
    expect(JSON.stringify(tokenDeleteKeyboard(en))).toContain(
      '"style":"danger"'
    );
    expect(callbackData(tokenGuideKeyboard(en))).toContain("token:add");
    expect(callbackData(timezoneKeyboard(en, true))).not.toContain(
      "timezone:auto"
    );
    expect(callbackData(timezoneKeyboard(en, false))).toContain(
      "timezone:auto"
    );
    expect(keyboardRows(languageKeyboard(en, "en"))[0]?.[0]?.style).toBe(
      "primary"
    );
    expect(keyboardRows(languageKeyboard(ru, "ru"))[0]?.[1]?.style).toBe(
      "primary"
    );
  });

  it("shares pagination and navigation across search and favorites", () => {
    const search = searchResultsKeyboard(
      en,
      [
        {
          id: 1,
          name: "A very long team name that must be safely shortened for Telegram buttons",
        },
      ],
      "team",
      { hasNext: true, page: 2 }
    );
    expect(callbackData(search)).toEqual(
      expect.arrayContaining([
        "matches:team:1:running:1",
        "search:team:1",
        "search:team:3",
        "menu:settings",
        "menu:favorites",
      ])
    );
    expect(JSON.stringify(search)).toContain("…");
    const favorites = favoritesKeyboard(en, {
      data: [
        {
          createdAt: 1,
          id: 10_728,
          name: "Esports World Cup · 2026",
          type: "series",
        },
        {
          createdAt: 2,
          id: 7,
          name: "Team Spirit",
          type: "team",
        },
      ],
      hasNext: true,
      page: 2,
      total: 20,
      totalPages: 3,
    });
    expect(callbackData(favorites)).toEqual(
      expect.arrayContaining([
        "matches:series:10728:running:1",
        "favorites:1",
        "favorites:3",
        "menu:main",
      ])
    );
    expect(callbackData(favorites)).not.toContain("menu:settings");
    expect(keyboardRows(favorites)[0]?.[0]?.style).toBe("primary");
    expect(labels(favorites)[1]).toEqual(["👥 Team Spirit"]);

    const lastPage = searchResultsKeyboard(en, [], "series", {
      hasNext: true,
      page: 10_000,
    });
    expect(callbackData(lastPage)).not.toContain("search:series:10001");
    expect(callbackData(lastPage)).toContain("search:series:9999");
  });

  it("keeps live on its own row and encodes match state", () => {
    const keyboard = matchesKeyboard(ru, {
      direction: "upcoming",
      hasNext: true,
      id: 7,
      isFavorite: false,
      page: 2,
      type: "team",
    });
    expect(labels(keyboard)[0]).toEqual(["🔴 Сейчас"]);
    expect(labels(keyboard)[1]).toEqual(["📅 Ближайшие", "✅ Результаты"]);
    expect(callbackData(keyboard)).toEqual(
      expect.arrayContaining([
        "matches:team:7:upcoming:1",
        "matches:team:7:upcoming:3",
        "matches:team:7:running:1",
        "matches:team:7:past:1",
        "favorite:set:team:7:upcoming:2:1:1",
        "menu:favorites",
      ])
    );
    expect(callbackData(keyboard)).not.toContain("menu:settings");
    expect(
      keyboardRows(keyboard)
        .flat()
        .find((button) => button.callback_data?.startsWith("favorite:set:"))
        ?.style
    ).toBe("primary");
    const favoriteKeyboard = matchesKeyboard(en, {
      direction: "running",
      hasNext: false,
      id: 8,
      isFavorite: true,
      page: 1,
      type: "series",
    });
    expect(callbackData(favoriteKeyboard)).toContain(
      "favorite:set:series:8:running:1:0:0"
    );
    expect(
      keyboardRows(favoriteKeyboard)
        .flat()
        .find((button) => button.callback_data?.startsWith("favorite:set:"))
        ?.style
    ).toBeUndefined();
    expect(
      callbackData(
        matchesKeyboard(en, {
          direction: "past",
          hasNext: false,
          id: 9,
          isFavorite: null,
          page: 1,
          type: "team",
        })
      ).some((callback) => callback.startsWith("favorite:set:"))
    ).toBe(false);
  });

  it("keeps dynamic callback data within Telegram's byte limit", () => {
    const id = Number.MAX_SAFE_INTEGER;
    const keyboards = [
      searchResultsKeyboard(en, [{ id, name: "Team" }], "team", {
        hasNext: true,
        page: MAX_PAGE,
      }),
      matchesKeyboard(en, {
        direction: "upcoming",
        hasNext: true,
        id,
        isFavorite: false,
        page: MAX_PAGE,
        type: "series",
      }),
      favoritesKeyboard(en, {
        data: [{ createdAt: 1, id, name: "Tournament", type: "series" }],
        hasNext: true,
        page: MAX_PAGE,
      }),
    ];
    for (const keyboard of keyboards) {
      for (const data of callbackData(keyboard)) {
        expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      }
    }
  });
});
