import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';

describe('AuthService (unit)', () => {
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;

  afterEach(() => {
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
  });

  it('assigns admin role only for configured admin email', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@example.com,owner@example.com';
    const service = new AuthService();

    const adminLogin = await service.signInWithGoogle({
      googleId: 'g-admin',
      email: 'admin@example.com',
      displayName: 'Admin User',
    });

    const userLogin = await service.signInWithGoogle({
      googleId: 'g-user',
      email: 'student@example.com',
      displayName: 'Student User',
    });

    expect(adminLogin.user.role).toBe('admin');
    expect(userLogin.user.role).toBe('user');
  });

  it('updates existing user role when admin list changes on later login', async () => {
    process.env.GOOGLE_ADMIN_EMAILS = '';
    const service = new AuthService();

    const first = await service.signInWithGoogle({
      googleId: 'g-1',
      email: 'promote@example.com',
      displayName: 'Promote Me',
    });

    expect(first.user.role).toBe('user');

    process.env.GOOGLE_ADMIN_EMAILS = 'promote@example.com';
    const second = await service.signInWithGoogle({
      googleId: 'g-1',
      email: 'promote@example.com',
      displayName: 'Promote Me',
    });

    expect(second.isNewUser).toBe(false);
    expect(second.user.role).toBe('admin');
  });

  it('creates and resolves session, then revokes it', async () => {
    const service = new AuthService();

    const login = await service.signInWithGoogle({
      googleId: 'g-2',
      email: 'session@example.com',
      displayName: 'Session User',
    });

    const sessionId = await service.createSession(login.user.id);
    const resolved = await service.getUserBySessionId(sessionId);
    expect(resolved?.id).toBe(login.user.id);

    await service.revokeSession(sessionId);
    await expect(service.getUserBySessionId(sessionId)).resolves.toBeUndefined();
  });

  it('signUpLocal → getUserById 시 displayName, photoUrl 반환', async () => {
    const service = new AuthService();

    const { user } = await service.signUpLocal({
      email: 'newuser-unit@test.com',
      password: 'Secure@99',
      displayName: '단위테스터',
    });

    const found = await service.getUserById(user.id);
    expect(found).toBeDefined();
    expect(found!.displayName).toBe('단위테스터');
    expect(found!.photoUrl).toBeDefined();
  });

  it('signInLocal 틀린 비밀번호 → UnauthorizedException', async () => {
    const service = new AuthService();

    await service.signUpLocal({
      email: 'wrongpw-unit@test.com',
      password: 'Correct@99',
      displayName: '비밀번호테스터',
    });

    await expect(service.signInLocal('wrongpw-unit@test.com', 'WrongPass@99')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('signUpLocal 성공 시 반환된 user에 id, email, displayName, role 필드 존재', async () => {
    const service = new AuthService();

    const { user } = await service.signUpLocal({
      email: 'fieldcheck-unit@test.com',
      password: 'Secure@99',
      displayName: '필드확인테스터',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('fieldcheck-unit@test.com');
    expect(user.displayName).toBe('필드확인테스터');
    expect(user.role).toBeDefined();
  });

  it('banUser 후 getBanInfoByUserId → isBanned: true', async () => {
    const service = new AuthService();

    const { user } = await service.signUpLocal({
      email: 'bantest-unit@test.com',
      password: 'Secure@99',
      displayName: '밴테스터',
    });

    const banUntil = new Date(Date.now() + 3600 * 1000).toISOString();
    await service.banUser(user.id, banUntil);

    const banInfo = await service.getBanInfoByUserId(user.id);
    expect(banInfo.isBanned).toBe(true);
    expect(banInfo.bannedUntil).toBeDefined();
  });

  it('unbanUser 후 getBanInfoByUserId → isBanned: false', async () => {
    const service = new AuthService();

    const { user } = await service.signUpLocal({
      email: 'unbantest-unit@test.com',
      password: 'Secure@99',
      displayName: '언밴테스터',
    });

    const banUntil = new Date(Date.now() + 3600 * 1000).toISOString();
    await service.banUser(user.id, banUntil);

    await service.unbanUser(user.id);

    const banInfo = await service.getBanInfoByUserId(user.id);
    expect(banInfo.isBanned).toBe(false);
  });
});
