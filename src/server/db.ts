import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AuthUser, ConnectedProvider } from '../types/auth.ts';
import type { ReelEvaluation } from '../types/evaluation.ts';
import {
  generateOpaqueToken,
  hashToken,
  normalizeEmail,
} from './authLogic.ts';

export type OAuthProviderName = 'google';

interface DbUserRow {
  id: string;
  email: string;
  email_verified: number;
  name: string;
  avatar_url: string | null;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface DbIdentityRow {
  id: string;
  user_id: string;
  provider: OAuthProviderName;
  provider_user_id: string;
  provider_email: string | null;
  is_private_relay: number;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface DbOAuthStateRow {
  state: string;
  provider: OAuthProviderName;
  mode: 'login' | 'link';
  user_id: string | null;
  nonce: string;
  code_verifier: string;
  redirect_uri: string;
  expires_at: string;
}

export class AppDatabase {
  private db: DatabaseSync;

  constructor(dbFilePath?: string) {
    if (dbFilePath && dbFilePath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    }
    this.db = new DatabaseSync(dbFilePath || ':memory:');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        email_verified INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL,
        avatar_url TEXT,
        password_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
        provider_user_id TEXT NOT NULL,
        provider_email TEXT,
        is_private_relay INTEGER NOT NULL DEFAULT 0,
        display_name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(provider, provider_user_id),
        UNIQUE(user_id, provider),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
        mode TEXT NOT NULL CHECK (mode IN ('login', 'link')),
        user_id TEXT,
        nonce TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_handoffs (
        code_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        overall_score REAL NOT NULL,
        file_name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_evaluations_user_created
        ON evaluations(user_id, created_at DESC);
    `);
  }

  getUserById(userId: string): DbUserRow | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as DbUserRow | undefined;
    return row ?? null;
  }

  getUserByEmail(email: string): DbUserRow | null {
    const normalized = normalizeEmail(email);
    const row = this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(normalized) as DbUserRow | undefined;
    return row ?? null;
  }

  createUser(params: {
    email: string;
    emailVerified: boolean;
    name: string;
    avatarUrl?: string | null;
    passwordHash?: string | null;
  }): DbUserRow {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalized = normalizeEmail(params.email);
    const cleanName = (params.name || '').trim() || normalized.split('@')[0] || 'User';

    this.db
      .prepare(
        `INSERT INTO users (id, email, email_verified, name, avatar_url, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        normalized,
        params.emailVerified ? 1 : 0,
        cleanName.slice(0, 120),
        params.avatarUrl ?? null,
        params.passwordHash ?? null,
        now,
        now
      );

    return this.getUserById(id)!;
  }

  updateUserProfile(
    userId: string,
    updates: { name?: string; avatarUrl?: string | null; emailVerified?: boolean }
  ): void {
    const existing = this.getUserById(userId);
    if (!existing) return;
    const now = new Date().toISOString();
    const name =
      typeof updates.name === 'string' && updates.name.trim()
        ? updates.name.trim().slice(0, 120)
        : existing.name;
    const avatarUrl =
      updates.avatarUrl !== undefined ? updates.avatarUrl : existing.avatar_url;
    const emailVerified =
      updates.emailVerified !== undefined
        ? updates.emailVerified
          ? 1
          : 0
        : existing.email_verified;

    this.db
      .prepare(
        `UPDATE users SET name = ?, avatar_url = ?, email_verified = ?, updated_at = ? WHERE id = ?`
      )
      .run(name, avatarUrl, emailVerified, now, userId);
  }

  updateUserPassword(userId: string, passwordHash: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .run(passwordHash, now, userId);
  }

  findOAuthIdentity(
    provider: OAuthProviderName,
    providerUserId: string
  ): DbIdentityRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM oauth_identities WHERE provider = ? AND provider_user_id = ?`
      )
      .get(provider, providerUserId) as DbIdentityRow | undefined;
    return row ?? null;
  }

  listOAuthIdentitiesForUser(userId: string): DbIdentityRow[] {
    return this.db
      .prepare(`SELECT * FROM oauth_identities WHERE user_id = ? ORDER BY created_at ASC`)
      .all(userId) as unknown as DbIdentityRow[];
  }

  upsertOAuthIdentity(params: {
    userId: string;
    provider: OAuthProviderName;
    providerUserId: string;
    providerEmail: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  }): void {
    const existingForUserProvider = this.db
      .prepare(
        `SELECT id FROM oauth_identities WHERE user_id = ? AND provider = ?`
      )
      .get(params.userId, params.provider) as { id: string } | undefined;

    if (existingForUserProvider) {
      this.db
        .prepare(
          `UPDATE oauth_identities
           SET provider_user_id = ?, provider_email = ?, is_private_relay = 0, display_name = ?, avatar_url = ?
           WHERE id = ?`
        )
        .run(
          params.providerUserId,
          params.providerEmail ? normalizeEmail(params.providerEmail) : null,
          params.displayName ?? null,
          params.avatarUrl ?? null,
          existingForUserProvider.id
        );
      return;
    }

    this.db
      .prepare(
        `INSERT INTO oauth_identities
         (id, user_id, provider, provider_user_id, provider_email, is_private_relay, display_name, avatar_url, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        params.userId,
        params.provider,
        params.providerUserId,
        params.providerEmail ? normalizeEmail(params.providerEmail) : null,
        params.displayName ?? null,
        params.avatarUrl ?? null,
        new Date().toISOString()
      );
  }

  removeOAuthIdentity(userId: string, provider: OAuthProviderName): boolean {
    const result = this.db
      .prepare(`DELETE FROM oauth_identities WHERE user_id = ? AND provider = ?`)
      .run(userId, provider);
    return Number(result.changes) > 0;
  }

  getAuthUserProfile(userId: string): AuthUser | null {
    const user = this.getUserById(userId);
    if (!user) return null;

    const identities = this.listOAuthIdentitiesForUser(userId);
    const connectedProviders: ConnectedProvider[] = [];

    if (user.password_hash) {
      connectedProviders.push({
        provider: 'password',
        email: user.email,
        displayName: user.name,
        connectedAt: user.created_at,
      });
    }

    for (const identity of identities) {
      if (identity.provider !== 'google') continue;
      connectedProviders.push({
        provider: identity.provider,
        email: identity.provider_email,
        displayName: identity.display_name,
        connectedAt: identity.created_at,
      });
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.email_verified),
      name: user.name,
      avatarUrl: user.avatar_url,
      hasPassword: Boolean(user.password_hash),
      connectedProviders,
      createdAt: user.created_at,
    };
  }

  createSession(userId: string, ttlDays = 7): string {
    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(tokenHash, userId, expiresAt, now.toISOString());

    return rawToken;
  }

  getSessionUser(rawToken: string | undefined | null): AuthUser | null {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);
    const row = this.db
      .prepare(`SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`)
      .get(tokenHash) as { user_id: string; expires_at: string } | undefined;
    if (!row) return null;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
      return null;
    }

