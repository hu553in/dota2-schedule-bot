import { z } from "zod";

import { SUPPORTED_LOCALES } from "../localization.ts";
import type { Locale } from "../localization.ts";
import { normalizeUtcOffsetMinutes } from "../timezone.ts";

export interface UserPreferences {
  language: Locale | null;
  utcOffsetMinutes: number | null;
}

interface PreferencesRow {
  language: string | null;
  utc_offset_minutes: number | null;
}

const localeSchema = z.enum(SUPPORTED_LOCALES);

export class PreferencesStore {
  readonly #database: D1Database;

  constructor(database: D1Database) {
    this.#database = database;
  }

  async get(userId: number | string): Promise<UserPreferences> {
    const row = await this.#database
      .prepare(
        "SELECT language, utc_offset_minutes FROM user_preferences WHERE user_id = ?"
      )
      .bind(String(userId))
      .first<PreferencesRow>();
    if (!row) {
      return { language: null, utcOffsetMinutes: null };
    }
    return {
      language: row.language ? localeSchema.parse(row.language) : null,
      utcOffsetMinutes:
        row.utc_offset_minutes === null
          ? null
          : normalizeUtcOffsetMinutes(row.utc_offset_minutes),
    };
  }

  async setLanguage(userId: number | string, language: Locale): Promise<void> {
    await this.#database
      .prepare(
        `INSERT INTO user_preferences (user_id, language, updated_at)
         VALUES (?, ?, unixepoch())
         ON CONFLICT (user_id) DO UPDATE SET
           language = excluded.language,
           updated_at = excluded.updated_at`
      )
      .bind(String(userId), localeSchema.parse(language))
      .run();
  }

  async setUtcOffset(
    userId: number | string,
    offsetMinutes: null | number
  ): Promise<void> {
    const normalizedUserId = String(userId);
    if (offsetMinutes === null) {
      await this.#database.batch([
        this.#database
          .prepare(
            `DELETE FROM user_preferences
             WHERE user_id = ? AND language IS NULL`
          )
          .bind(normalizedUserId),
        this.#database
          .prepare(
            `UPDATE user_preferences
             SET utc_offset_minutes = NULL, updated_at = unixepoch()
             WHERE user_id = ?`
          )
          .bind(normalizedUserId),
      ]);
      return;
    }
    await this.#database
      .prepare(
        `INSERT INTO user_preferences (user_id, utc_offset_minutes, updated_at)
         VALUES (?, ?, unixepoch())
         ON CONFLICT (user_id) DO UPDATE SET
           utc_offset_minutes = excluded.utc_offset_minutes,
           updated_at = excluded.updated_at`
      )
      .bind(normalizedUserId, normalizeUtcOffsetMinutes(offsetMinutes))
      .run();
  }
}
