CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  subscription TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_test_at INTEGER
);
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  due_at INTEGER NOT NULL,
  state TEXT NOT NULL,
  status_code INTEGER
);
CREATE TABLE service_state (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE pair_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL);
