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
  it('allows request when no role requirement is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    const authService = {
      getUserBySessionId: jest.fn(),
    } as unknown as AuthService;

    const guard = new RolesGuard(reflector, authService);
    const context = createHttpExecutionContext({ headers: {} });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('uses session role first when keepit-session cookie exists', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;

    const authService = {
      getUserBySessionId: jest.fn().mockReturnValue({ role: 'user' }),
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

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('falls back to x-user-role header when no session is present', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;

    const authService = {
      getUserBySessionId: jest.fn().mockReturnValue(undefined),
    } as unknown as AuthService;

    const guard = new RolesGuard(reflector, authService);
    const context = createHttpExecutionContext({
      headers: {
        'x-user-role': 'admin',
      },
      cookies: {},
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
