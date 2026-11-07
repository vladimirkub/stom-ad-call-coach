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
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'trainee')),
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
CREATE TABLE IF NOT EXISTS legends (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  status TEXT NOT NULL CHECK (status IN ('analyzing', 'draft', 'failed', 'approved', 'archived')),
  version INTEGER,
  facts TEXT NOT NULL DEFAULT '[]',
  pages TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  approved_at INTEGER
);
CREATE TABLE IF NOT EXISTS usage (
  conversation_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  clinic_id INTEGER REFERENCES clinics(id),
  kind TEXT NOT NULL CHECK (kind IN ('patient', 'operator')),
  scenario_id TEXT,
  started_at INTEGER NOT NULL,
  duration_s INTEGER,
  cost_usd REAL,
  status TEXT,
  synced_at INTEGER,
  error TEXT
);
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  directions TEXT NOT NULL,
  facts TEXT NOT NULL,
  wishes TEXT,
  base_version INTEGER,
  comment TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS proposals_clinic ON proposals(clinic_id, status);
CREATE INDEX IF NOT EXISTS usage_user ON usage(user_id, started_at);
CREATE INDEX IF NOT EXISTS legends_clinic ON legends(clinic_id, status);
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
    // Columns added after the first release; ALTER only where an older database lacks them.
    const clinicCols = conn.prepare("PRAGMA table_info(clinics)").all() as { name: string }[];
    if (!clinicCols.some((c) => c.name === "sites")) conn.exec("ALTER TABLE clinics ADD COLUMN sites TEXT NOT NULL DEFAULT '[]'");
    if (!clinicCols.some((c) => c.name === "offers")) conn.exec("ALTER TABLE clinics ADD COLUMN offers TEXT NOT NULL DEFAULT ''");
    if (!clinicCols.some((c) => c.name === "directions")) conn.exec("ALTER TABLE clinics ADD COLUMN directions TEXT NOT NULL DEFAULT '[]'");
    if (!clinicCols.some((c) => c.name === "wishes")) conn.exec("ALTER TABLE clinics ADD COLUMN wishes TEXT NOT NULL DEFAULT ''");
    if (!clinicCols.some((c) => c.name === "former_doctors")) conn.exec("ALTER TABLE clinics ADD COLUMN former_doctors TEXT NOT NULL DEFAULT '[]'");
    // The manager's own facts (what the site does not say), kept across rebuilds; and whether the manager sets the clinic
    // up alone (lib/clinic-setup.ts) or proposes changes for the owner's approval (lib/proposals.ts).
    if (!clinicCols.some((c) => c.name === "own_facts")) conn.exec("ALTER TABLE clinics ADD COLUMN own_facts TEXT NOT NULL DEFAULT '[]'");
    if (!clinicCols.some((c) => c.name === "autonomous")) conn.exec("ALTER TABLE clinics ADD COLUMN autonomous INTEGER NOT NULL DEFAULT 1");
    // A trial clinic's access ends at this moment (ms); NULL keeps access open. Set when a request is approved (lib/leads.ts).
    if (!clinicCols.some((c) => c.name === "access_until")) conn.exec("ALTER TABLE clinics ADD COLUMN access_until INTEGER");
    const usageCols = conn.prepare("PRAGMA table_info(usage)").all() as { name: string }[];
    if (!usageCols.some((c) => c.name === "error")) conn.exec("ALTER TABLE usage ADD COLUMN error TEXT");
    const proposalCols = conn.prepare("PRAGMA table_info(proposals)").all() as { name: string }[];
    if (!proposalCols.some((c) => c.name === "wishes")) conn.exec("ALTER TABLE proposals ADD COLUMN wishes TEXT");
    if (!proposalCols.some((c) => c.name === "former_doctors")) conn.exec("ALTER TABLE proposals ADD COLUMN former_doctors TEXT");
    // The clinic manager role (Nov 2026): SQLite cannot widen a CHECK, so an older users table is rebuilt once, and each
    // clinic's shared "admin.<clinic>" account, which managers already use, becomes the manager.
    const usersSql = (conn.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as { sql: string }).sql;
    if (!usersSql.includes("'manager'")) {
      conn.exec("PRAGMA foreign_keys = OFF");
      conn.exec("BEGIN");
      try {
        conn.exec(usersSql.replace("CREATE TABLE users", "CREATE TABLE users_new").replace("IN ('owner', 'trainee')", "IN ('owner', 'manager', 'trainee')"));
        conn.exec("INSERT INTO users_new SELECT * FROM users; DROP TABLE users; ALTER TABLE users_new RENAME TO users;");
        conn.exec("CREATE INDEX IF NOT EXISTS users_clinic ON users(clinic_id)");
        conn.exec("UPDATE users SET role = 'manager' WHERE role = 'trainee' AND (login GLOB 'admin.*' OR login GLOB 'admin[0-9]*.*')");
        conn.exec("COMMIT");
      } catch (e) {
        conn.exec("ROLLBACK");
        throw e;
      } finally {
        conn.exec("PRAGMA foreign_keys = ON");
      }
    }
    const trainingCols = conn.prepare("PRAGMA table_info(trainings)").all() as { name: string }[];
    if (!trainingCols.some((c) => c.name === "direction")) conn.exec("ALTER TABLE trainings ADD COLUMN direction TEXT NOT NULL DEFAULT 'outbound'");
    const legendCols = conn.prepare("PRAGMA table_info(legends)").all() as { name: string }[];
    if (!legendCols.some((c) => c.name === "personas")) {
      conn.exec("ALTER TABLE legends ADD COLUMN personas TEXT NOT NULL DEFAULT '{}'");
      conn.exec("ALTER TABLE legends ADD COLUMN personas_status TEXT");
      conn.exec("ALTER TABLE legends ADD COLUMN personas_error TEXT");
    }
    // Who started a legend version (an analysis or a rollback) and approved it, for the history and the daily limit.
    // Each rebuild a clinic manager starts, for the daily limit (a discarded draft still read the sites).
    conn.exec("CREATE TABLE IF NOT EXISTS rebuilds (id INTEGER PRIMARY KEY, clinic_id INTEGER NOT NULL REFERENCES clinics(id), started_at INTEGER NOT NULL)");
    if (!legendCols.some((c) => c.name === "origin")) conn.exec("ALTER TABLE legends ADD COLUMN origin TEXT NOT NULL DEFAULT 'owner'");
    if (!legendCols.some((c) => c.name === "author")) conn.exec("ALTER TABLE legends ADD COLUMN author TEXT NOT NULL DEFAULT ''");
    if (!legendCols.some((c) => c.name === "note")) conn.exec("ALTER TABLE legends ADD COLUMN note TEXT NOT NULL DEFAULT ''");
    // Connection requests from the Telegram bot (lib/leads.ts), and small key-value settings (the owner's Telegram chat).
    conn.exec(`CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      chat_id TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      step TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      clinic TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      site TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('filling', 'new', 'approved', 'rejected')),
      checks TEXT,
      clinic_id INTEGER REFERENCES clinics(id),
      user_id INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      decided_at INTEGER
    )`);
    conn.exec("CREATE INDEX IF NOT EXISTS leads_chat ON leads(chat_id, status)");
    conn.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    // One voice call at a time per login (lib/call-lock.ts): the lock of the call in progress, until it ends or expires.
    conn.exec("CREATE TABLE IF NOT EXISTS call_locks (user_id INTEGER PRIMARY KEY REFERENCES users(id), token TEXT NOT NULL, started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)");
    const lockCols = conn.prepare("PRAGMA table_info(call_locks)").all() as { name: string }[];
    if (!lockCols.some((c) => c.name === "ip")) conn.exec("ALTER TABLE call_locks ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
    // Where each sign-in came from, for the owner's alerts about shared logins (lib/alerts.ts).
    const sessionCols = conn.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
    if (!sessionCols.some((c) => c.name === "ip")) conn.exec("ALTER TABLE sessions ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
    g.__coachDb = conn;
  }
  return g.__coachDb;
}
