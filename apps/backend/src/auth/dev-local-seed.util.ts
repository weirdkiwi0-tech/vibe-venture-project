type SeedAccountInput = {
  email: string;
  password: string;
  displayName: string;
};

type SeedAccountsInput = {
  admin: SeedAccountInput;
  operator: SeedAccountInput;
  developer?: SeedAccountInput;
};

type UserSummary = {
  id: string;
  email: string;
};

interface DevLocalSeedAuthService {
  signUpLocal(input: SeedAccountInput): Promise<unknown>;
  signInLocal(email: string, password: string): Promise<unknown>;
  listUsers(): Promise<UserSummary[]>;
  deleteUser(userId: string): Promise<void>;
}

type SeedEnv = NodeJS.ProcessEnv;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isSeedAccountsInput(input: SeedAccountsInput | SeedEnv): input is SeedAccountsInput {
  return (
    'admin' in input &&
    typeof input.admin === 'object' &&
    input.admin !== null &&
    'operator' in input &&
    typeof input.operator === 'object' &&
    input.operator !== null
  );
}

export async function ensureDevLocalAccount(
  authService: DevLocalSeedAuthService,
  options: SeedAccountInput,
): Promise<void> {
  const email = normalizeEmail(options.email);

  try {
    await authService.signUpLocal({
      email,
      password: options.password,
      displayName: options.displayName,
    });
    return;
  } catch {
    // Existing user or transient issue; verify credential viability next.
  }

  try {
    await authService.signInLocal(email, options.password);
    return;
  } catch {
    // Sign in failed; repair stale/non-local duplicate account data.
  }

  const users = await authService.listUsers();
  const existing = users.find((user) => normalizeEmail(user.email) === email);
  if (existing) {
    await authService.deleteUser(existing.id);
  }

  await authService.signUpLocal({
    email,
    password: options.password,
    displayName: options.displayName,
  });
}

export async function seedDevAdminOperatorAccounts(
  authService: DevLocalSeedAuthService & { updateUserRole(userId: string, role: 'admin'): Promise<unknown> },
  envOrInput: SeedAccountsInput | SeedEnv = process.env,
): Promise<void> {
  const ensureAdministrator = async (account: SeedAccountInput): Promise<void> => {
    await ensureDevLocalAccount(authService, account);
    const user = (await authService.listUsers()).find((candidate) => normalizeEmail(candidate.email) === normalizeEmail(account.email));
    if (!user) throw new Error('Seed administrator account was not created');
    await authService.updateUserRole(user.id, 'admin');
  };
  if (isSeedAccountsInput(envOrInput)) {
    await ensureAdministrator(envOrInput.admin);
    await ensureAdministrator(envOrInput.operator);
    if (envOrInput.developer) {
      await ensureAdministrator(envOrInput.developer);
    }
    return;
  }

  const env = envOrInput;
  const admin: SeedAccountInput = {
    email: env.DEV_ADMIN_EMAIL ?? 'admin@keepit.dev',
    password: env.DEV_ADMIN_PASSWORD ?? 'admin1234',
    displayName: env.DEV_ADMIN_DISPLAY_NAME ?? '운영자',
  };

  await ensureAdministrator(admin);

  await ensureAdministrator({
    email: env.DEV_OPERATOR_EMAIL ?? 'operator@keepit.dev',
    password: env.DEV_OPERATOR_PASSWORD ?? 'Operator#2026',
    displayName: env.DEV_OPERATOR_DISPLAY_NAME?.trim() || '운영자2',
  });

  await ensureAdministrator({
    email: env.DEV_DEVELOPER_EMAIL ?? 'developer@keepit.dev',
    password: env.DEV_DEVELOPER_PASSWORD ?? 'Dev!2026',
    displayName: env.DEV_DEVELOPER_DISPLAY_NAME?.trim() || '개발자',
  });
}