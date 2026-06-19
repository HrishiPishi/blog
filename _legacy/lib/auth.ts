import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { db } from './db';

// ---- password hashing (scrypt) --------------------------------------------
const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, expected.length, SCRYPT_PARAMS);
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// ---- sessions -------------------------------------------------------------
export const SESSION_COOKIE = 'hm_session';
export const CSRF_COOKIE = 'hm_csrf';
const SESSION_TTL_DAYS = 14;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export interface SessionUser {
  id: number;
  username: string;
}

export function createSession(userId: number, ua: string | null, ip: string | null): string {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();
  db()
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)'
    )
    .run(sha256(token), userId, expires, ua, ip);
  return token;
}

export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id as id, u.username as username, s.expires_at as expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
    )
    .get(sha256(token)) as { id: number; username: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, username: row.username };
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function pruneSessions(): void {
  db().prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// ---- CSRF (double-submit token) -------------------------------------------
export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function csrfValid(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- login rate limiting --------------------------------------------------
const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export function isLockedOut(ip: string): boolean {
  const row = db().prepare('SELECT locked_until FROM login_attempts WHERE ip = ?').get(ip) as
    | { locked_until: string | null }
    | undefined;
  if (!row?.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}

export function recordFailedLogin(ip: string): void {
  const d = db();
  const row = d.prepare('SELECT count FROM login_attempts WHERE ip = ?').get(ip) as
    | { count: number }
    | undefined;
  const count = (row?.count ?? 0) + 1;
  const lockedUntil =
    count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  d.prepare(
    `INSERT INTO login_attempts (ip, count, locked_until) VALUES (?, ?, ?)
     ON CONFLICT(ip) DO UPDATE SET count=excluded.count, locked_until=excluded.locked_until`
  ).run(ip, count, lockedUntil);
}

export function clearLoginAttempts(ip: string): void {
  db().prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}

// ---- user helpers ---------------------------------------------------------
export function userCount(): number {
  const row = db().prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
  return row.n;
}

export function getUserByName(username: string): { id: number; password_hash: string } | null {
  return (
    (db()
      .prepare('SELECT id, password_hash FROM users WHERE username = ?')
      .get(username) as { id: number; password_hash: string } | undefined) ?? null
  );
}

export function createUser(username: string, password: string): number {
  const info = db()
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run(username, hashPassword(password));
  return Number(info.lastInsertRowid);
}
