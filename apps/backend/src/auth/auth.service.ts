import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TableClient } from '@azure/data-tables';
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

interface AuthStorage {
  signUpLocal(input: LocalAccountInput, role: UserRole): Promise<{ user: AuthUser; isNewUser: boolean }>;
  signInLocal(email: string, password: string, resolveRoleByEmail: (email: string) => UserRole): Promise<AuthUser>;
  signInWithGoogle(profile: GoogleProfileInput, role: UserRole): Promise<{ user: AuthUser; isNewUser: boolean }>;
  createSession(userId: string): Promise<string>;
  revokeSession(sessionId: string): Promise<void>;
  getUserBySessionId(sessionId: string | undefined): Promise<AuthUser | undefined>;
  getUserById(userId: string): Promise<AuthUser | undefined>;
  listUsers(): Promise<AuthUser[]>;
  deleteUser(userId: string): Promise<void>;
  banUser(userId: string, banUntil: string): Promise<void>;
  unbanUser(userId: string): Promise<void>;
  updateUserRole(userId: string, role: UserRole): Promise<void>;
}

const DEFAULT_PROFILE_PHOTO_URL = '/default-profile.svg';

function escapeOdataString(value: string): string {
  return value.replace(/'/g, "''");
}

async function firstEntity<T extends Record<string, unknown>>(iterable: AsyncIterable<T>): Promise<T | undefined> {
  for await (const item of iterable) {
    return item;
  }
  return undefined;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeStatus = (error as { statusCode?: number }).statusCode;
  return maybeStatus === 404;
}

class InMemoryAuthStorage implements AuthStorage {
  private readonly users = new Map<string, AuthUser>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly userIdByGoogleId = new Map<string, string>();
  private readonly localAccounts = new Map<string, { userId: string; password: string }>();
  private readonly sessions = new Map<string, string>();

  async signUpLocal(input: LocalAccountInput, role: UserRole): Promise<{ user: AuthUser; isNewUser: boolean }> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();

    if (this.userIdByEmail.has(email)) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    const now = new Date();
    const user: AuthUser = {
      id: `u_${randomUUID()}`,
      googleId: '',
      email,
      displayName,
      photoUrl: input.photoUrl?.trim() || DEFAULT_PROFILE_PHOTO_URL,
      role,
      createdAt: now,
      updatedAt: now,
      banned_until: null,
    };

    this.users.set(user.id, user);
    this.userIdByEmail.set(email, user.id);
    this.localAccounts.set(email, { userId: user.id, password: input.password });
    return { user: { ...user }, isNewUser: true };
  }

  async signInLocal(email: string, password: string, resolveRoleByEmail: (email: string) => UserRole): Promise<AuthUser> {
    const emailLower = email.trim().toLowerCase();
    const account = this.localAccounts.get(emailLower);

    if (!account) {
      if (this.userIdByEmail.has(emailLower)) {
        throw new UnauthorizedException('이 계정은 비밀번호 로그인을 사용할 수 없습니다. 가입한 방식으로 다시 로그인해주세요.');
      }
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (account.password !== password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const user = this.users.get(account.userId);
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const resolvedRole = resolveRoleByEmail(emailLower);
    if (user.role !== resolvedRole) {
      user.role = resolvedRole;
      user.updatedAt = new Date();
    }

    return { ...user };
  }

  async signInWithGoogle(profile: GoogleProfileInput, role: UserRole): Promise<{ user: AuthUser; isNewUser: boolean }> {
    const email = profile.email.trim().toLowerCase();
    const now = new Date();

    const existingByGoogleId = this.userIdByGoogleId.get(profile.googleId);
    if (existingByGoogleId) {
      const user = this.users.get(existingByGoogleId)!;
      user.email = email;
      user.displayName = profile.displayName;
      user.photoUrl = profile.photoUrl ?? DEFAULT_PROFILE_PHOTO_URL;
      user.role = role;
      user.updatedAt = now;
      this.userIdByEmail.set(email, user.id);
      return { user: { ...user }, isNewUser: false };
    }

    const existingByEmailId = this.userIdByEmail.get(email);
    if (existingByEmailId) {
      const user = this.users.get(existingByEmailId)!;
      user.googleId = profile.googleId;
      user.displayName = profile.displayName;
      user.photoUrl = profile.photoUrl ?? DEFAULT_PROFILE_PHOTO_URL;
      user.role = role;
      user.updatedAt = now;
      this.userIdByGoogleId.set(profile.googleId, user.id);
      return { user: { ...user }, isNewUser: false };
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
      banned_until: null,
    };

    this.users.set(user.id, user);
    this.userIdByEmail.set(email, user.id);
    this.userIdByGoogleId.set(profile.googleId, user.id);
    return { user: { ...user }, isNewUser: true };
  }

  async createSession(userId: string): Promise<string> {
    const sessionId = `sess_${randomUUID()}`;
    this.sessions.set(sessionId, userId);
    return sessionId;
  }

  async revokeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async getUserBySessionId(sessionId: string | undefined): Promise<AuthUser | undefined> {
    if (!sessionId) {
      return undefined;
    }
    const userId = this.sessions.get(sessionId);
    if (!userId) {
      return undefined;
    }
    const user = this.users.get(userId);
    return user ? { ...user } : undefined;
  }

  async getUserById(userId: string): Promise<AuthUser | undefined> {
    const user = this.users.get(userId);
    return user ? { ...user } : undefined;
  }

  async listUsers(): Promise<AuthUser[]> {
    return [...this.users.values()]
      .map((user) => ({ ...user }))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.userIdByEmail.delete(user.email);
      if (user.googleId) {
        this.userIdByGoogleId.delete(user.googleId);
      }
    }
    this.users.delete(userId);

    for (const [email, account] of this.localAccounts.entries()) {
      if (account.userId === userId) {
        this.localAccounts.delete(email);
      }
    }

    for (const [sessionId, sessionUserId] of this.sessions.entries()) {
      if (sessionUserId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async banUser(userId: string, banUntil: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }
    user.banned_until = banUntil;
    user.updatedAt = new Date();
  }

  async unbanUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }
    user.banned_until = null;
    user.updatedAt = new Date();
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }
    user.role = role;
    user.updatedAt = new Date();
  }
}

