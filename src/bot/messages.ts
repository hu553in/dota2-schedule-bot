import { FormattedString } from "@grammyjs/parse-mode";
import type { EntityType, MatchDirection } from "../api/pandascore.ts";
import type { Match, Series, Team } from "../api/schemas.ts";
import type { Locale, Translate } from "../localization.ts";
import type { Page } from "../pagination.ts";
import type { Favorite } from "../storage/favorites-store.ts";
import { cleanText } from "../text.ts";
import { formatDateAtUtcOffset, formatUtcOffset } from "../timezone.ts";
import { BOT_COMMANDS } from "./commands.ts";

const TELEGRAM_MESSAGE_LIMIT = 4096;
const CONTENT_LIMIT = TELEGRAM_MESSAGE_LIMIT - 1;
const NAME_LIMIT = 80;
const STAGE_LIMIT = 100;
const SEARCH_QUERY_PREFIX = "🔎 «";
const TELEGRAM_URL_BREAK = "\u2060";
const WWW_PREFIX = /^www\./;
const SCORE_DIGITS: Record<string, string> = {
  "0": "0️⃣",
  "1": "1️⃣",
  "2": "2️⃣",
  "3": "3️⃣",
  "4": "4️⃣",
  "5": "5️⃣",
  "6": "6️⃣",
  "7": "7️⃣",
  "8": "8️⃣",
  "9": "9️⃣",
};
const REPOSITORY_URL = "https://github.com/hu553in/dota2-schedule-bot";
const VISIBLE_STATUS_ICONS = {
  canceled: "🚫",
  draw: "🤝",
  postponed: "⏸",
  unknown: "❔",
} as const;
const STREAM_PROVIDER_NAMES: Record<string, string> = {
  "facebook.com": "Facebook",
  "kick.com": "Kick",
  "steam.tv": "Steam",
  "trovo.live": "Trovo",
  "twitch.tv": "Twitch",
  "vk.com": "VK Video",
  "vkvideo.ru": "VK Video",
  "youtu.be": "YouTube",
  "youtube.com": "YouTube",
};
const MATCH_FORMAT_PREFIXES = {
  all_games_played: null,
  best_of: "BO",
  custom: null,
  first_to: "FT",
  ow_best_of: "OW BO",
  red_bull_home_ground: "RBHG BO",
  unknown: null,
} satisfies Record<Match["match_type"], null | string>;

type VisibleMatchStatus = keyof typeof VISIBLE_STATUS_ICONS;

export function buildDeploymentPrompt(responseLanguage: string): string {
  return [
    `Analyze the current code at ${REPOSITORY_URL}.`,
    "Help me fully deploy this Telegram bot to my own Cloudflare account.",
    `Give simple, clear, step-by-step instructions in ${responseLanguage}.`,
    "First inspect the repository's current files and commands.",
    "Cover the PandaScore token, Cloudflare Workers and D1, environment variables and secrets, database migrations, deployment, the Telegram webhook, and end-to-end verification.",
    "Do not invent missing steps. Ask only necessary questions.",
  ].join(" ");
}

export type TokenScreenState =
  | "connected"
  | "corrupt"
  | "invalid"
  | "missing"
  | "unavailable"
  | "valid";

function limitMessage(message: FormattedString): FormattedString {
  return message.text.length <= TELEGRAM_MESSAGE_LIMIT
    ? message
    : message.slice(0, CONTENT_LIMIT).plain("…");
}

function pageLabel(t: Translate, page: Page<unknown>): string {
  return page.totalPages
    ? t("pagination.pageOf", {
        page: page.page,
        totalPages: page.totalPages,
      })
    : t("pagination.page", { page: page.page });
}

export function homeMessage(t: Translate, hasToken: boolean): FormattedString {
  return FormattedString.join([
    FormattedString.b(t("home.title")),
    "\n\n",
    t(hasToken ? "home.readyBody" : "home.setupBody"),
  ]);
}

export function helpMessage(t: Translate): FormattedString {
  return FormattedString.join([
    FormattedString.b(t("help.title")),
    "\n\n",
    t("help.body"),
    "\n\n",
    FormattedString.b(t("help.commandsTitle")),
    "\n",
    BOT_COMMANDS.map(
      (command) => `/${command} — ${t(`commands.${command}`)}`
    ).join("\n"),
    "\n\n",
    t("help.githubBefore"),
    FormattedString.link("GitHub", REPOSITORY_URL),
    t("help.githubAfter"),
  ]);
}

