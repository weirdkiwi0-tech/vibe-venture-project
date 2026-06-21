import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    // 개발 모드에서는 인증 건너뛰기
    if (process.env.SKIP_GOOGLE_AUTH === 'true') {
      const request = context.switchToHttp().getRequest();
      request.user = {
        googleId: 'dev-user-123',
        email: 'dev@example.com',
        displayName: 'Dev User',
        photoUrl: undefined,
      };
      return true;
    }

    return super.canActivate(context);
  }
}
