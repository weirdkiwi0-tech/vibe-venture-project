type SeedAccountInput = {
  email: string;
  password: string;
  displayName: string;
};

type SeedAccountsInput = {
  admin: SeedAccountInput;
  operator: SeedAccountInput;
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
  authService: DevLocalSeedAuthService,
  envOrInput: SeedAccountsInput | SeedEnv = process.env,
): Promise<void> {
  if (isSeedAccountsInput(envOrInput)) {
    await ensureDevLocalAccount(authService, envOrInput.admin);
    await ensureDevLocalAccount(authService, envOrInput.operator);
    return;
  }

  const env = envOrInput;
  const admin: SeedAccountInput = {
    email: env.DEV_ADMIN_EMAIL ?? 'admin@keepit.dev',
    password: env.DEV_ADMIN_PASSWORD ?? 'admin1234',
    displayName: env.DEV_ADMIN_DISPLAY_NAME ?? '운영자',
  };

  await ensureDevLocalAccount(authService, admin);

  await ensureDevLocalAccount(authService, {
    email: env.DEV_OPERATOR_EMAIL ?? 'operator@keepit.dev',
    password: env.DEV_OPERATOR_PASSWORD ?? 'Operator#2026',
    displayName: env.DEV_OPERATOR_DISPLAY_NAME?.trim() || '운영자2',
  });
}