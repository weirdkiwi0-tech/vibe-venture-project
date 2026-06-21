import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { UserRole } from './roles';

interface GoogleProfileInput {
  googleId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

interface LocalAccountInput {
  email: string;
  password: string;
  displayName: string;
  photoUrl?: string;
}

interface AuthUser {
  id: string;
  googleId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  banned_until?: string | null;
}

interface UserRow {
  id: string;
  google_id: string | null;
  email: string;
  display_name: string;
  photo_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  banned_until: string | null;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  created_at: string;
}

const DEFAULT_PROFILE_PHOTO_URL = '/default-profile.svg';

@Injectable()
export class AuthService {
  private readonly db: Database.Database;

  constructor() {
    const dbPath = resolve(
      process.env.AUTH_DB_PATH ?? `${process.cwd()}/data/keepit-auth.sqlite`,
    );
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_id TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        photo_url TEXT,
        role TEXT NOT NULL,
        banned_until TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_accounts (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);

    const userColumns = this.db
      .prepare('PRAGMA table_info(users)')
      .all() as Array<{ name: string }>;
    const hasBannedUntil = userColumns.some((column) => column.name === 'banned_until');
    if (!hasBannedUntil) {
      this.db.exec('ALTER TABLE users ADD COLUMN banned_until TEXT');
    }
  }

  private getBanInfo(user: Pick<AuthUser, 'banned_until'>): {
    isBanned: boolean;
    bannedUntil: string | null;
    remainingSeconds: number;
  } {
    if (!user.banned_until) {
      return { isBanned: false, bannedUntil: null, remainingSeconds: 0 };
    }

    const bannedUntilDate = new Date(user.banned_until);
    const remainingMs = bannedUntilDate.getTime() - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return { isBanned: false, bannedUntil: null, remainingSeconds: 0 };
    }

    return {
      isBanned: true,
      bannedUntil: bannedUntilDate.toISOString(),
      remainingSeconds: Math.ceil(remainingMs / 1000),
    };
  }

  getBanInfoByUserId(userId: string): {
    isBanned: boolean;
    bannedUntil: string | null;
    remainingSeconds: number;
  } {
    const user = this.getUserById(userId);
    if (!user) {
      return { isBanned: false, bannedUntil: null, remainingSeconds: 0 };
    }
    return this.getBanInfo(user);
  }

  private toAuthUser(row: UserRow): AuthUser {
    return {
      id: row.id,
      googleId: row.google_id ?? '',
      email: row.email,
      displayName: row.display_name,
      photoUrl: row.photo_url ?? undefined,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      banned_until: row.banned_until ?? null,
    };
  }

  private resolveRoleByEmail(email: string): UserRole {
    const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);