export function settingsMessage(t: Translate): FormattedString {
  return FormattedString.join([
    FormattedString.b(t("settings.title")),
    "\n\n",
    t("settings.body"),
  ]);
}

export function languageMessage(
  t: Translate,
  locale: Locale,
  isManual: boolean
): FormattedString {
  const value = t(
    locale === "en" ? "buttons.languageEnglish" : "buttons.languageRussian"
  );
  const source = t(isManual ? "language.manual" : "language.automatic");
  return FormattedString.join([
    FormattedString.b(t("language.title")),
    "\n\n",
    FormattedString.b(t("language.current", { source, value })),
    "\n\n",
    t(
      isManual ? "language.descriptionManual" : "language.descriptionAutomatic"
    ),
  ]);
}

export function tokenScreenMessage(
  t: Translate,
  state: TokenScreenState
): FormattedString {
  return FormattedString.join([
    FormattedString.b(t("token.screenTitle")),
    "\n\n",
    t(`token.state.${state}`),
  ]);
}

export function tokenSavedMessage(t: Translate): FormattedString {
  return FormattedString.join([
    FormattedString.b(t("token.savedTitle")),
    "\n\n",
    t("token.savedBody"),
  ]);
}

export function tokenDeleteConfirmationMessage(t: Translate): FormattedString {
  return FormattedString.join([t("token.deleteConfirm")]);
}

export function tokenGuideMessage(t: Translate): FormattedString {
  const prompt = buildDeploymentPrompt(t("deployment.responseLanguage"));
  const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
  return FormattedString.join([
    FormattedString.b(t("token.guide.title")),
    "\n\n1. ",
    FormattedString.link(
      t("token.guide.signup"),
      "https://app.pandascore.co/signup"
    ),
    ".\n\n2. ",
    t("token.guide.beforeDashboard"),
    FormattedString.link(
      t("token.guide.dashboard"),
      "https://app.pandascore.co/dashboard/main"
    ),
    t("token.guide.afterDashboard"),
    FormattedString.b(t("token.guide.field")),
    t("token.guide.afterField"),
    FormattedString.link("GitHub", REPOSITORY_URL),
    t("token.guide.afterGithub"),
    FormattedString.link(
      "Cloudflare Workers",
      "https://developers.cloudflare.com/workers/"
    ),
    t("token.guide.afterCloudflare"),
    FormattedString.link("ChatGPT", chatGptUrl),
    t("token.guide.afterChatGpt"),
    FormattedString.link("Claude", claudeUrl),
    t("token.guide.afterClaude"),
  ]);
}

export function teamDisplayName(team: Team, t: Translate): string {
  const name = cleanText(team.name, NAME_LIMIT) || t("display.unnamedTeam");
  const acronym = cleanText(team.acronym ?? "", 16);
  return acronym && acronym.toLowerCase() !== name.toLowerCase()
    ? `${name} (${acronym})`
    : name;
}

function uniqueParts(parts: (null | string | undefined)[]): string[] {
  return [
    ...new Set(parts.map((part) => cleanText(part ?? "", NAME_LIMIT))),
  ].filter(Boolean);
}

function preventTelegramAutoLink(value: string): string {
  return value
    .replaceAll(TELEGRAM_URL_BREAK, "")
    .replaceAll(".", `.${TELEGRAM_URL_BREAK}`);
}

function restoreTelegramAutoLinkText(value: string): string {
  return value.replaceAll(TELEGRAM_URL_BREAK, "");
}

export function seriesDisplayName(series: Series, t: Translate): string {
  return (
    uniqueParts([series.league.name, series.full_name]).join(" · ") ||
    t("display.unnamedSeries")
  );
}