    return this.getAuthUserProfile(row.user_id);
  }

  deleteSession(rawToken: string | undefined | null): void {
    if (!rawToken) return;
    this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(rawToken));
  }

  createOAuthState(params: {
    provider: OAuthProviderName;
    mode: 'login' | 'link';
    userId: string | null;
    nonce: string;
    codeVerifier: string;
    redirectUri: string;
    ttlMinutes?: number;
  }): string {
    const state = generateOpaqueToken(24);
    const expiresAt = new Date(
      Date.now() + (params.ttlMinutes ?? 10) * 60 * 1000
    ).toISOString();

    // Opportunistic cleanup of expired OAuth states
    this.db
      .prepare(`DELETE FROM oauth_states WHERE expires_at <= ?`)
      .run(new Date().toISOString());

    this.db
      .prepare(
        `INSERT INTO oauth_states
         (state, provider, mode, user_id, nonce, code_verifier, redirect_uri, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        state,
        params.provider,
        params.mode,
        params.userId,
        params.nonce,
        params.codeVerifier,
        params.redirectUri,
        expiresAt
      );

    return state;
  }

  consumeOAuthState(
    state: string,
    provider: OAuthProviderName
  ): DbOAuthStateRow | null {
    const row = this.db
      .prepare(`SELECT * FROM oauth_states WHERE state = ? AND provider = ?`)
      .get(state, provider) as DbOAuthStateRow | undefined;

    if (row) {
      this.db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);
    }

    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }
    return row;
  }

  createOAuthHandoff(userId: string): string {
    const rawCode = generateOpaqueToken(24);
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    this.db
      .prepare(`DELETE FROM oauth_handoffs WHERE expires_at <= ?`)
      .run(new Date().toISOString());
    this.db
      .prepare(`INSERT INTO oauth_handoffs (code_hash, user_id, expires_at) VALUES (?, ?, ?)`)
      .run(hashToken(rawCode), userId, expiresAt);
    return rawCode;
  }

  consumeOAuthHandoff(rawCode: string): string | null {
    const codeHash = hashToken(rawCode);
    const row = this.db
      .prepare(`SELECT user_id, expires_at FROM oauth_handoffs WHERE code_hash = ?`)
      .get(codeHash) as { user_id: string; expires_at: string } | undefined;
    if (row) {
      this.db.prepare(`DELETE FROM oauth_handoffs WHERE code_hash = ?`).run(codeHash);
    }
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }
    return row.user_id;
  }

  createPasswordResetToken(userId: string, ttlMinutes = 30): string {
    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

    this.db
      .prepare(
        `INSERT INTO password_resets (token_hash, user_id, expires_at, used_at, created_at)
         VALUES (?, ?, ?, NULL, ?)`
      )
      .run(tokenHash, userId, expiresAt, now.toISOString());

    return rawToken;
  }

  consumePasswordResetToken(rawToken: string): { userId: string } | null {
    const tokenHash = hashToken(rawToken);
    const row = this.db
      .prepare(`SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?`)
      .get(tokenHash) as
      | { user_id: string; expires_at: string; used_at: string | null }
      | undefined;

    if (!row || row.used_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;

    this.db
      .prepare(`UPDATE password_resets SET used_at = ? WHERE token_hash = ?`)
      .run(new Date().toISOString(), tokenHash);

    return { userId: row.user_id };
  }

  saveEvaluationForUser(userId: string, evaluation: ReelEvaluation): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO evaluations (id, user_id, created_at, overall_score, file_name, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        evaluation.id,
        userId,
        evaluation.createdAt,
        evaluation.overallScore,
        evaluation.videoMetadata.fileName,
        JSON.stringify(evaluation)
      );
  }

  listEvaluationsForUser(userId: string, limit = 30): ReelEvaluation[] {
    const rows = this.db
      .prepare(
        `SELECT payload_json FROM evaluations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(userId, limit) as { payload_json: string }[];

    const results: ReelEvaluation[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as ReelEvaluation;
        if (parsed && parsed.schemaVersion === 2) {
          results.push(parsed);
        }
      } catch {
        // Ignore malformed historical records
      }
    }
    return results;
  }

  deleteEvaluationForUser(userId: string, evaluationId: string): boolean {
    const res = this.db
      .prepare(`DELETE FROM evaluations WHERE id = ? AND user_id = ?`)
      .run(evaluationId, userId);
    return Number(res.changes) > 0;
  }

  clearEvaluationsForUser(userId: string): void {
    this.db.prepare(`DELETE FROM evaluations WHERE user_id = ?`).run(userId);
  }
}

let singletonDb: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (!singletonDb) {
    const dbPath =
      process.env.DATABASE_PATH?.trim() ||
      path.resolve(process.cwd(), 'data', 'reelsevaluator.db');
    singletonDb = new AppDatabase(dbPath);
  }
  return singletonDb;
}
