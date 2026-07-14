import type { Bot } from "grammy";
import type { EntityType } from "../api/pandascore.ts";
import { callbackPageSchema, PAGE_SIZE, type Page } from "../pagination.ts";
import { cleanText } from "../text.ts";
import type { BotContext } from "./context.ts";
import type { BotDependencies } from "./dependencies.ts";
import { replyApiError } from "./errors.ts";
import type { InputRouter } from "./input.ts";
import { type SearchResult, searchResultsKeyboard } from "./keyboards.ts";
import {
  emptySearchMessage,
  searchResultsMessage,
  searchTermFromMessage,
  seriesDisplayName,
  teamDisplayName,
} from "./messages.ts";
import {
  acknowledge,
  answerCallbackAlert,
  requireToken,
  type ScreenMode,
  showScreen,
} from "./runtime.ts";

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;
const MENU_PATTERN = /^menu:(series|team)$/;
const SEARCH_PATTERN = /^search:(series|team):(\d+)$/;

function resultPage<T extends { id: number }>(
  page: Page<T>,
  displayName: (entity: T) => string
): Page<SearchResult> {
  return {
    ...page,
    data: page.data.map((entity) => ({
      id: entity.id,
      name: displayName(entity),
    })),
  };
}

export function registerSearchHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies,
  input: InputRouter
): void {
  const { api, tokenStore } = dependencies;

  async function showSearchResults(
    context: BotContext,
    mode: EntityType,
    searchTerm: string,
    page: Page<SearchResult>,
    screenMode: ScreenMode
  ): Promise<void> {
    if (page.data.length === 0 && page.page === 1 && !page.hasNext) {
      await input.prompt(
        context,
        mode,
        emptySearchMessage(context.t, mode).text
      );
      return;
    }
    await showScreen(
      context,
      searchResultsMessage(context.t, mode, searchTerm, page),
      searchResultsKeyboard(context.t, page.data, mode, page),
      screenMode
    );
  }

  async function runSearch(
    context: BotContext,
    mode: EntityType,
    searchTerm: string,
    page: number,
    token: string,
    screenMode: ScreenMode
  ): Promise<void> {
    let results: Page<SearchResult>;
    try {
      results =
        mode === "team"
          ? resultPage(
              await api.searchTeams(searchTerm, page, PAGE_SIZE, token),
              (team) => teamDisplayName(team, context.t)
            )
          : resultPage(
              await api.searchSeries(searchTerm, page, PAGE_SIZE, token),
              (series) => seriesDisplayName(series, context.t)
            );
    } catch (error) {
      await replyApiError(context, error, context.t("errors.search"));
      return;
    }
    await showSearchResults(context, mode, searchTerm, results, screenMode);
  }

  async function handleSearchInput(
    context: BotContext,
    mode: EntityType,
    rawText: string
  ): Promise<void> {
    const searchTerm = cleanText(rawText, MAX_SEARCH_LENGTH + 1);
    const searchLength = [...searchTerm].length;
    if (searchLength < MIN_SEARCH_LENGTH || searchLength > MAX_SEARCH_LENGTH) {
      await input.prompt(
        context,
        mode,
        context.t("search.length", {
          max: MAX_SEARCH_LENGTH,
          min: MIN_SEARCH_LENGTH,
        })
      );
      return;
    }
    const token = await requireToken(context, tokenStore, "reply");
    if (!token) {
      return;
    }
    await runSearch(context, mode, searchTerm, 1, token, "reply");
  }

  input.handle("team", (context, text) =>
    handleSearchInput(context, "team", text)
  );
  input.handle("series", (context, text) =>
    handleSearchInput(context, "series", text)
  );

  bot.callbackQuery(MENU_PATTERN, async (context) => {
    const acknowledged = acknowledge(context);
    const type = context.match[1] as EntityType;
    const token = await requireToken(context, tokenStore, "edit");
    if (token) {
      await input.prompt(context, type);
    }
    await acknowledged;
  });

  bot.callbackQuery(SEARCH_PATTERN, async (context) => {
    const type = context.match[1] as EntityType;
    const page = callbackPageSchema.safeParse(context.match[2]);
    const searchTerm = searchTermFromMessage(
      context.callbackQuery.message?.text
    );
    if (!(page.success && searchTerm)) {
      await answerCallbackAlert(context, context.t("toasts.staleSearch"));
      return;
    }
    const acknowledged = acknowledge(context);
    const token = await requireToken(context, tokenStore, "edit");
    if (token) {
      await runSearch(context, type, searchTerm, page.data, token, "edit");
    }
    await acknowledged;
  });
}
