import { beforeEach, describe, expect, it } from "vitest";
import { PreferencesStore } from "../src/storage/preferences-store.ts";
import {
  formatDateAtUtcOffset,
  formatUtcOffset,
  normalizeUtcOffsetMinutes,
  parseTimezoneInput,
} from "../src/timezone.ts";
import { testEnv } from "./setup.ts";

describe("time zone and user preferences", () => {
  beforeEach(async () => {
    await testEnv.DB.exec("DELETE FROM user_preferences");
  });

  it("parses automatic mode and explicit UTC offsets", () => {
    expect(parseTimezoneInput("авто")).toEqual({ mode: "automatic" });
    expect(parseTimezoneInput("Telegram")).toEqual({ mode: "automatic" });
    expect(parseTimezoneInput("+6")).toEqual({ minutes: 360, mode: "offset" });
    expect(parseTimezoneInput("UTC -3:30")).toEqual({
      minutes: -210,
      mode: "offset",
    });
    expect(parseTimezoneInput("UTC −03:30")).toEqual({
      minutes: -210,
      mode: "offset",
    });
    expect(parseTimezoneInput("530")).toEqual({
      minutes: 330,
      mode: "offset",
    });
    expect(parseTimezoneInput("oops")).toBeNull();
    expect(parseTimezoneInput("+5:60")).toBeNull();
    expect(parseTimezoneInput("+15")).toBeNull();
    expect(parseTimezoneInput("-13")).toBeNull();
  });

  it("formats fixed offsets for the selected language", () => {
    expect(formatUtcOffset(360)).toBe("+06:00");
    expect(formatUtcOffset(-210)).toBe("−03:30");
    expect(
      formatDateAtUtcOffset(new Date("2026-07-13T10:00:00Z"), 360, "en")
    ).toContain("16:00 · +06:00");
    expect(
      formatDateAtUtcOffset(new Date("2026-07-13T10:00:00Z"), 360, "ru")
    ).toContain("16:00 · +06:00");
    expect(() => normalizeUtcOffsetMinutes(1.5)).toThrow(RangeError);
    expect(() => normalizeUtcOffsetMinutes(900)).toThrow(RangeError);
  });

  it("stores both preferences in one row without losing either value", async () => {
    const store = new PreferencesStore(testEnv.DB);
    expect(await store.get(42)).toEqual({
      language: null,
      utcOffsetMinutes: null,
    });

    await store.setUtcOffset(42, 360);
    expect(await store.get(42)).toEqual({
      language: null,
      utcOffsetMinutes: 360,
    });
    await store.setLanguage(42, "ru");
    expect(await store.get("42")).toEqual({
      language: "ru",
      utcOffsetMinutes: 360,
    });

    await store.setUtcOffset(42, -210);
    await store.setLanguage(42, "en");
    expect(await store.get(42)).toEqual({
      language: "en",
      utcOffsetMinutes: -210,
    });

    await store.setUtcOffset(42, null);
    expect(await store.get(42)).toEqual({
      language: "en",
      utcOffsetMinutes: null,
    });

    await store.setUtcOffset(43, 60);
    await store.setUtcOffset(43, null);
    expect(await store.get(43)).toEqual({
      language: null,
      utcOffsetMinutes: null,
    });
    await expect(store.setUtcOffset(42, 900)).rejects.toBeInstanceOf(
      RangeError
    );
  });

  it("exposes only the new schema", async () => {
    const tables = await testEnv.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).all<{ name: string }>();
    expect(tables.results.map((table) => table.name)).toContain(
      "user_preferences"
    );
    expect(tables.results.map((table) => table.name)).not.toContain(
      "user_timezones"
    );
    const tableOptions = await testEnv.DB.prepare(
      `SELECT name, wr, strict FROM pragma_table_list
       WHERE name IN ('user_tokens', 'user_favorites', 'user_preferences')
       ORDER BY name`
    ).all<{ name: string; strict: number; wr: number }>();
    expect(tableOptions.results).toEqual([
      { name: "user_favorites", strict: 1, wr: 1 },
      { name: "user_preferences", strict: 1, wr: 1 },
      { name: "user_tokens", strict: 1, wr: 1 },
    ]);
    const columns = await testEnv.DB.prepare(
      "PRAGMA table_info(user_preferences)"
    ).all<{ name: string }>();
    expect(columns.results.map((column) => column.name)).toEqual([
      "user_id",
      "language",
      "utc_offset_minutes",
      "updated_at",
    ]);
    await expect(
      testEnv.DB.prepare(
        "INSERT INTO user_preferences (user_id, language) VALUES ('bad-language', 'de')"
      ).run()
    ).rejects.toThrow();
    await expect(
      testEnv.DB.prepare(
        "INSERT INTO user_preferences (user_id) VALUES ('empty')"
      ).run()
    ).rejects.toThrow();
  });
});
