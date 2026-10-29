// Accounts: the owner creates clinics and trainees, logins and passwords are generated here.
// Passwords are stored twice: a scrypt hash to check logins, and an AES-256-GCM copy so the owner can see them in the
// admin panel. PASSWORD_KEY lives outside the app directory and the database, so a leaked database reveals no password.
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db.ts";

export const SESSION_COOKIE = "coach_session";
export const SESSION_DAYS = 30;
const SETUP_TTL_MS = 60 * 60 * 1000;

export type Role = "owner" | "trainee";
export type SessionUser = {
  id: number;
  role: Role;
  firstName: string;
  lastName: string;
  login: string;
  clinic: { id: number; legalName: string; slug: string; city: string } | null;
};

// ---- generated credentials ----

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};

/** "Кублашвили" -> "kublashvili"; keeps only a-z and 0-9. */
export function translit(s: string): string {
  return [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join("").replace(/[^a-z0-9]/g, "");
}

/** Clinic short name for logins: latin letters and digits, 2-20 chars. */
export function normalizeSlug(s: string): string {
  return translit(s).slice(0, 20);
}

/** "ivanova.stomlux", then "ivanova2.stomlux" if taken. */
export function makeLogin(lastName: string, clinicSlug: string, taken: (login: string) => boolean): string {
  const base = translit(lastName).slice(0, 20) || "user";
  for (let n = 1; ; n++) {
    const login = `${n === 1 ? base : base + n}.${clinicSlug}`;
    if (!taken(login)) return login;
  }
}

// No 0/O, 1/l/I: the password is read off a screen and typed by hand.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makePassword(length = 12): string {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}

// ---- hashing and encryption ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 32).toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

function passwordKey(): Buffer {
  const secret = process.env.PASSWORD_KEY;
  if (!secret || secret.length < 32) throw new Error("PASSWORD_KEY is not configured on the server");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", passwordKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decryptSecret(sealed: string): string | null {
  try {
    const buf = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", passwordKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---- clinics and users ----

export function createClinic(input: { legalName: string; slug: string; city: string }) {
  const slug = normalizeSlug(input.slug);
  if (slug.length < 2) throw new Error("Короткое название: минимум 2 латинские буквы или цифры");
  const legalName = input.legalName.trim();
  const city = input.city.trim();
  if (!legalName || !city) throw new Error("Заполните юридическое название и город");
  if (db().prepare("SELECT 1 FROM clinics WHERE slug = ?").get(slug)) throw new Error(`Короткое название «${slug}» уже занято`);
  const r = db().prepare("INSERT INTO clinics (legal_name, slug, city, created_at) VALUES (?, ?, ?, ?)").run(legalName, slug, city, Date.now());
  return Number(r.lastInsertRowid);
}

/** Creates a trainee with a generated login and password; returns both so the owner can send them. */
export function createTrainee(input: { clinicId: number; firstName: string; lastName: string }) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) throw new Error("Заполните имя и фамилию");
  const clinic = db().prepare("SELECT slug FROM clinics WHERE id = ?").get(input.clinicId) as { slug: string } | undefined;
  if (!clinic) throw new Error("Клиника не найдена");
  const taken = db().prepare("SELECT 1 FROM users WHERE login = ?");
  const login = makeLogin(lastName, clinic.slug, (l) => !!taken.get(l));
  const password = makePassword();
  const r = db()
    .prepare("INSERT INTO users (clinic_id, role, first_name, last_name, login, pass_hash, pass_enc, created_at) VALUES (?, 'trainee', ?, ?, ?, ?, ?, ?)")
    .run(input.clinicId, firstName, lastName, login, hashPassword(password), encryptSecret(password), Date.now());
  return { id: Number(r.lastInsertRowid), login, password };
}

export function resetPassword(userId: number): string {
  const password = makePassword();
  const r = db().prepare("UPDATE users SET pass_hash = ?, pass_enc = ? WHERE id = ? AND role = 'trainee'").run(hashPassword(password), encryptSecret(password), userId);
  if (!r.changes) throw new Error("Пользователь не найден");
  db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return password;
}

export function setActive(userId: number, active: boolean) {
  const r = db().prepare("UPDATE users SET active = ? WHERE id = ? AND role = 'trainee'").run(active ? 1 : 0, userId);
  if (!r.changes) throw new Error("Пользователь не найден");
  if (!active) db().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

// ---- login and sessions ----

export type LoginResult = { ok: true; token: string } | { ok: false; reason: "invalid" | "disabled" };

export function login(loginName: string, password: string): LoginResult {
  const u = db().prepare("SELECT id, pass_hash, active FROM users WHERE login = ?").get(loginName.trim().toLowerCase()) as
    | { id: number; pass_hash: string; active: number }
    | undefined;
  // Hash anyway on an unknown login, so response time does not reveal which logins exist.
  if (!u) return verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), { ok: false, reason: "invalid" };
  if (!verifyPassword(password, u.pass_hash)) return { ok: false, reason: "invalid" };
  if (!u.active) return { ok: false, reason: "disabled" };
  return { ok: true, token: createSession(u.id) };
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db().prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(sha256(token), userId, now, now + SESSION_DAYS * 864e5);
  return token;
}

export function endSession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

/** The signed-in, active user for a session token, or null. Disabling a user or resetting the password ends access at once. */
export function sessionUser(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id, u.role, u.first_name, u.last_name, u.login, c.id AS cid, c.legal_name, c.slug, c.city
       FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN clinics c ON c.id = u.clinic_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .get(sha256(token), Date.now()) as Record<string, string | number | null> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    role: row.role as Role,
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    login: String(row.login),
    clinic: row.cid == null ? null : { id: Number(row.cid), legalName: String(row.legal_name), slug: String(row.slug), city: String(row.city) },
  };
}