class AzureTableAuthStorage implements AuthStorage {
  private readonly usersClient: TableClient;
  private readonly localAccountsClient: TableClient;
  private readonly sessionsClient: TableClient;
  private readonly ready: Promise<void>;

  constructor() {
    const connectionString = process.env.AZURE_TABLES_CONNECTION_STRING;
    if (!connectionString) {
      throw new BadRequestException('AZURE_TABLES_CONNECTION_STRING이 필요합니다.');
    }

    const usersTableName = process.env.AUTH_USERS_TABLE_NAME ?? 'authusers';
    const localAccountsTableName = process.env.AUTH_LOCAL_ACCOUNTS_TABLE_NAME ?? 'authlocalaccounts';
    const sessionsTableName = process.env.AUTH_SESSIONS_TABLE_NAME ?? 'authsessions';

    this.usersClient = TableClient.fromConnectionString(connectionString, usersTableName);
    this.localAccountsClient = TableClient.fromConnectionString(connectionString, localAccountsTableName);
    this.sessionsClient = TableClient.fromConnectionString(connectionString, sessionsTableName);
    this.ready = this.initialize();
  }

  private async initialize() {
    await Promise.all([
      this.ensureTable(this.usersClient),
      this.ensureTable(this.localAccountsClient),
      this.ensureTable(this.sessionsClient),
    ]);
  }

  private async ensureTable(client: TableClient) {
    try {
      await client.createTable();
    } catch (error) {
      if (!String((error as { message?: string }).message ?? '').toLowerCase().includes('tablealreadyexists')) {
        throw error;
      }
    }
  }

