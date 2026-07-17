import { FormattedString } from "@grammyjs/parse-mode";

import type { Match } from "../api/schemas.ts";
import type { Translate } from "../localization.ts";
import { cleanText, isSingleGrapheme } from "../text.ts";

const WWW_PREFIX = /^www\./u;
const CUSTOM_EMOJI_ID = /^[1-9]\d*$/u;
const PICTOGRAPHIC_EMOJI = /\p{Extended_Pictographic}/u;
const LANGUAGE_SUFFIX = /[-_].*$/u;
const STREAM_LANGUAGE_FLAGS = new Map([
  ["en", "🇺🇸"],
  ["ru", "🇷🇺"],
]);

export interface StreamProvider {
  readonly customEmojiId: null | string;
  readonly customEmojiPlaceholder: string;
  readonly domains: readonly string[];
  readonly name: string;
}

// Telegram requires a custom_emoji entity to cover one ordinary emoji. This
// placeholder is never an application fallback: disabled, missing, or malformed
// local configuration renders the provider name. Keep it equal to the emoji
// assigned to the sticker in the pack. Custom emoji IDs are public identifiers,
// not secrets.
const STREAM_PROVIDERS: readonly StreamProvider[] = [
  {
    customEmojiId: "5384404910479547790",
    customEmojiPlaceholder: "🔵",
    domains: ["facebook.com"],
    name: "Facebook",
  },
  {
    customEmojiId: "5384328610385536660",
    customEmojiPlaceholder: "🟢",
    domains: ["kick.com"],
    name: "Kick",
  },
  {
    customEmojiId: "5384182950864657106",
    customEmojiPlaceholder: "⚙️",
    domains: ["steam.tv"],
    name: "Steam",
  },
  {
    customEmojiId: "5384208458675426482",
    customEmojiPlaceholder: "🟩",
    domains: ["trovo.live"],
    name: "Trovo",
  },
  {
    customEmojiId: "5384549685237164293",
    customEmojiPlaceholder: "🟣",
    domains: ["twitch.tv"],
    name: "Twitch",
  },
  {
    customEmojiId: "5381908916005280967",
    customEmojiPlaceholder: "🔷",
    domains: ["vk.com", "vkvideo.ru"],
    name: "VK Video",
  },
  {
    customEmojiId: "5384171405992567533",
    customEmojiPlaceholder: "🔴",
    domains: ["youtu.be", "youtube.com"],
    name: "YouTube",
  },
];

function providerForHostname(
  hostname: string,
  providers: readonly StreamProvider[]
): StreamProvider | undefined {
  return providers.find((provider) =>
    provider.domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    )
  );
}

function streamKind(t: Translate, main: boolean, official: boolean): string {
  if (main) {
    return t("match.stream.main");
  }
  return t(official ? "match.stream.official" : "match.stream.unofficial");
}

function streamLanguage(language: string): string {
  const normalized = cleanText(language, 8).toLowerCase();
  const base = normalized.replace(LANGUAGE_SUFFIX, "");
  return STREAM_LANGUAGE_FLAGS.get(base) ?? normalized.toUpperCase();
}

function isSingleEmoji(value: string): boolean {
  return isSingleGrapheme(value) && PICTOGRAPHIC_EMOJI.test(value);
}

function formattedStream(
  t: Translate,
  stream: Match["streams_list"][number],
  telegramPremium: boolean,
  providers: readonly StreamProvider[]
): FormattedString {
  const hostname = new URL(stream.raw_url).hostname
    .toLowerCase()
    .replace(WWW_PREFIX, "");
  const provider = providerForHostname(hostname, providers);
  const language = streamLanguage(stream.language);
  const details = [language, streamKind(t, stream.main, stream.official)]
    .filter(Boolean)
    .join(" ");
  const detailsLink = ` (${details})`;
  const customEmojiId = provider?.customEmojiId;

  if (
    telegramPremium &&
    provider &&
    customEmojiId &&
    CUSTOM_EMOJI_ID.test(customEmojiId) &&
    isSingleEmoji(provider.customEmojiPlaceholder)
  ) {
    return FormattedString.join([
      FormattedString.emoji(provider.customEmojiPlaceholder, customEmojiId),
      FormattedString.link(detailsLink, stream.raw_url),
    ]);
  }

  const providerName = provider ? provider.name : cleanText(hostname, 40);
  return FormattedString.link(`${providerName}${detailsLink}`, stream.raw_url);
}

export function formatStreams(
  t: Translate,
  match: Match,
  telegramPremium: boolean,
  providers: readonly StreamProvider[] = STREAM_PROVIDERS
): FormattedString | null {
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

  return streams.length
    ? FormattedString.join(
        streams.map((stream) =>
          formattedStream(t, stream, telegramPremium, providers)
        ),
        ", "
      )
    : null;
}
