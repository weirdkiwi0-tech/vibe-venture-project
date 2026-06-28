import { AuthService } from '../../src/auth/auth.service';

type SeedAccountsFn = (
  authService: AuthService,
  input: {
    admin: { email: string; password: string; displayName: string };
    operator: { email: string; password: string; displayName: string };
  },
) => Promise<void>;

function loadSeedAccountsFn(): SeedAccountsFn {
  const mod = require('../../src/auth/dev-local-seed.util') as Partial<{
    seedDevAdminOperatorAccounts: SeedAccountsFn;
  }>;

  if (typeof mod.seedDevAdminOperatorAccounts !== 'function') {
    throw new Error('seedDevAdminOperatorAccounts export is missing');
  }

  return mod.seedDevAdminOperatorAccounts;
}

describe('dev local seed util (integration)', () => {
  const originalAuthProvider = process.env.AUTH_STORAGE_PROVIDER;
  const originalAdminEmails = process.env.GOOGLE_ADMIN_EMAILS;

  beforeEach(() => {
    process.env.AUTH_STORAGE_PROVIDER = 'memory';
    process.env.GOOGLE_ADMIN_EMAILS = 'admin@keepit.dev,operator@keepit.dev';
  });

  afterEach(() => {
    process.env.AUTH_STORAGE_PROVIDER = originalAuthProvider;
    process.env.GOOGLE_ADMIN_EMAILS = originalAdminEmails;
  });

  it('InMemory 환경에서 시드 유틸 실행 후 admin/operator 모두 signInLocal 가능해야 한다', async () => {
    const seedDevAdminOperatorAccounts = loadSeedAccountsFn();
    const authService = new AuthService();

    await seedDevAdminOperatorAccounts(authService, {
      admin: {
        email: 'admin@keepit.dev',
        password: 'admin1234',
        displayName: '운영자',
      },
      operator: {
        email: 'operator@keepit.dev',
        password: 'Operator#2026',
        displayName: '운영자2',
      },
    });

    const admin = await authService.signInLocal('admin@keepit.dev', 'admin1234');
    const operator = await authService.signInLocal('operator@keepit.dev', 'Operator#2026');

    expect(admin.role).toBe('admin');
    expect(operator.role).toBe('admin');
  });
});
