DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS user_tokens;

CREATE TABLE user_tokens (
  user_id TEXT PRIMARY KEY NOT NULL CHECK (length(user_id) > 0),
  encrypted_token TEXT NOT NULL CHECK (length(encrypted_token) > 0),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (updated_at >= 0)
) STRICT, WITHOUT ROWID;

CREATE TABLE user_favorites (
  user_id TEXT NOT NULL CHECK (length(user_id) > 0),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('team', 'series')),
  entity_id INTEGER NOT NULL CHECK (entity_id > 0),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (created_at >= 0),
  PRIMARY KEY (user_id, entity_type, entity_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX user_favorites_user_created_idx
  ON user_favorites (user_id, created_at DESC);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY NOT NULL CHECK (length(user_id) > 0),
  language TEXT CHECK (language IS NULL OR language IN ('en', 'ru')),
  utc_offset_minutes INTEGER
    CHECK (utc_offset_minutes IS NULL OR utc_offset_minutes BETWEEN -720 AND 840),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (updated_at >= 0),
  CHECK (language IS NOT NULL OR utc_offset_minutes IS NOT NULL)
) STRICT, WITHOUT ROWID;
