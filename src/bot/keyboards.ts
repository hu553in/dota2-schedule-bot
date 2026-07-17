import { InlineKeyboard } from "grammy";

import type { EntityType, MatchDirection } from "../api/pandascore.ts";
import type { Locale, Translate } from "../localization.ts";
import { MAX_PAGE } from "../pagination.ts";
import type { Page } from "../pagination.ts";
import type { Favorite } from "../storage/favorites-store.ts";
import { truncateText } from "../text.ts";
import type { TokenScreenState } from "./messages.ts";

const BUTTON_TEXT_LIMIT = 52;
const DEFAULT_MATCH_DIRECTION: MatchDirection = "running";

export interface MatchNavigation {
  direction: MatchDirection;
  hasNext: boolean;
  id: number;
  isFavorite: boolean | null;
  page: number;
  type: EntityType;
}

export interface SearchResult {
  id: number;
  name: string;
}

interface Pagination {
  hasNext: boolean;
  page: number;
}

function matchesCallback(
  type: EntityType,
  id: number,
  direction: MatchDirection,
  page: number
): string {
  return `matches:${type}:${id}:${direction}:${page}`;
}

function addPagination(
  t: Translate,
  keyboard: InlineKeyboard,
  pagination: Pagination,
  callback: (page: number) => string
): void {
  const hasNext = pagination.hasNext && pagination.page < MAX_PAGE;
  if (pagination.page > 1) {
    keyboard.text(t("buttons.back"), callback(pagination.page - 1));
  }
  if (hasNext) {
    keyboard.text(t("buttons.next"), callback(pagination.page + 1));
  }
  if (pagination.page > 1 || hasNext) {
    keyboard.row();
  }
}

function addMainSections(
  t: Translate,
  keyboard: InlineKeyboard
): InlineKeyboard {
  return keyboard
    .text(t("buttons.settings"), "menu:settings")
    .text(t("buttons.favorites"), "menu:favorites")
    .row();
}

function addSettingsNavigation(
  t: Translate,
  keyboard: InlineKeyboard
): InlineKeyboard {
  return keyboard
    .text(t("buttons.settings"), "menu:settings")
    .text(t("buttons.mainMenu"), "menu:main");
}

export function homeKeyboard(t: Translate, hasToken: boolean): InlineKeyboard {
  if (!hasToken) {
    return new InlineKeyboard()
      .text(t("buttons.connectToken"), "token:add")
      .primary()
      .row()
      .text(t("buttons.tokenGuide"), "token:guide")
      .row()
      .text(t("buttons.favorites"), "menu:favorites")
      .primary()
      .row()
      .text(t("buttons.settings"), "menu:settings")
      .text(t("buttons.help"), "menu:help");
  }
  return new InlineKeyboard()
    .text(t("buttons.searchTeam"), "menu:team")
    .primary()
    .text(t("buttons.searchSeries"), "menu:series")
    .primary()
    .row()
    .text(t("buttons.favorites"), "menu:favorites")
    .primary()
    .row()
    .text(t("buttons.settings"), "menu:settings")
    .text(t("buttons.help"), "menu:help");
}

export function backHomeKeyboard(t: Translate): InlineKeyboard {
  return addMainSections(t, new InlineKeyboard()).text(
    t("buttons.mainMenu"),
    "menu:main"
  );
}

export function helpKeyboard(t: Translate): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.tokenGuide"), "token:guide")
    .row()
    .text(t("buttons.mainMenu"), "menu:main");
}

export function privateChatKeyboard(
  t: Translate,
  username: string
): InlineKeyboard {
  return new InlineKeyboard().url(
    t("buttons.openPrivateChat"),
    `https://t.me/${username}`
  );
}

export function tokenKeyboard(
  t: Translate,
  state: TokenScreenState
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (state === "missing") {
    keyboard.text(t("buttons.enterToken"), "token:add").primary().row();
  } else if (state === "unavailable") {
    keyboard.text(t("buttons.retry"), "menu:token").primary().row();
  } else if (state === "corrupt") {
    keyboard.text(t("buttons.deleteCorruptToken"), "token:delete:confirm");
    keyboard.danger().row();
    keyboard.text(t("buttons.enterToken"), "token:add").primary().row();
  } else {
    keyboard
      .text(t("buttons.checkToken"), "token:check")
      .text(t("buttons.replaceToken"), "token:add")
      .row()
      .text(t("buttons.deleteToken"), "token:delete:confirm")
      .danger()
      .row()
      .text(t("buttons.tokenGuide"), "token:guide")
      .row();
    return addSettingsNavigation(t, keyboard);
  }
  keyboard.text(t("buttons.tokenGuide"), "token:guide").row();
  return addSettingsNavigation(t, keyboard);
}

