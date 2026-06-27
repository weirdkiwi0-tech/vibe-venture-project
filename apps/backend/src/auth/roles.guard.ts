import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { ROLE_METADATA_KEY, UserRole } from './roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLE_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
      cookies?: Record<string, string | undefined>;
    }>();

    const sessionId = request.cookies?.['keepit-session'];
    const sessionUser = await this.authService.getUserBySessionId(sessionId);
    if (!sessionUser) {
      throw new ForbiddenException('authenticated session required');
    }

    const currentRole = sessionUser.role;

    if (!requiredRoles.includes(currentRole)) {
      throw new ForbiddenException('insufficient role');
    }

    return true;
  }
}