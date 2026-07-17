import type { Bot } from "grammy";
import { z } from "zod";

import type { EntityType, MatchDirection } from "../api/pandascore.ts";
import type { Match } from "../api/schemas.ts";
import { errorMessage } from "../error-message.ts";
import type { Translate } from "../localization.ts";
import { callbackPageSchema, PAGE_SIZE } from "../pagination.ts";
import type { Page } from "../pagination.ts";
import type { BotContext } from "./context.ts";
import type { BotApi, BotDependencies } from "./dependencies.ts";
import { replyApiError } from "./errors.ts";
import { matchesKeyboard } from "./keyboards.ts";
import {
  buildMatchesMessage,
  matchTitleFromMessage,
  seriesDisplayName,
  teamDisplayName,
} from "./messages.ts";
import {
  acknowledge,
  answerCallbackAlert,
  editKeyboard,
  requireToken,
  showScreen,
} from "./runtime.ts";

const MATCHES_PATTERN =
  /^matches:(series|team):(\d+):(upcoming|running|past):(\d+)$/u;
const FAVORITE_PATTERN =
  /^favorite:set:(series|team):(\d+):(upcoming|running|past):(\d+):([01]):([01])$/u;
const entityIdSchema = z.coerce.number().int().positive();

async function loadEntityTitle(
  api: BotApi,
  type: EntityType,
  id: number,
  token: string,
  t: Translate
): Promise<string> {
  return type === "team"
    ? teamDisplayName(await api.getTeam(id, token), t)
    : seriesDisplayName(await api.getSeries(id, token), t);
}

export function registerMatchHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies
): void {
  const { api, favoritesStore, telegramPremium, tokenStore } = dependencies;

  bot.callbackQuery(MATCHES_PATTERN, async (context) => {
    const type = context.match[1] as EntityType;
    const id = entityIdSchema.safeParse(context.match[2]);
    const direction = context.match[3] as MatchDirection;
    const page = callbackPageSchema.safeParse(context.match[4]);
    if (!(id.success && page.success)) {
      await answerCallbackAlert(context, context.t("toasts.staleSearch"));
      return;
    }
    const acknowledged = acknowledge(context);
    const token = await requireToken(context, tokenStore, "edit");
    if (!token) {
      await acknowledged;
      return;
    }
    const currentTitle = matchTitleFromMessage(
      context.callbackQuery.message?.text
    );
    let loaded: [string, Page<Match>, boolean | null];
    try {
      const favoritePromise = favoritesStore
        .has(context.from.id, type, id.data)
        .catch((error): null => {
          console.error("Favorite state load failed", {
            message: errorMessage(error),
          });
          return null;
        });
      loaded = await Promise.all([
        currentTitle ?? loadEntityTitle(api, type, id.data, token, context.t),
        api.getMatches(type, id.data, direction, page.data, PAGE_SIZE, token),
        favoritePromise,
      ]);
    } catch (error) {
      await replyApiError(context, error, context.t("errors.matchesLoad"));
      await acknowledged;
      return;
    }
    const [title, matches, isFavorite] = loaded;
    const notices: string[] = [];
    if (isFavorite === null) {
      notices.push(context.t("errors.favoriteLoad"));
    }
    if (!context.preferencesAvailable) {
      notices.push(context.t("errors.preferencesLoad"));
    }
    const message = buildMatchesMessage(
      context.t,
      context.locale,
      title,
      type,
      direction,
      matches,
      {
        notice: notices.join(" ") || null,
        telegramPremium,
        utcOffsetMinutes: context.preferences.utcOffsetMinutes,
      }
    );
    await showScreen(
      context,
      message,
      matchesKeyboard(context.t, {
        direction,
        hasNext: matches.hasNext,
        id: id.data,
        isFavorite,
        page: matches.page,
        type,
      }),
      "edit"
    );
    await acknowledged;
  });

  bot.callbackQuery(FAVORITE_PATTERN, async (context) => {
    const type = context.match[1] as EntityType;
    const id = entityIdSchema.safeParse(context.match[2]);
    const direction = context.match[3] as MatchDirection;
    const page = callbackPageSchema.safeParse(context.match[4]);
    const hasNext = context.match[5] === "1";
    const isFavorite = context.match[6] === "1";
    const title = matchTitleFromMessage(context.callbackQuery.message?.text);
    if (!(id.success && page.success && title)) {
      await answerCallbackAlert(context, context.t("toasts.staleFavorite"));
      return;
    }
    try {
      await favoritesStore.set(
        context.from.id,
        { id: id.data, name: title, type },
        isFavorite
      );
    } catch (error) {
      console.error("Favorite update failed", {
        message: errorMessage(error),
      });
      await answerCallbackAlert(context, context.t("errors.favoriteUpdate"));
      return;
    }
    await editKeyboard(
      context,
      matchesKeyboard(context.t, {
        direction,
        hasNext,
        id: id.data,
        isFavorite,
        page: page.data,
        type,
      })
    );
    await context.answerCallbackQuery({
      text: context.t(
        isFavorite ? "toasts.favoriteAdded" : "toasts.favoriteRemoved"
      ),
    });
  });

  bot.callbackQuery("noop", async (context) => {
    await context.answerCallbackQuery(context.t("toasts.alreadyOpen"));
  });
}
