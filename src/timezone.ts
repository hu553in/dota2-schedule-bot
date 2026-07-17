import type { Locale } from "./localization.ts";

const MIN_UTC_OFFSET_MINUTES = -12 * 60;
const MAX_UTC_OFFSET_MINUTES = 14 * 60;
const UTC_OFFSET_PATTERN = /^(?:utc\s*)?([+−-]?)(\d{1,2})(?::?(\d{2}))?$/u;

export type TimezoneInput =
  | { mode: "automatic" }
  | { minutes: number; mode: "offset" };

export function normalizeUtcOffsetMinutes(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < MIN_UTC_OFFSET_MINUTES ||
    value > MAX_UTC_OFFSET_MINUTES
  ) {
    throw new RangeError("UTC offset must be an integer from -12:00 to +14:00");
  }
  return value;
}

export function parseTimezoneInput(value: string): TimezoneInput | null {
  const normalized = value.trim().toLowerCase();
  if (["auto", "telegram", "авто", "телеграм"].includes(normalized)) {
    return { mode: "automatic" };
  }
  const match = UTC_OFFSET_PATTERN.exec(normalized);
  if (!match) {
    return null;
  }
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  if (minutes > 59) {
    return null;
  }
  const sign = match[1] === "-" || match[1] === "−" ? -1 : 1;
  const offset = sign * (hours * 60 + minutes);
  try {
    return { minutes: normalizeUtcOffsetMinutes(offset), mode: "offset" };
  } catch {
    return null;
  }
}

export function formatUtcOffset(offsetMinutes: number): string {
  const normalized = normalizeUtcOffsetMinutes(offsetMinutes);
  const sign = normalized < 0 ? "−" : "+";
  const absolute = Math.abs(normalized);
  const hours = Math.floor(absolute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function formatDateAtUtcOffset(
  date: Date,
  offsetMinutes: number,
  locale: Locale
): string {
  const shifted = new Date(
    date.getTime() + normalizeUtcOffsetMinutes(offsetMinutes) * 60_000
  );
  const formatted = new Intl.DateTimeFormat(
    locale === "ru" ? "ru-RU" : "en-GB",
    {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }
  ).format(shifted);
  return `${formatted} · ${formatUtcOffset(offsetMinutes)}`;
}
