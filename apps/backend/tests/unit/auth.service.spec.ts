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
});
