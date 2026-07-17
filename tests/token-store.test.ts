import { beforeEach, describe, expect, it } from "vitest";

import {
  createTokenStore,
  TokenIntegrityError,
} from "../src/storage/token-store.ts";
import { testEnv } from "./setup.ts";

const MASTER_KEY = Uint8Array.fromBase64(testEnv.PS_MASTER_KEY);

describe("TokenStore", () => {
  beforeEach(async () => {
    await testEnv.DB.exec("DELETE FROM user_tokens");
  });

  it("creates, updates, reads and deletes encrypted tokens", async () => {
    const store = await createTokenStore(testEnv.DB, MASTER_KEY);
    await expect(store.get(42)).resolves.toBeNull();

    await store.set(42, "first-token");
    await expect(store.get(42)).resolves.toBe("first-token");
    const row = await testEnv.DB.prepare(
      "SELECT encrypted_token FROM user_tokens WHERE user_id = ?"
    )
      .bind("42")
      .first<{ encrypted_token: string }>();
    expect(row?.encrypted_token).not.toContain("first-token");

    await store.set(42, "updated-token");
    await expect(store.get("42")).resolves.toBe("updated-token");

    await store.delete(42);
    await expect(store.get(42)).resolves.toBeNull();
  });

  it("binds ciphertext to the Telegram user id", async () => {
    const store = await createTokenStore(testEnv.DB, MASTER_KEY);
    await store.set(1, "private-token");
    await testEnv.DB.prepare(
      "INSERT INTO user_tokens (user_id, encrypted_token) SELECT ?, encrypted_token FROM user_tokens WHERE user_id = ?"
    )
      .bind("2", "1")
      .run();

    await expect(store.get(2)).rejects.toBeInstanceOf(TokenIntegrityError);
  });

  it("rejects malformed ciphertext", async () => {
    const store = await createTokenStore(testEnv.DB, MASTER_KEY);
    await testEnv.DB.prepare(
      "INSERT INTO user_tokens (user_id, encrypted_token) VALUES (?, ?)"
    )
      .bind("7", "YQ")
      .run();

    await expect(store.get(7)).rejects.toBeInstanceOf(TokenIntegrityError);
  });
});
