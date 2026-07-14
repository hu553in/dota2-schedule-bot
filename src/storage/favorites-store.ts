import type { EntityType } from "../api/pandascore.ts";
import type { Page } from "../pagination.ts";
import { cleanText } from "../text.ts";

const MAX_NAME_LENGTH = 120;

export interface Favorite {
  createdAt: number;
  id: number;
  name: string;
  type: EntityType;
}

export type FavoriteInput = Omit<Favorite, "createdAt">;

interface FavoriteRow {
  created_at: number;
  display_name: string;
  entity_id: number;
  entity_type: EntityType;
}

function normalizeFavorite(favorite: FavoriteInput): FavoriteInput {
  return {
    id: favorite.id,
    name: cleanText(favorite.name, MAX_NAME_LENGTH),
    type: favorite.type,
  };
}

function toFavorite(row: FavoriteRow): Favorite {
  return {
    createdAt: row.created_at,
    id: row.entity_id,
    name: row.display_name,
    type: row.entity_type,
  };
}

export class FavoritesStore {
  readonly #database: D1Database;

  constructor(database: D1Database) {
    this.#database = database;
  }

  async has(
    userId: number | string,
    type: EntityType,
    id: number
  ): Promise<boolean> {
    const row = await this.#database
      .prepare(
        `SELECT 1 AS present FROM user_favorites
         WHERE user_id = ? AND entity_type = ? AND entity_id = ? LIMIT 1`
      )
      .bind(String(userId), type, id)
      .first<{ present: number }>();
    return row?.present === 1;
  }

  async list(
    userId: number | string,
    requestedPage: number,
    requestedPageSize: number
  ): Promise<Page<Favorite>> {
    const page = Math.max(Math.trunc(requestedPage), 1);
    const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize), 1), 50);
    const offset = (page - 1) * pageSize;
    const normalizedUserId = String(userId);
    const [count, rows] = await Promise.all([
      this.#database
        .prepare(
          "SELECT COUNT(*) AS total FROM user_favorites WHERE user_id = ?"
        )
        .bind(normalizedUserId)
        .first<{ total: number }>(),
      this.#database
        .prepare(
          `SELECT entity_type, entity_id, display_name, created_at
           FROM user_favorites
           WHERE user_id = ?
           ORDER BY created_at DESC, entity_type, entity_id
           LIMIT ? OFFSET ?`
        )
        .bind(normalizedUserId, pageSize, offset)
        .all<FavoriteRow>(),
    ]);
    const total = count?.total ?? 0;
    return {
      data: rows.results.map(toFavorite),
      hasNext: page * pageSize < total,
      page,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
  }

  async set(
    userId: number | string,
    favoriteInput: FavoriteInput,
    isFavorite: boolean
  ): Promise<void> {
    const favorite = normalizeFavorite(favoriteInput);
    const normalizedUserId = String(userId);
    if (!isFavorite) {
      await this.#database
        .prepare(
          `DELETE FROM user_favorites
           WHERE user_id = ? AND entity_type = ? AND entity_id = ?`
        )
        .bind(normalizedUserId, favorite.type, favorite.id)
        .run();
      return;
    }
    await this.#database
      .prepare(
        `INSERT INTO user_favorites
           (user_id, entity_type, entity_id, display_name, created_at)
         VALUES (?, ?, ?, ?, unixepoch())
         ON CONFLICT (user_id, entity_type, entity_id) DO UPDATE SET
           display_name = excluded.display_name`
      )
      .bind(normalizedUserId, favorite.type, favorite.id, favorite.name)
      .run();
  }
}
