import { describe, expect, it } from "vitest";
import english from "../src/locales/en.json" with { type: "json" };
import russian from "../src/locales/ru.json" with { type: "json" };
import {
  getTranslator,
  localeFromLanguageCode,
  SUPPORTED_LOCALES,
} from "../src/localization.ts";

const PLACEHOLDER_PATTERN = /{{\s*([^},\s]+).*?}}/g;

function flatten(value: unknown, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "string") {
    result.set(prefix, value);
    return result;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    for (const [childKey, text] of flatten(child, path)) {
      result.set(childKey, text);
    }
  }
  return result;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1] ?? "")
    .sort((first, second) => first.localeCompare(second));
}

describe("localization", () => {
  it("keeps complete, non-empty locale catalogs", () => {
    const en = flatten(english);
    const ru = flatten(russian);
    expect([...en.keys()].sort()).toEqual([...ru.keys()].sort());
    expect([...en.values()].every((value) => value.trim().length > 0)).toBe(
      true
    );
    expect([...ru.values()].every((value) => value.trim().length > 0)).toBe(
      true
    );
    for (const [key, englishText] of en) {
      expect(placeholders(englishText), key).toEqual(
        placeholders(ru.get(key) ?? "")
      );
    }
  });

  it("uses Russian only for Russian device locales and English otherwise", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "ru"]);
    expect(localeFromLanguageCode("ru-RU")).toBe("ru");
    expect(localeFromLanguageCode("RU")).toBe("ru");
    expect(localeFromLanguageCode("en-US")).toBe("en");
    expect(localeFromLanguageCode("de")).toBe("en");
    expect(localeFromLanguageCode(undefined)).toBe("en");
  });

  it("returns request-scoped translators without changing global language", () => {
    const en = getTranslator("en");
    const ru = getTranslator("ru");
    expect(en("buttons.settings")).toBe("⚙️ Settings");
    expect(ru("buttons.settings")).toBe("⚙️ Настройки");
    expect(en("pagination.page", { page: 2 })).toBe("Page 2");
  });
});
