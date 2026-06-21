import { AuthService } from '../../src/auth/auth.service';

describe('AuthService (unit)', () => {
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;

  afterEach(() => {
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
  });

  it('assigns admin role only for configured admin email', () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@example.com,owner@example.com';
    const service = new AuthService();

    const adminLogin = service.signInWithGoogle({
      googleId: 'g-admin',
      email: 'admin@example.com',
      displayName: 'Admin User',
    });

    const userLogin = service.signInWithGoogle({
      googleId: 'g-user',
      email: 'student@example.com',
      displayName: 'Student User',
    });

    expect(adminLogin.user.role).toBe('admin');
    expect(userLogin.user.role).toBe('user');
  });

  it('updates existing user role when admin list changes on later login', () => {
    process.env.GOOGLE_ADMIN_EMAILS = '';
    const service = new AuthService();

    const first = service.signInWithGoogle({
      googleId: 'g-1',
      email: 'promote@example.com',
      displayName: 'Promote Me',
    });

    expect(first.user.role).toBe('user');

    process.env.GOOGLE_ADMIN_EMAILS = 'promote@example.com';
    const second = service.signInWithGoogle({
      googleId: 'g-1',
      email: 'promote@example.com',
      displayName: 'Promote Me',
    });

    expect(second.isNewUser).toBe(false);
    expect(second.user.role).toBe('admin');
  });

  it('creates and resolves session, then revokes it', () => {
    const service = new AuthService();

    const login = service.signInWithGoogle({
      googleId: 'g-2',
      email: 'session@example.com',
      displayName: 'Session User',
    });

    const sessionId = service.createSession(login.user.id);
    const resolved = service.getUserBySessionId(sessionId);
    expect(resolved?.id).toBe(login.user.id);

    service.revokeSession(sessionId);
    expect(service.getUserBySessionId(sessionId)).toBeUndefined();
  });
});
