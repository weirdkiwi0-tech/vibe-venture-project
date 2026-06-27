import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../src/auth';
import { RolesGuard } from '../../src/auth/roles.guard';

function createHttpExecutionContext(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('RolesGuard (unit)', () => {
  it('allows request when no role requirement is present', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    const authService = {
      getUserBySessionId: jest.fn(),
    } as unknown as AuthService;

    const guard = new RolesGuard(reflector, authService);
    const context = createHttpExecutionContext({ headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('uses session role first when keepit-session cookie exists', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;

    const authService = {
      getUserBySessionId: jest.fn().mockResolvedValue({ role: 'user' }),
    } as unknown as AuthService;

    const guard = new RolesGuard(reflector, authService);
    const context = createHttpExecutionContext({
      headers: {
        'x-user-role': 'admin',
      },
      cookies: {
        'keepit-session': 'sess-1',
      },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('rejects request when session is missing even if role header exists', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;

    const authService = {
      getUserBySessionId: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;

    const guard = new RolesGuard(reflector, authService);
    const context = createHttpExecutionContext({
      headers: {
        'x-user-role': 'admin',
      },
      cookies: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
