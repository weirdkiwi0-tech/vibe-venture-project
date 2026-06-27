import { AuthService } from '../../src/auth/auth.service';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AuthService (integration)', () => {
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;
  const originalAuthDbPath = process.env.AUTH_DB_PATH;
  let testDbPath = '';

  beforeEach(() => {
    testDbPath = resolve(process.cwd(), `data/test-auth-${randomUUID()}.sqlite`);
    process.env.AUTH_DB_PATH = testDbPath;
  });

  afterEach(() => {
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
    process.env.AUTH_DB_PATH = originalAuthDbPath;
    rmSync(testDbPath, { force: true });
    rmSync(`${testDbPath}-wal`, { force: true });
    rmSync(`${testDbPath}-shm`, { force: true });
  });

  it('keeps one user record per google account across repeated sign-ins', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@example.com';
    const service = new AuthService();

    const first = await service.signInWithGoogle({
      googleId: 'google-123',
      email: 'admin@example.com',
      displayName: 'First Name',
      photoUrl: 'https://example.com/1.png',
    });

    const second = await service.signInWithGoogle({
      googleId: 'google-123',
      email: 'admin@example.com',
      displayName: 'Updated Name',
      photoUrl: 'https://example.com/2.png',
    });

    expect(first.isNewUser).toBe(true);
    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.user.displayName).toBe('Updated Name');
    expect(second.user.photoUrl).toBe('https://example.com/2.png');
    expect(second.user.role).toBe('admin');
  });

  it('resolves session owner across service boundaries', async () => {
    const service = new AuthService();
    const login = await service.signInWithGoogle({
      googleId: 'google-999',
      email: 'user@example.com',
      displayName: 'User',
    });

    const sessionId = await service.createSession(login.user.id);
    const user = await service.getUserBySessionId(sessionId);

    expect(user?.email).toBe('user@example.com');
    expect(user?.role).toBe('user');
  });

  it('signInLocal 밴 상태 유저 → UnauthorizedException, 언밴 후 → 성공', async () => {
    const service = new AuthService();

    await service.signUpLocal({
      email: 'banflow@test.com',
      password: 'Secure@99',
      displayName: '밴테스트',
    });

    // 유저 ID 획득
    const users = await service.listUsers();
    const found = users.find((u) => u.email === 'banflow@test.com');
    expect(found).toBeDefined();

    const banUntil = new Date(Date.now() + 3600 * 1000).toISOString();
    await service.banUser(found!.id, banUntil);

    // 밴 상태 로그인 시도 → 실패
    await expect(service.signInLocal('banflow@test.com', 'Secure@99')).rejects.toThrow();

    // 언밴 후 로그인 성공
    await service.unbanUser(found!.id);
    const loggedIn = await service.signInLocal('banflow@test.com', 'Secure@99');
    expect(loggedIn.email).toBe('banflow@test.com');
  });

  it('밴된 계정 signInLocal → UnauthorizedException 메시지에 밴 만료 시각 포함', async () => {
    const service = new AuthService();

    await service.signUpLocal({
      email: 'banmsg@test.com',
      password: 'Secure@99',
      displayName: '밴메시지테스트',
    });

    const users = await service.listUsers();
    const found = users.find((u) => u.email === 'banmsg@test.com');
    expect(found).toBeDefined();

    const banUntil = new Date(Date.now() + 7200 * 1000).toISOString();
    await service.banUser(found!.id, banUntil);

    let caughtError: Error | undefined;
    try {
      await service.signInLocal('banmsg@test.com', 'Secure@99');
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toMatch(/ban|정지|계정/i);
  });
});
