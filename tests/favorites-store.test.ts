import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesStore } from "../src/storage/favorites-store.ts";
import { testEnv } from "./setup.ts";

const REPEATED_WHITESPACE = /\s{2,}/;

describe("FavoritesStore", () => {
  beforeEach(async () => {
    await testEnv.DB.exec("DELETE FROM user_favorites");
  });

  it("sets teams and series idempotently per Telegram user", async () => {
    const store = new FavoritesStore(testEnv.DB);

    await expect(
      store.set(42, { id: 7, name: "  Team   Spirit  ", type: "team" }, true)
    ).resolves.toBeUndefined();
    await expect(
      store.set(
        42,
        {
          id: 10_728,
          name: "Esports World Cup · 2026",
          type: "series",
        },
        true
      )
    ).resolves.toBeUndefined();
    await store.set(42, { id: 7, name: "Team Spirit", type: "team" }, true);
    expect(await store.has(42, "team", 7)).toBe(true);
    expect(await store.has(43, "team", 7)).toBe(false);

    await store.set(42, { id: 7, name: "Team Spirit", type: "team" }, false);
    expect(await store.has(42, "team", 7)).toBe(false);
    expect(await store.has(42, "series", 10_728)).toBe(true);
  });

  it("returns deterministic pages without calling PandaScore", async () => {
    const store = new FavoritesStore(testEnv.DB);
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        store.set(
          42,
          {
            id: index + 1,
            name: `Team ${index + 1}`,
            type: "team",
          },
          true
        )
      )
    );

    await expect(store.list(42, 1, 2)).resolves.toMatchObject({
      data: [{ id: 1 }, { id: 2 }],
      hasNext: true,
      page: 1,
      total: 5,
      totalPages: 3,
    });
    await expect(store.list(42, 3, 2)).resolves.toMatchObject({
      data: [{ id: 5 }],
      hasNext: false,
      page: 3,
    });
  });

  it("normalizes stored labels and preserves a clean schema contract", async () => {
    const store = new FavoritesStore(testEnv.DB);
    await store.set(
      42,
      {
        id: 7,
        name: `  ${"Long \n\t".repeat(40)}🙂  `,
        type: "team",
      },
      true
    );
    const favorites = await store.list(42, 1, 8);
    expect(favorites.data[0]?.name.length).toBeLessThanOrEqual(120);
    expect(favorites.data[0]?.name).not.toMatch(REPEATED_WHITESPACE);

    const columns = await testEnv.DB.prepare(
      "PRAGMA table_info(user_favorites)"
    ).all<{ name: string }>();
    expect(columns.results.map((column) => column.name)).toEqual([
      "user_id",
      "entity_type",
      "entity_id",
      "display_name",
      "created_at",
    ]);
  });

  it("treats a missing count row as an empty page", async () => {
    const database = {
      prepare: vi.fn((sql: string) => ({
        bind: () =>
          sql.includes("COUNT")
            ? { first: async () => null }
            : { all: async () => ({ results: [] }) },
      })),
    } as unknown as D1Database;
    await expect(
      new FavoritesStore(database).list(42, 0, 100)
    ).resolves.toEqual({
      data: [],
      hasNext: false,
      page: 1,
      total: 0,
      totalPages: 1,
    });
  });
});
