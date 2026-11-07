import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class SessionIdentityGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    delete request.headers['x-user-id'];
    delete request.headers['x-user-role'];
    const user = await this.authService.getUserBySessionId(request.cookies?.['keepit-session']);
    if (user) request.headers['x-user-id'] = user.id;
    const path = request.path.replace(/\/$/, '');
    const publicWrite = request.method === 'POST' && (
      path === '/auth/signup' || path === '/auth/signin' || /^\/videos\/[^/]+\/view$/.test(path)
    );
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (write && !publicWrite && !user) throw new UnauthorizedException('authenticated session required');
    if (user && !path.startsWith('/auth/')) {
      const ban = await this.authService.getBanInfoByUserId(user.id);
      if (ban.isBanned) throw new ForbiddenException('account is suspended');
    }
    return true;
  }
}