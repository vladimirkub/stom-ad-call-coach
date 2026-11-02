import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// An older database: users allow only owner and trainee, the clinic's shared account is a trainee "admin.lux".
const path = join(mkdtempSync(join(tmpdir(), "coach-")), "old.db");
const old = new DatabaseSync(path);
old.exec(`CREATE TABLE clinics (id INTEGER PRIMARY KEY, legal_name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, city TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE users (id INTEGER PRIMARY KEY, clinic_id INTEGER REFERENCES clinics(id), role TEXT NOT NULL CHECK (role IN ('owner', 'trainee')),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, login TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL, pass_enc TEXT, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
INSERT INTO clinics VALUES (1, 'ООО «Люкс»', 'lux', 'Пермь', 0);
INSERT INTO users VALUES (1, 1, 'trainee', 'Клиника', 'Админ', 'admin.lux', 'x', NULL, 1, 0);
INSERT INTO users VALUES (2, 1, 'trainee', 'Анна', 'Иванова', 'ivanova.lux', 'x', NULL, 1, 0);
INSERT INTO sessions VALUES ('h', 1, 0, 9999999999999);`);
old.close();

process.env.DB_PATH = path;
process.env.PASSWORD_KEY = "test-password-key-test-password-key-0123";
const auth = await import("../lib/auth.ts");
const { db } = await import("../lib/db.ts");
const { clinicStats, userStats, trainingDetail } = await import("../lib/stats.ts");
const { usageReport } = await import("../lib/usage.ts");
const { saveTraining, parseAttempt } = await import("../lib/trainings.ts");

test("an older database gains the manager role and its admin.<clinic> account becomes the manager", () => {
  const roles = Object.fromEntries(db().prepare("SELECT login, role FROM users").all().map((u) => [u.login, u.role]));
  assert.deepEqual(roles, { "admin.lux": "manager", "ivanova.lux": "trainee" });
  assert.equal(db().prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.equal(db().prepare("SELECT user_id FROM sessions").get().user_id, 1, "sessions still point at the user");
});

test("the owner can make an account the manager and back; managers stay out of the team figures but cost money", () => {
  const now = Date.now();
  const save = (userId, n) =>
    saveTraining({
      attempt: parseAttempt({ id: `00000000-0000-4000-8000-00000000000${n}`, mode: "text", startedAt: now - 1000, live: [] }, now),
      userId, clinicId: 1, scenarioId: "elena", transcript: [{ role: "user", text: "Алло" }],
      result: { total: 50, scores: {}, appointmentBooked: false, checklist: [] }, now,
    });
  save(1, 1);
  save(2, 2);
  const team = clinicStats(1, now);
  assert.deepEqual(team.users.map((u) => u.login), ["ivanova.lux"]);
  assert.equal(team.calls30, 1);
  const list = auth.listTrainees(1);
  assert.equal(list[0].login, "admin.lux", "the manager is listed first");
  assert.equal(list[0].manager, true);
  assert.equal(usageReport(now).clinics[0].text30, 2, "the manager's training still counts in usage");
  assert.equal(usageReport(now).clinics[0].seats, 1);

  auth.setRole(2, "manager");
  assert.equal(clinicStats(1, now).users.length, 0);
  auth.setRole(2, "trainee");
  assert.equal(clinicStats(1, now).users.length, 1);
  assert.throws(() => auth.setRole(999, "manager"));
});

test("the cabinet's checks have what they need: whose clinic an administrator and a call belong to", () => {
  assert.equal(userStats(2).user.clinicId, 1);
  assert.equal(trainingDetail("00000000-0000-4000-8000-000000000002").clinicId, 1);
  assert.equal(trainingDetail("00000000-0000-4000-8000-000000000002").direction, "outbound");
});
