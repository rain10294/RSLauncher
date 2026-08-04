PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS whitelist_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  uuid TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  note TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (server_id, uuid),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_whitelist_server_enabled
  ON whitelist_entries(server_id, enabled);

CREATE INDEX IF NOT EXISTS idx_whitelist_username
  ON whitelist_entries(username COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
