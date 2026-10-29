// SQLite database for accounts, clinics and sessions (node:sqlite, no native dependency).
// One file next to the knowledge base: data/coach.db (gitignored, never uploaded by the deploy scripts).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clinics (
  id INTEGER PRIMARY KEY,
  legal_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER REFERENCES clinics(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'trainee')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  pass_enc TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS setup_tokens (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trainings (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  clinic_id INTEGER REFERENCES clinics(id),
  scenario_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('voice', 'text')),
  legend_version TEXT,
  started_at INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  ended_by TEXT,
  transcript TEXT NOT NULL,
  live_checklist TEXT NOT NULL,
  scores TEXT NOT NULL,
  total INTEGER NOT NULL,
  booked INTEGER NOT NULL,
  evaluation TEXT NOT NULL,
  evaluated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trainings_user ON trainings(user_id, started_at);
CREATE INDEX IF NOT EXISTS trainings_clinic ON trainings(clinic_id, started_at);
CREATE INDEX IF NOT EXISTS users_clinic ON users(clinic_id);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`;

const g = globalThis as { __coachDb?: DatabaseSync };

/** The shared connection; reused across hot reloads in dev. DB_PATH=":memory:" for tests. */
export function db(): DatabaseSync {
  if (!g.__coachDb) {
    const path = process.env.DB_PATH || join(process.cwd(), "data", "coach.db");
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const conn = new DatabaseSync(path);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
    conn.exec(SCHEMA);
    g.__coachDb = conn;
  }
  return g.__coachDb;
}