export function tokenGuideKeyboard(t: Translate): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(t("buttons.enterToken"), "token:add")
    .primary()
    .row();
  return addSettingsNavigation(t, keyboard);
}

export function tokenDeleteKeyboard(t: Translate): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.yesDeleteToken"), "token:delete")
    .danger()
    .row()
    .text(t("buttons.cancel"), "menu:token");
}

export function timezoneKeyboard(
  t: Translate,
  isAutomatic: boolean
): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(t("buttons.timezoneChange"), "timezone:change")
    .primary()
    .row();
  if (!isAutomatic) {
    keyboard.text(t("buttons.timezoneAutomatic"), "timezone:auto").row();
  }
  return addSettingsNavigation(t, keyboard);
}

export function languageKeyboard(t: Translate, locale: Locale): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(
    t("buttons.languageEnglish"),
    "language:en"
  );
  if (locale === "en") {
    keyboard.primary();
  }
  keyboard.text(t("buttons.languageRussian"), "language:ru");
  if (locale === "ru") {
    keyboard.primary();
  }
  keyboard.row();
  return addSettingsNavigation(t, keyboard);
}

export function settingsKeyboard(t: Translate): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("buttons.language"), "menu:language")
    .row()
    .text(t("buttons.timezone"), "menu:timezone")
    .row()
    .text(t("buttons.token"), "menu:token")
    .row()
    .text(t("buttons.mainMenu"), "menu:main");
}

export function searchResultsKeyboard(
  t: Translate,
  results: SearchResult[],
  type: EntityType,
  pagination: Pagination
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const result of results) {
    keyboard
      .text(
        truncateText(result.name, BUTTON_TEXT_LIMIT),
        matchesCallback(type, result.id, DEFAULT_MATCH_DIRECTION, 1)
      )
      .row();
  }
  addPagination(t, keyboard, pagination, (page) => `search:${type}:${page}`);
  keyboard.text(t("buttons.searchMore"), `menu:${type}`).row();
  return addMainSections(t, keyboard).text(t("buttons.mainMenu"), "menu:main");
}

export function matchesKeyboard(
  t: Translate,
  selection: MatchNavigation
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const rows: readonly (readonly MatchDirection[])[] = [
    ["running"],
    ["upcoming", "past"],
  ];
  for (const row of rows) {
    for (const direction of row) {
      const isActive = selection.direction === direction;
      keyboard.text(
        t(`match.tabs.${direction}`),
        isActive
          ? "noop"
          : matchesCallback(selection.type, selection.id, direction, 1)
      );
      if (isActive) {
        keyboard.primary();
      }
    }
    keyboard.row();
  }

  addPagination(t, keyboard, selection, (page) =>
    matchesCallback(selection.type, selection.id, selection.direction, page)
  );

  if (selection.isFavorite !== null) {
    keyboard.text(
      t(
        selection.isFavorite ? "buttons.removeFavorite" : "buttons.saveFavorite"
      ),
      `favorite:set:${selection.type}:${selection.id}:${selection.direction}:${selection.page}:${selection.hasNext ? 1 : 0}:${selection.isFavorite ? 0 : 1}`
    );
    if (!selection.isFavorite) {
      keyboard.primary();
    }
    keyboard.row();
  }
  keyboard
    .text(
      t(
        selection.type === "team"
          ? "buttons.anotherTeam"
          : "buttons.anotherSeries"
      ),
      `menu:${selection.type}`
    )
    .row();
  return keyboard
    .text(t("buttons.favorites"), "menu:favorites")
    .text(t("buttons.mainMenu"), "menu:main");
}

export function favoritesKeyboard(
  t: Translate,
  favorites: Page<Favorite>
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const favorite of favorites.data) {
    const icon = favorite.type === "team" ? "👥" : "🏆";
    keyboard
      .text(
        truncateText(`${icon} ${favorite.name}`, BUTTON_TEXT_LIMIT),
        matchesCallback(favorite.type, favorite.id, DEFAULT_MATCH_DIRECTION, 1)
      )
      .primary()
      .row();
  }
  addPagination(t, keyboard, favorites, (page) => `favorites:${page}`);
  return keyboard
    .text(t("buttons.searchTeam"), "menu:team")
    .text(t("buttons.searchSeries"), "menu:series")
    .row()
    .text(t("buttons.mainMenu"), "menu:main");
}
