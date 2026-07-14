DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS user_tokens;

CREATE TABLE user_tokens (
  user_id TEXT PRIMARY KEY NOT NULL,
  encrypted_token TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE user_favorites (
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('team', 'tournament')),
  entity_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE INDEX user_favorites_user_created_idx
  ON user_favorites (user_id, created_at DESC);
