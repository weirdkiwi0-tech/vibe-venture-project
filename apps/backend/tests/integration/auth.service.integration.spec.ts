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

  it('keeps one user record per google account across repeated sign-ins', () => {
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@example.com';
    const service = new AuthService();

    const first = service.signInWithGoogle({
      googleId: 'google-123',
      email: 'admin@example.com',
      displayName: 'First Name',
      photoUrl: 'https://example.com/1.png',
    });

    const second = service.signInWithGoogle({
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

  it('resolves session owner across service boundaries', () => {
    const service = new AuthService();
    const login = service.signInWithGoogle({
      googleId: 'google-999',
      email: 'user@example.com',
      displayName: 'User',
    });

    const sessionId = service.createSession(login.user.id);
    const user = service.getUserBySessionId(sessionId);

    expect(user?.email).toBe('user@example.com');
    expect(user?.role).toBe('user');
  });
});
