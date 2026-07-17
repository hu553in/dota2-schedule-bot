import type { UserFromGetMe } from "grammy/types";

import type { PandaScoreApi } from "../api/pandascore.ts";
import type { FavoritesStore } from "../storage/favorites-store.ts";
import type { PreferencesStore } from "../storage/preferences-store.ts";
import type { TokenStore } from "../storage/token-store.ts";

export type BotApi = Pick<
  PandaScoreApi,
  | "getMatches"
  | "getSeries"
  | "getTeam"
  | "searchSeries"
  | "searchTeams"
  | "validateToken"
>;

export type BotFavoritesStore = Pick<FavoritesStore, "has" | "list" | "set">;

export type BotTokenStore = Pick<TokenStore, "delete" | "get" | "set">;

export type BotPreferencesStore = Pick<
  PreferencesStore,
  "get" | "setLanguage" | "setUtcOffset"
>;

export interface BotDependencies {
  api: BotApi;
  botInfo: UserFromGetMe;
  botToken: string;
  favoritesStore: BotFavoritesStore;
  preferencesStore: BotPreferencesStore;
  telegramFetch?: typeof globalThis.fetch;
  telegramPremium: boolean;
  tokenStore: BotTokenStore;
}