function formattedDate(
  iso: null | string | undefined,
  utcOffsetMinutes: null | number,
  locale: Locale,
  t: Translate
): FormattedString {
  if (!iso) {
    return FormattedString.i(t("match.timeUnknown"));
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return FormattedString.i(t("match.timeUnknown"));
  }
  if (utcOffsetMinutes !== null) {
    return FormattedString.join([
      formatDateAtUtcOffset(date, utcOffsetMinutes, locale),
    ]);
  }
  const fallback = `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return FormattedString.time(
    fallback,
    Math.floor(date.getTime() / 1000),
    "wdt"
  );
}

function scoreFor(match: Match, team?: null | Team): number | undefined {
  return team
    ? match.results.find((result) => result.team_id === team.id)?.score
    : undefined;
}

function emojiScore(score?: number): string {
  return score === undefined
    ? "❔"
    : [...String(score)]
        .map((character) => SCORE_DIGITS[character] ?? character)
        .join("");
}

function visibleMatchStatus(match: Match): VisibleMatchStatus | null {
  if (match.draw) {
    return "draw";
  }
  return match.status in VISIBLE_STATUS_ICONS
    ? (match.status as VisibleMatchStatus)
    : null;
}

function matchDate(match: Match): null | string | undefined {
  if (match.status === "canceled" || match.status === "postponed") {
    return null;
  }
  return match.status === "finished" || match.status === "running"
    ? (match.begin_at ?? match.scheduled_at)
    : (match.scheduled_at ?? match.begin_at);
}

function matchFormat(t: Translate, match: Match): null | string {
  const games = match.number_of_games;
  if (match.match_type === "custom") {
    return games > 0
      ? `${t("match.format.custom")} · ${t("match.format.gameCount", { count: games })}`
      : t("match.format.custom");
  }
  if (games === 0) {
    return null;
  }
  const prefix = MATCH_FORMAT_PREFIXES[match.match_type];
  return prefix
    ? `${prefix}${games}`
    : t("match.format.gameCount", { count: games });
}

function streamProvider(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase().replace(WWW_PREFIX, "");
  for (const [domain, name] of Object.entries(STREAM_PROVIDER_NAMES)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
      return name;
    }
  }
  return cleanText(hostname, 40);
}

function streamKind(t: Translate, main: boolean, official: boolean): string {
  if (main) {
    return t("match.stream.main");
  }
  return t(official ? "match.stream.official" : "match.stream.unofficial");
}

function formattedStreams(t: Translate, match: Match): FormattedString | null {
  if (match.status !== "not_started" && match.status !== "running") {
    return null;
  }
  const seen = new Set<string>();
  const streams = match.streams_list
    .toSorted(
      (first, second) =>
        Number(second.main) - Number(first.main) ||
        Number(second.official) - Number(first.official)
    )
    .filter((stream) => {
      if (seen.has(stream.raw_url)) {
        return false;
      }
      seen.add(stream.raw_url);
      return true;
    });
  if (streams.length === 0) {
    return null;
  }
  return FormattedString.join(
    streams.map((stream) => {
      const language = cleanText(stream.language, 8).toUpperCase();
      const details = [language, streamKind(t, stream.main, stream.official)]
        .filter(Boolean)
        .join(" ");
      return FormattedString.join([
        FormattedString.link(streamProvider(stream.raw_url), stream.raw_url),
        ` (${details})`,
      ]);
    }),
    ", "
  );
}

function formatMatch(
  t: Translate,
  locale: Locale,
  match: Match,
  includeSeries: boolean,
  utcOffsetMinutes: null | number
): FormattedString {
  const firstOpponent = match.opponents[0]?.opponent;
  const secondOpponent = match.opponents[1]?.opponent;
  const firstTeam = preventTelegramAutoLink(
    firstOpponent
      ? teamDisplayName(firstOpponent, t)
      : t("match.participantUnknown")
  );
  const secondTeam = preventTelegramAutoLink(
    secondOpponent
      ? teamDisplayName(secondOpponent, t)
      : t("match.participantUnknown")
  );
  const hasScore = match.status === "finished" || match.status === "running";
  const visibleStatus = visibleMatchStatus(match);
  const matchIcon = visibleStatus ? VISIBLE_STATUS_ICONS[visibleStatus] : "📅";
  const firstLine = hasScore
    ? FormattedString.join([
        match.status === "running" ? "🔴 " : "✅ ",
        firstTeam,
        "  ",
        FormattedString.b(
          `${emojiScore(scoreFor(match, firstOpponent))} : ${emojiScore(scoreFor(match, secondOpponent))}`
        ),
        "  ",
        secondTeam,
      ])
    : FormattedString.join([`${matchIcon} `, firstTeam, " — ", secondTeam]);
  const format = matchFormat(t, match);
  const details = [
    ...(visibleStatus
      ? [FormattedString.b(t(`match.status.${visibleStatus}`))]
      : []),
    formattedDate(matchDate(match), utcOffsetMinutes, locale, t),
    ...(format ? [FormattedString.code(format)] : []),
  ];
  const series = includeSeries
    ? preventTelegramAutoLink(
        uniqueParts([match.league?.name, match.serie?.full_name]).join(" · ")
      )
    : "";
  const stage = preventTelegramAutoLink(
    cleanText(match.tournament?.name ?? "", STAGE_LIMIT)
  );
  const streams = formattedStreams(t, match);
  return FormattedString.join([
    firstLine,
    "\n",
    FormattedString.join(details, " · "),
    ...(series
      ? ["\n", FormattedString.i(t("match.tournament", { name: series }))]
      : []),
    ...(stage
      ? ["\n", FormattedString.i(t("match.stage", { name: stage }))]
      : []),
    ...(streams ? ["\n", streams] : []),
  ]);
}

export function buildMatchesMessage(
  t: Translate,
  locale: Locale,
  title: string,
  type: EntityType,
  direction: MatchDirection,
  matches: Page<Match>,
  utcOffsetMinutes: null | number = null,
  notice: null | string = null
): FormattedString {
  const directionKey = `match.direction.${direction}`;
  const empty = matches.hasNext
    ? t("match.emptyFiltered")
    : t(`${directionKey}.empty`);
  const content = matches.data.length
    ? FormattedString.join(
        matches.data.map((match) =>
          formatMatch(t, locale, match, type === "team", utcOffsetMinutes)
        ),
        "\n\n"
      )
    : FormattedString.i(empty);
  return limitMessage(
    FormattedString.join([
      FormattedString.b(
        `🎮 ${preventTelegramAutoLink(cleanText(title, NAME_LIMIT))}`
      ),
      "\n",
      `${t(`${directionKey}.heading`)} · ${pageLabel(t, matches)}`,
      "\n\n",
      content,
      ...(notice ? ["\n\n⚠️ ", notice] : []),
    ])
  );
}

export function matchTitleFromMessage(text?: string): string | null {
  const firstLine = text?.split("\n", 1)[0];
  return firstLine?.startsWith("🎮 ")
    ? cleanText(restoreTelegramAutoLinkText(firstLine.slice(3)), NAME_LIMIT) ||
        null
    : null;
}

export function searchTermFromMessage(text?: string): string | null {
  const line = text
    ?.split("\n")
    .find((item) => item.startsWith(SEARCH_QUERY_PREFIX));
  return line?.endsWith("»")
    ? cleanText(
        restoreTelegramAutoLinkText(line.slice(SEARCH_QUERY_PREFIX.length, -1)),
        100
      ) || null
    : null;
}

export function searchResultsMessage(
  t: Translate,
  type: EntityType,
  searchTerm: string,
  results: Page<unknown>
): FormattedString {
  const hasResults = results.data.length > 0;
  return FormattedString.join([
    FormattedString.b(
      hasResults
        ? t(type === "team" ? "search.foundTeam" : "search.foundSeries")
        : t("search.emptyPage")
    ),
    `\n\n${SEARCH_QUERY_PREFIX}`,
    preventTelegramAutoLink(cleanText(searchTerm, 100)),
    "»",
    `\n${pageLabel(t, results)}`,
    "\n",
    t(hasResults ? "search.instructionFound" : "search.instructionEmpty"),
  ]);
}

export function emptySearchMessage(
  t: Translate,
  type: EntityType
): FormattedString {
  const subject = t(
    type === "team" ? "search.subjectTeam" : "search.subjectSeries"
  );
  const prompt = t(`input.prompt.${type}`);
  return FormattedString.join([
    FormattedString.b(prompt.split("\n", 1)[0] ?? ""),
    "\n\n",
    t("search.empty", { subject }),
  ]);
}

export function timezoneMessage(
  t: Translate,
  utcOffsetMinutes: null | number
): FormattedString {
  const current =
    utcOffsetMinutes === null
      ? t("timezone.automatic")
      : t("timezone.manual", {
          offset: formatUtcOffset(utcOffsetMinutes),
        });
  return FormattedString.join([
    FormattedString.b(t("timezone.title")),
    "\n\n",
    FormattedString.b(t("timezone.now", { value: current })),
    "\n\n",
    t(
      utcOffsetMinutes === null
        ? "timezone.automaticDescription"
        : "timezone.manualDescription"
    ),
  ]);
}

export function favoritesMessage(
  t: Translate,
  favorites: Page<Favorite>
): FormattedString {
  return FormattedString.join([
    FormattedString.b(t("favorites.title")),
    "\n\n",
    favorites.total === 0
      ? t("favorites.empty")
      : t("favorites.list", { page: pageLabel(t, favorites) }),
  ]);
}