    return adminEmails.includes(email.trim().toLowerCase()) ? 'admin' : 'user';
  }

  signUpLocal(input: LocalAccountInput): { user: AuthUser; isNewUser: boolean } {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const existing = this.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email) as { id: string } | undefined;

    if (existing) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    const role = this.resolveRoleByEmail(email);
    const now = new Date();
    const userId = `u_${randomUUID()}`;

    const user: AuthUser = {
      id: userId,
      googleId: '',
      email,
      displayName,
      photoUrl: input.photoUrl?.trim() || DEFAULT_PROFILE_PHOTO_URL,
      role,
      createdAt: now,
      updatedAt: now,
    };

    const insertUser = this.db.prepare(
      `INSERT INTO users (id, google_id, email, display_name, photo_url, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertLocal = this.db.prepare(
      `INSERT INTO local_accounts (user_id, email, password, created_at)
       VALUES (?, ?, ?, ?)`,
    );

    const tx = this.db.transaction(() => {
      insertUser.run(
        user.id,
        null,
        user.email,
        user.displayName,
        user.photoUrl ?? null,
        user.role,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString(),
      );
      insertLocal.run(user.id, user.email, input.password, user.createdAt.toISOString());
    });

    tx();

    return { user, isNewUser: true };
  }

  signInLocal(email: string, password: string): AuthUser {
    const emailLower = email.trim().toLowerCase();
    const row = this.db
      .prepare(
        `SELECT la.password, u.*
         FROM local_accounts la
         JOIN users u ON u.id = la.user_id
         WHERE la.email = ?`,
      )
      .get(emailLower) as (UserRow & { password: string }) | undefined;

    if (!row) {
      const existingUser = this.db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(emailLower) as { id: string } | undefined;

      if (existingUser) {
        throw new UnauthorizedException('이 계정은 비밀번호 로그인을 사용할 수 없습니다. 가입한 방식으로 다시 로그인해주세요.');
      }

      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (row.password !== password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const resolvedRole = this.resolveRoleByEmail(emailLower);
    if (row.role !== resolvedRole) {
      const nowIso = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE users
           SET role = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(resolvedRole, nowIso, row.id);

      row.role = resolvedRole;
      row.updated_at = nowIso;
    }

    const banInfo = this.getBanInfo(this.toAuthUser(row));
    if (banInfo.isBanned && banInfo.bannedUntil) {
      throw new UnauthorizedException(`이 계정은 밴 상태입니다. 해제 예정 시각: ${new Date(banInfo.bannedUntil).toLocaleString('ko-KR')}`);
    }

    return this.toAuthUser(row);
  }

  signInWithGoogle(profile: GoogleProfileInput): { user: AuthUser; isNewUser: boolean } {
    const email = profile.email.trim().toLowerCase();
    const role = this.resolveRoleByEmail(email);
    const now = new Date();

    const existingByGoogle = this.db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .get(profile.googleId) as UserRow | undefined;

    if (existingByGoogle) {
      const existingUser = this.toAuthUser(existingByGoogle);
      const banInfo = this.getBanInfo(existingUser);
      if (banInfo.isBanned && banInfo.bannedUntil) {
        throw new UnauthorizedException(`이 계정은 밴 상태입니다. 해제 예정 시각: ${new Date(banInfo.bannedUntil).toLocaleString('ko-KR')}`);
      }

      this.db
        .prepare(
          `UPDATE users
           SET email = ?, display_name = ?, photo_url = ?, role = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          email,
          profile.displayName,
          profile.photoUrl ?? null,
          role,
          now.toISOString(),
          existingByGoogle.id,
        );

      const updatedRow = this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(existingByGoogle.id) as UserRow;
      return { user: this.toAuthUser(updatedRow), isNewUser: false };
    }

    const existingByEmail = this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;

    if (existingByEmail) {
      const existingUser = this.toAuthUser(existingByEmail);
      const banInfo = this.getBanInfo(existingUser);
      if (banInfo.isBanned && banInfo.bannedUntil) {
        throw new UnauthorizedException(`이 계정은 밴 상태입니다. 해제 예정 시각: ${new Date(banInfo.bannedUntil).toLocaleString('ko-KR')}`);
      }

      this.db
        .prepare(
          `UPDATE users
           SET google_id = ?, display_name = ?, photo_url = ?, role = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          profile.googleId,
          profile.displayName,
          profile.photoUrl ?? null,
          role,
          now.toISOString(),
          existingByEmail.id,
        );

      const linkedRow = this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(existingByEmail.id) as UserRow;
      return { user: this.toAuthUser(linkedRow), isNewUser: false };
    }

    const user: AuthUser = {
      id: `u_${randomUUID()}`,
      googleId: profile.googleId,
      email,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl ?? DEFAULT_PROFILE_PHOTO_URL,
      role,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO users (id, google_id, email, display_name, photo_url, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        user.googleId,
        user.email,
        user.displayName,
        user.photoUrl ?? null,
        user.role,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString(),
      );

    return { user, isNewUser: true };
  }

  createSession(userId: string): string {
    const sessionId = `sess_${randomUUID()}`;
    const createdAt = new Date();
    this.db
      .prepare('INSERT INTO sessions (session_id, user_id, created_at) VALUES (?, ?, ?)')
      .run(sessionId, userId, createdAt.toISOString());

    return sessionId;
  }

  revokeSession(sessionId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
  }

  getUserBySessionId(sessionId: string | undefined): AuthUser | undefined {
    if (!sessionId) {
      return undefined;
    }

    const session = this.db
      .prepare('SELECT session_id, user_id, created_at FROM sessions WHERE session_id = ?')
      .get(sessionId) as SessionRow | undefined;
    if (!session) {
      return undefined;
    }

    const user = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(session.user_id) as UserRow | undefined;
    if (!user) {
      return undefined;
    }

    return this.toAuthUser(user);
  }

  getUserById(userId: string): AuthUser | undefined {
    const user = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(userId) as UserRow | undefined;

    if (!user) {
      return undefined;
    }

    return this.toAuthUser(user);
  }

  listUsers(): AuthUser[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY created_at DESC')
      .all() as UserRow[];
    return rows.map((row) => this.toAuthUser(row));
  }

  deleteUser(userId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM local_accounts WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  banUser(userId: string, banUntil: string): void {
    const bannedUntilDate = new Date(banUntil);
    if (!Number.isFinite(bannedUntilDate.getTime())) {
      throw new BadRequestException('유효한 밴 해제 시각을 입력해 주세요.');
    }

    if (bannedUntilDate.getTime() <= Date.now()) {
      throw new BadRequestException('밴 해제 시각은 현재 시각보다 이후여야 합니다.');
    }

    this.db
      .prepare('UPDATE users SET banned_until = ? WHERE id = ?')
      .run(bannedUntilDate.toISOString(), userId);
  }

  unbanUser(userId: string): void {
    this.db
      .prepare('UPDATE users SET banned_until = NULL WHERE id = ?')
      .run(userId);
  }

  updateUserRole(userId: string, role: UserRole): void {
    if (role !== 'user' && role !== 'admin') {
      throw new BadRequestException('유효하지 않은 역할입니다.');
    }

    const result = this.db
      .prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
      .run(role, new Date().toISOString(), userId);

    if (result.changes === 0) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }
  }
}
