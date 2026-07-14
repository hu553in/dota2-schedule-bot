const IV_BYTES = 12;
const TAG_BYTES = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function importKey(masterKey: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    masterKey,
    { name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"]
  );
}

export class TokenIntegrityError extends Error {
  constructor(
    message = "Stored token failed integrity check",
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "TokenIntegrityError";
  }
}

export class TokenStore {
  readonly #database: D1Database;
  readonly #key: CryptoKey;

  constructor(database: D1Database, key: CryptoKey) {
    this.#database = database;
    this.#key = key;
  }

  async delete(userId: number | string): Promise<void> {
    await this.#database
      .prepare("DELETE FROM user_tokens WHERE user_id = ?")
      .bind(String(userId))
      .run();
  }

  async get(userId: number | string): Promise<null | string> {
    const normalizedUserId = String(userId);
    const row = await this.#database
      .prepare(
        "SELECT encrypted_token FROM user_tokens WHERE user_id = ? LIMIT 1"
      )
      .bind(normalizedUserId)
      .first<{ encrypted_token: string }>();
    return row
      ? await this.#decrypt(row.encrypted_token, normalizedUserId)
      : null;
  }

  async set(userId: number | string, token: string): Promise<void> {
    const normalizedUserId = String(userId);
    const encryptedToken = await this.#encrypt(token, normalizedUserId);
    await this.#database
      .prepare(
        `INSERT INTO user_tokens (user_id, encrypted_token, updated_at)
         VALUES (?, ?, unixepoch())
         ON CONFLICT (user_id) DO UPDATE SET
           encrypted_token = excluded.encrypted_token,
           updated_at = excluded.updated_at`
      )
      .bind(normalizedUserId, encryptedToken)
      .run();
  }

  async #decrypt(ciphertext: string, userId: string): Promise<string> {
    try {
      const payload = Uint8Array.fromBase64(ciphertext, {
        alphabet: "base64url",
      });
      if (payload.byteLength <= IV_BYTES + TAG_BYTES) {
        throw new Error("Encrypted token is malformed");
      }
      const plaintext = await crypto.subtle.decrypt(
        {
          additionalData: encoder.encode(userId),
          iv: payload.subarray(0, IV_BYTES),
          name: "AES-GCM",
        },
        this.#key,
        payload.subarray(IV_BYTES)
      );
      return decoder.decode(plaintext);
    } catch (error) {
      throw new TokenIntegrityError("Stored token failed integrity check", {
        cause: error,
      });
    }
  }

  async #encrypt(token: string, userId: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          additionalData: encoder.encode(userId),
          iv,
          name: "AES-GCM",
        },
        this.#key,
        encoder.encode(token)
      )
    );
    const payload = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    payload.set(iv);
    payload.set(ciphertext, iv.byteLength);
    return payload.toBase64({ alphabet: "base64url", omitPadding: true });
  }
}

export async function createTokenStore(
  database: D1Database,
  masterKey: Uint8Array
): Promise<TokenStore> {
  return new TokenStore(database, await importKey(masterKey));
}
