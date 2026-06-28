type SeedAccountInput = {
  email: string;
  password: string;
  displayName: string;
};

type SeedAccountFn = (
  authService: {
    signUpLocal: (input: SeedAccountInput) => Promise<unknown>;
    signInLocal: (email: string, password: string) => Promise<unknown>;
    listUsers: () => Promise<Array<{ id: string; email: string }>>;
    deleteUser: (userId: string) => Promise<void>;
  },
  input: SeedAccountInput,
) => Promise<void>;

function loadSeedAccountFn(): SeedAccountFn {
  // Red: dev 시드 유틸의 공개 API 계약을 고정합니다.
  // Green 단계에서 src/auth/dev-local-seed.util.ts 구현 및 export가 필요합니다.
  const mod = require('../../src/auth/dev-local-seed.util') as Partial<{
    ensureDevLocalAccount: SeedAccountFn;
  }>;

  if (typeof mod.ensureDevLocalAccount !== 'function') {
    throw new Error('ensureDevLocalAccount export is missing');
  }

  return mod.ensureDevLocalAccount;
}

describe('dev local seed util (unit)', () => {
  it('신규 계정이면 signUpLocal을 호출한다', async () => {
    const ensureDevLocalAccount = loadSeedAccountFn();
    const authService = {
      signUpLocal: jest.fn().mockResolvedValue({}),
      signInLocal: jest.fn(),
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
    };

    await ensureDevLocalAccount(authService, {
      email: 'admin@keepit.dev',
      password: 'admin1234',
      displayName: '운영자',
    });

    expect(authService.signUpLocal).toHaveBeenCalledTimes(1);
    expect(authService.signUpLocal).toHaveBeenCalledWith({
      email: 'admin@keepit.dev',
      password: 'admin1234',
      displayName: '운영자',
    });
    expect(authService.signInLocal).not.toHaveBeenCalled();
    expect(authService.deleteUser).not.toHaveBeenCalled();
  });

  it('기존 계정이고 signInLocal 성공이면 재생성하지 않는다', async () => {
    const ensureDevLocalAccount = loadSeedAccountFn();
    const authService = {
      signUpLocal: jest.fn().mockRejectedValue(new Error('already exists')),
      signInLocal: jest.fn().mockResolvedValue({ id: 'existing-user' }),
      listUsers: jest.fn(),
      deleteUser: jest.fn(),
    };

    await ensureDevLocalAccount(authService, {
      email: 'operator@keepit.dev',
      password: 'Operator#2026',
      displayName: '운영자2',
    });

    expect(authService.signUpLocal).toHaveBeenCalledTimes(1);
    expect(authService.signInLocal).toHaveBeenCalledTimes(1);
    expect(authService.signInLocal).toHaveBeenCalledWith('operator@keepit.dev', 'Operator#2026');
    expect(authService.listUsers).not.toHaveBeenCalled();
    expect(authService.deleteUser).not.toHaveBeenCalled();
  });

  it('기존 계정이고 signInLocal 실패면 동일 이메일 사용자를 삭제 후 재생성한다', async () => {
    const ensureDevLocalAccount = loadSeedAccountFn();
    const authService = {
      signUpLocal: jest
        .fn()
        .mockRejectedValueOnce(new Error('already exists'))
        .mockResolvedValueOnce({}),
      signInLocal: jest.fn().mockRejectedValue(new Error('invalid password')),
      listUsers: jest.fn().mockResolvedValue([{ id: 'u-1', email: 'admin@keepit.dev' }]),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };

    await ensureDevLocalAccount(authService, {
      email: 'admin@keepit.dev',
      password: 'admin1234',
      displayName: '운영자',
    });

    expect(authService.signUpLocal).toHaveBeenCalledTimes(2);
    expect(authService.signInLocal).toHaveBeenCalledTimes(1);
    expect(authService.listUsers).toHaveBeenCalledTimes(1);
    expect(authService.deleteUser).toHaveBeenCalledTimes(1);
    expect(authService.deleteUser).toHaveBeenCalledWith('u-1');
  });
});