// ---- owner setup (one-time link, the owner picks the password; nobody else ever sees it) ----

export const OWNER_LOGIN = "admin";

export function ownerExists(): boolean {
  return !!db().prepare("SELECT 1 FROM users WHERE role = 'owner'").get();
}

/** Returns a one-hour setup token, or null if the owner already exists. */
export function createSetupToken(): string | null {
  if (ownerExists()) return null;
  const token = randomBytes(24).toString("base64url");
  db().prepare("DELETE FROM setup_tokens WHERE expires_at < ?").run(Date.now());
  db().prepare("INSERT INTO setup_tokens (token_hash, expires_at) VALUES (?, ?)").run(sha256(token), Date.now() + SETUP_TTL_MS);
  return token;
}

export function setupOwner(token: string, password: string, name: { firstName: string; lastName: string }): string {
  if (password.length < 12) throw new Error("Пароль должен быть не короче 12 символов");
  const conn = db();
  const t = conn.prepare("SELECT 1 FROM setup_tokens WHERE token_hash = ? AND expires_at > ?").get(sha256(token), Date.now());
  if (!t || ownerExists()) throw new Error("Ссылка недействительна или уже использована");
  conn.prepare("DELETE FROM setup_tokens").run();
  const r = conn
    .prepare("INSERT INTO users (clinic_id, role, first_name, last_name, login, pass_hash, pass_enc, created_at) VALUES (NULL, 'owner', ?, ?, ?, ?, NULL, ?)")
    .run(name.firstName.trim() || "Владелец", name.lastName.trim() || "", OWNER_LOGIN, hashPassword(password), Date.now());
  return createSession(Number(r.lastInsertRowid));
}

// ---- admin listings ----

export function listClinics() {
  return db()
    .prepare(
      `SELECT c.id, c.legal_name AS legalName, c.slug, c.city, c.created_at AS createdAt,
              COUNT(u.id) AS users, SUM(u.active) AS activeUsers,
              (SELECT version FROM legends l WHERE l.clinic_id = c.id AND l.status = 'approved') AS legendVersion
       FROM clinics c LEFT JOIN users u ON u.clinic_id = c.id GROUP BY c.id ORDER BY c.legal_name`,
    )
    .all() as { id: number; legalName: string; slug: string; city: string; createdAt: number; users: number; activeUsers: number | null; legendVersion: number | null }[];
}

export function listTrainees(clinicId: number) {
  const rows = db()
    .prepare("SELECT id, first_name AS firstName, last_name AS lastName, login, pass_enc, active, created_at AS createdAt FROM users WHERE clinic_id = ? AND role = 'trainee' ORDER BY last_name, first_name")
    .all(clinicId) as { id: number; firstName: string; lastName: string; login: string; pass_enc: string | null; active: number; createdAt: number }[];
  return rows.map(({ pass_enc, active, ...r }) => ({ ...r, active: !!active, password: pass_enc ? decryptSecret(pass_enc) : null }));
}