  private async ensureReady() {
    await this.ready;
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

  private normalizeUserEntity(entity: Record<string, unknown>): UserRow {
    const rowKey = (entity.rowKey ?? entity.RowKey) as string;
    return {
      id: String(rowKey),
      google_id: entity.google_id ? String(entity.google_id) : null,
      email: String(entity.email),
      display_name: String(entity.display_name),
      photo_url: entity.photo_url ? String(entity.photo_url) : null,
      role: String(entity.role) as UserRole,
      created_at: String(entity.created_at),
      updated_at: String(entity.updated_at),
      banned_until: entity.banned_until ? String(entity.banned_until) : null,
    };
  }

  private async getUserByEmail(email: string): Promise<UserRow | undefined> {
    const escaped = escapeOdataString(email);
    const entity = await firstEntity(
      this.usersClient.listEntities({
        queryOptions: { filter: `PartitionKey eq 'users' and email eq '${escaped}'` },
      }),
    );

    if (!entity) {
      return undefined;
    }

    return this.normalizeUserEntity(entity as Record<string, unknown>);
  }

  private async getUserByGoogleId(googleId: string): Promise<UserRow | undefined> {
    const escaped = escapeOdataString(googleId);
    const entity = await firstEntity(
      this.usersClient.listEntities({
        queryOptions: { filter: `PartitionKey eq 'users' and google_id eq '${escaped}'` },
      }),
    );

    if (!entity) {
      return undefined;
    }

    return this.normalizeUserEntity(entity as Record<string, unknown>);
  }

  async signUpLocal(input: LocalAccountInput, role: UserRole): Promise<{ user: AuthUser; isNewUser: boolean }> {
    await this.ensureReady();

    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

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

    await this.usersClient.upsertEntity({
      partitionKey: 'users',
      rowKey: user.id,
      google_id: null,
      email: user.email,
      display_name: user.displayName,
      photo_url: user.photoUrl ?? null,
      role: user.role,
      banned_until: null,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    }, 'Replace');

    await this.localAccountsClient.upsertEntity({
      partitionKey: 'local_accounts',
      rowKey: user.id,
      email: user.email,
      password: input.password,
      created_at: user.createdAt.toISOString(),
    }, 'Replace');

    return { user, isNewUser: true };
  }

  async signInLocal(email: string, password: string, resolveRoleByEmail: (email: string) => UserRole): Promise<AuthUser> {
    await this.ensureReady();

    const emailLower = email.trim().toLowerCase();
    const escapedEmail = escapeOdataString(emailLower);
    const localEntity = await firstEntity(
      this.localAccountsClient.listEntities({
        queryOptions: { filter: `PartitionKey eq 'local_accounts' and email eq '${escapedEmail}'` },
      }),
    ) as Record<string, unknown> | undefined;

    if (!localEntity) {
      const existingUser = await this.getUserByEmail(emailLower);
      if (existingUser) {
        throw new UnauthorizedException('이 계정은 비밀번호 로그인을 사용할 수 없습니다. 가입한 방식으로 다시 로그인해주세요.');
      }
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (String(localEntity.password) !== password) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const userId = String(localEntity.rowKey ?? localEntity.RowKey);
    const user = await this.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const resolvedRole = resolveRoleByEmail(emailLower);
    if (user.role !== resolvedRole) {
      await this.usersClient.updateEntity({
        partitionKey: 'users',
        rowKey: user.id,
        role: resolvedRole,
        updated_at: new Date().toISOString(),
      }, 'Merge');
      user.role = resolvedRole;
    }

    return user;
  }

  async signInWithGoogle(profile: GoogleProfileInput, role: UserRole): Promise<{ user: AuthUser; isNewUser: boolean }> {
    await this.ensureReady();

    const email = profile.email.trim().toLowerCase();
    const now = new Date();

    const existingByGoogle = await this.getUserByGoogleId(profile.googleId);
    if (existingByGoogle) {
      await this.usersClient.updateEntity({
        partitionKey: 'users',
        rowKey: existingByGoogle.id,
        email,
        display_name: profile.displayName,
        photo_url: profile.photoUrl ?? null,
        role,
        updated_at: now.toISOString(),
      }, 'Merge');

      const updated = await this.getUserById(existingByGoogle.id);
      return { user: updated!, isNewUser: false };
    }

    const existingByEmail = await this.getUserByEmail(email);
    if (existingByEmail) {
      await this.usersClient.updateEntity({
        partitionKey: 'users',
        rowKey: existingByEmail.id,
        google_id: profile.googleId,
        display_name: profile.displayName,
        photo_url: profile.photoUrl ?? null,
        role,
        updated_at: now.toISOString(),
      }, 'Merge');

      const linked = await this.getUserById(existingByEmail.id);
      return { user: linked!, isNewUser: false };
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

    await this.usersClient.upsertEntity({
      partitionKey: 'users',
      rowKey: user.id,
      google_id: user.googleId,
      email: user.email,
      display_name: user.displayName,
      photo_url: user.photoUrl ?? null,
      role: user.role,
      banned_until: null,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    }, 'Replace');

    return { user, isNewUser: true };
  }

  async createSession(userId: string): Promise<string> {
    await this.ensureReady();

    const sessionId = `sess_${randomUUID()}`;
    await this.sessionsClient.upsertEntity({
      partitionKey: 'sessions',
      rowKey: sessionId,
      user_id: userId,
      created_at: new Date().toISOString(),
    }, 'Replace');
    return sessionId;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.ensureReady();

    try {
      await this.sessionsClient.deleteEntity('sessions', sessionId);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  async getUserBySessionId(sessionId: string | undefined): Promise<AuthUser | undefined> {
    await this.ensureReady();

    if (!sessionId) {
      return undefined;
    }

    try {
      const session = await this.sessionsClient.getEntity<Record<string, unknown>>('sessions', sessionId);
      return this.getUserById(String(session.user_id));
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async getUserById(userId: string): Promise<AuthUser | undefined> {
    await this.ensureReady();

    try {
      const entity = await this.usersClient.getEntity<Record<string, unknown>>('users', userId);
      return this.toAuthUser(this.normalizeUserEntity(entity));
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async listUsers(): Promise<AuthUser[]> {
    await this.ensureReady();

    const users: AuthUser[] = [];
    for await (const entity of this.usersClient.listEntities({ queryOptions: { filter: "PartitionKey eq 'users'" } })) {
      users.push(this.toAuthUser(this.normalizeUserEntity(entity as Record<string, unknown>)));
    }

    users.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    return users;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.ensureReady();

    const sessionIds: string[] = [];
    for await (const session of this.sessionsClient.listEntities({
      queryOptions: { filter: `PartitionKey eq 'sessions' and user_id eq '${escapeOdataString(userId)}'` },
    })) {
      const entity = session as Record<string, unknown>;
      sessionIds.push(String(entity.rowKey ?? entity.RowKey));
    }

    await Promise.all(sessionIds.map((sessionId) => this.sessionsClient.deleteEntity('sessions', sessionId)));

    try {
      await this.localAccountsClient.deleteEntity('local_accounts', userId);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    try {
      await this.usersClient.deleteEntity('users', userId);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  async banUser(userId: string, banUntil: string): Promise<void> {
    await this.ensureReady();

    await this.usersClient.updateEntity({
      partitionKey: 'users',
      rowKey: userId,
      banned_until: banUntil,
      updated_at: new Date().toISOString(),
    }, 'Merge');
  }

  async unbanUser(userId: string): Promise<void> {
    await this.ensureReady();

    await this.usersClient.updateEntity({
      partitionKey: 'users',
      rowKey: userId,
      banned_until: null,
      updated_at: new Date().toISOString(),
    }, 'Merge');
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    await this.ensureReady();

    const user = await this.getUserById(userId);
    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }

    await this.usersClient.updateEntity({
      partitionKey: 'users',
      rowKey: userId,
      role,
      updated_at: new Date().toISOString(),
    }, 'Merge');
  }
}

@Injectable()
export class AuthService {
  private readonly storage: AuthStorage;

  constructor() {
    const provider = (process.env.AUTH_STORAGE_PROVIDER ?? 'auto').trim().toLowerCase();

    if (provider === 'memory') {
      this.storage = new InMemoryAuthStorage();
      return;
    }

    if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
      if (process.env.NODE_ENV === 'test') {
        this.storage = new InMemoryAuthStorage();
        return;
      }
      // 로컬 개발: AZURE_TABLES_CONNECTION_STRING 없으면 InMemory 사용
      this.storage = new InMemoryAuthStorage();
      return;
    }

    this.storage = new AzureTableAuthStorage();
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

  async getBanInfoByUserId(userId: string): Promise<{
    isBanned: boolean;
    bannedUntil: string | null;
    remainingSeconds: number;
  }> {
    const user = await this.getUserById(userId);
    if (!user) {
      return { isBanned: false, bannedUntil: null, remainingSeconds: 0 };
    }
    return this.getBanInfo(user);
  }

  private resolveRoleByEmail(email: string): UserRole {
    const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0);

    return adminEmails.includes(email.trim().toLowerCase()) ? 'admin' : 'user';
  }

  async signUpLocal(input: LocalAccountInput): Promise<{ user: AuthUser; isNewUser: boolean }> {
    const role = this.resolveRoleByEmail(input.email);
    return this.storage.signUpLocal(input, role);
  }

  async signInLocal(email: string, password: string): Promise<AuthUser> {
    const user = await this.storage.signInLocal(email, password, this.resolveRoleByEmail.bind(this));
    const banInfo = this.getBanInfo(user);
    if (banInfo.isBanned && banInfo.bannedUntil) {
      throw new UnauthorizedException(`이 계정은 밴 상태입니다. 해제 예정 시각: ${new Date(banInfo.bannedUntil).toLocaleString('ko-KR')}`);
    }

    return user;
  }

  async signInWithGoogle(profile: GoogleProfileInput): Promise<{ user: AuthUser; isNewUser: boolean }> {
    const role = this.resolveRoleByEmail(profile.email);
    const result = await this.storage.signInWithGoogle(profile, role);

    const banInfo = this.getBanInfo(result.user);
    if (banInfo.isBanned && banInfo.bannedUntil) {
      throw new UnauthorizedException(`이 계정은 밴 상태입니다. 해제 예정 시각: ${new Date(banInfo.bannedUntil).toLocaleString('ko-KR')}`);
    }

    return result;
  }

  async createSession(userId: string): Promise<string> {
    return this.storage.createSession(userId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.storage.revokeSession(sessionId);
  }

  async getUserBySessionId(sessionId: string | undefined): Promise<AuthUser | undefined> {
    return this.storage.getUserBySessionId(sessionId);
  }

  async getUserById(userId: string): Promise<AuthUser | undefined> {
    return this.storage.getUserById(userId);
  }

  async listUsers(): Promise<AuthUser[]> {
    return this.storage.listUsers();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.storage.deleteUser(userId);
  }

  async banUser(userId: string, banUntil: string): Promise<void> {
    const bannedUntilDate = new Date(banUntil);
    if (!Number.isFinite(bannedUntilDate.getTime())) {
      throw new BadRequestException('유효한 밴 해제 시각을 입력해 주세요.');
    }

    if (bannedUntilDate.getTime() <= Date.now()) {
      throw new BadRequestException('밴 해제 시각은 현재 시각보다 이후여야 합니다.');
    }

    await this.storage.banUser(userId, bannedUntilDate.toISOString());
  }

  async unbanUser(userId: string): Promise<void> {
    await this.storage.unbanUser(userId);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    if (role !== 'user' && role !== 'admin') {
      throw new BadRequestException('유효하지 않은 역할입니다.');
    }

    await this.storage.updateUserRole(userId, role);
  }
}
