import { Controller, Get, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ROLE_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';

interface GoogleAuthUser {
  googleId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

interface LocalSignUpDto {
  email: string;
  password: string;
  displayName: string;
  photoUrl?: string;
}

interface LocalSignInDto {
  email: string;
  password: string;
}

interface AuthenticatedRequest extends Request {
  user?: GoogleAuthUser;
}

function inferFrontendBaseUrlFromBackendHost(req: Request): string | null {
  const explicitOrigin = req.headers.origin;
  if (typeof explicitOrigin === 'string' && explicitOrigin.length > 0) {
    return explicitOrigin;
  }

  const forwardedProtoRaw = req.headers['x-forwarded-proto'];
  const forwardedHostRaw = req.headers['x-forwarded-host'];
  const hostRaw = forwardedHostRaw ?? req.headers.host;

  const forwardedProto = Array.isArray(forwardedProtoRaw)
    ? forwardedProtoRaw[0]
    : forwardedProtoRaw?.split(',')[0]?.trim();
  const host = Array.isArray(hostRaw) ? hostRaw[0] : hostRaw?.split(',')[0]?.trim();

  if (!host) {
    return null;
  }

  const proto = forwardedProto ?? 'https';
  const frontendHost = host
    .replace(/^backend\./, 'frontend.')
    .replace(/^backend-/, 'frontend-');

  return `${proto}://${frontendHost}`;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private shouldUseSecureCookie(req: Request): boolean {
    const explicit = parseBooleanEnv(process.env.COOKIE_SECURE);
    if (typeof explicit === 'boolean') {
      return explicit;
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto?.split(',')[0]?.trim();

    return proto === 'https';
  }

  private cookieBaseOptions(req: Request) {
    return {
      path: '/',
      maxAge: 60 * 60 * 24 * 30 * 1000,
      sameSite: 'lax' as const,
      secure: this.shouldUseSecureCookie(req),
    };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleLogin() {
    return;
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const oauthUser = req.user;
    if (!oauthUser) {
      return res.redirect(this.buildFrontendCallbackUrl(req, false, '구글 로그인에 실패했습니다.'));
    }

    let user: {
      id: string;
      role: 'user' | 'admin';
    };
    let isNewUser: boolean;
    try {
      const signInResult = await this.authService.signInWithGoogle(oauthUser);
      user = signInResult.user;
      isNewUser = signInResult.isNewUser;
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인 처리에 실패했습니다.';
      return res.redirect(this.buildFrontendCallbackUrl(req, false, message));
    }

    const sessionId = await this.authService.createSession(user.id);

    const cookieBaseOptions = this.cookieBaseOptions(req);

    res.cookie('keepit-session', sessionId, {
      ...cookieBaseOptions,
      httpOnly: true,
    });

    res.cookie(ROLE_COOKIE_NAME, user.role, {
      ...cookieBaseOptions,
      httpOnly: false,
    });

    return res.redirect(this.buildFrontendCallbackUrl(req, isNewUser, undefined));
  }

  @Get('me')
  async me(@Req() req: Request) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const user = await this.authService.getUserBySessionId(sessionId);

    if (!user) {
      return { isAuthenticated: false };
    }

    return {
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        role: user.role,
      },
      ban: {
        ...(await this.authService.getBanInfoByUserId(user.id)),
        logoutAfterSeconds: 10,
      },
    };
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    if (sessionId) {
      await this.authService.revokeSession(sessionId);
    }

    res.clearCookie('keepit-session', { path: '/' });
    res.clearCookie(ROLE_COOKIE_NAME, { path: '/' });

    return res.redirect(this.buildFrontendCallbackUrl(req, false, '로그아웃 되었습니다.'));
  }

  @Post('signup')
  async signup(@Body() body: LocalSignUpDto, @Req() req: Request, @Res() res: Response) {
    try {
      const { user } = await this.authService.signUpLocal({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        photoUrl: body.photoUrl,
      });
      const sessionId = await this.authService.createSession(user.id);

      const cookieBaseOptions = this.cookieBaseOptions(req);

      res.cookie('keepit-session', sessionId, {
        ...cookieBaseOptions,
        httpOnly: true,
      });

      res.cookie(ROLE_COOKIE_NAME, user.role, {
        ...cookieBaseOptions,
        httpOnly: false,
      });

      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return res.status(400).json({ success: false, message: '회원가입 실패' });
    }
  }

  @Post('signin')
  async signin(@Body() body: LocalSignInDto, @Req() req: Request, @Res() res: Response) {
    try {
      const user = await this.authService.signInLocal(body.email, body.password);
      const sessionId = await this.authService.createSession(user.id);

      const cookieBaseOptions = this.cookieBaseOptions(req);

      res.cookie('keepit-session', sessionId, {
        ...cookieBaseOptions,
        httpOnly: true,
      });

      res.cookie(ROLE_COOKIE_NAME, user.role, {
        ...cookieBaseOptions,
        httpOnly: false,
      });

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoUrl: user.photoUrl,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(401).json({ success: false, message: error.message });
      }
      return res.status(401).json({ success: false, message: '로그인 실패' });
    }
  }

  private buildFrontendCallbackUrl(req: Request, isNewUser: boolean, message?: string): string {
    const frontendBaseUrl =
      process.env.FRONTEND_BASE_URL ?? inferFrontendBaseUrlFromBackendHost(req) ?? 'http://localhost:3000';
    const callbackUrl = new URL('/auth/callback', frontendBaseUrl);
    callbackUrl.searchParams.set('newUser', String(isNewUser));
    if (message) {
      callbackUrl.searchParams.set('message', message);
    }

    return callbackUrl.toString();
  }
}
