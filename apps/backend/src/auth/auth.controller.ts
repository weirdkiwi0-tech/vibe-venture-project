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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      return res.redirect(this.buildFrontendCallbackUrl(false, '구글 로그인에 실패했습니다.'));
    }

    let user: {
      id: string;
      role: 'user' | 'admin';
    };
    let isNewUser: boolean;
    try {
      const signInResult = this.authService.signInWithGoogle(oauthUser);
      user = signInResult.user;
      isNewUser = signInResult.isNewUser;
    } catch (error) {
      const message = error instanceof Error ? error.message : '로그인 처리에 실패했습니다.';
      return res.redirect(this.buildFrontendCallbackUrl(false, message));
    }

    const sessionId = this.authService.createSession(user.id);

    const cookieBaseOptions = {
      path: '/',
      maxAge: 60 * 60 * 24 * 30 * 1000,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    };

    res.cookie('keepit-session', sessionId, {
      ...cookieBaseOptions,
      httpOnly: true,
    });

    res.cookie(ROLE_COOKIE_NAME, user.role, {
      ...cookieBaseOptions,
      httpOnly: false,
    });

    return res.redirect(this.buildFrontendCallbackUrl(isNewUser, undefined));
  }

  @Get('me')
  async me(@Req() req: Request) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const user = this.authService.getUserBySessionId(sessionId);

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
        ...this.authService.getBanInfoByUserId(user.id),
        logoutAfterSeconds: 10,
      },
    };
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    if (sessionId) {
      this.authService.revokeSession(sessionId);
    }

    res.clearCookie('keepit-session', { path: '/' });
    res.clearCookie(ROLE_COOKIE_NAME, { path: '/' });

    return res.redirect(this.buildFrontendCallbackUrl(false, '로그아웃 되었습니다.'));
  }

  @Post('signup')
  async signup(@Body() body: LocalSignUpDto, @Res() res: Response) {
    try {
      const { user } = this.authService.signUpLocal({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        photoUrl: body.photoUrl,
      });
      const sessionId = this.authService.createSession(user.id);

      const cookieBaseOptions = {
        path: '/',
        maxAge: 60 * 60 * 24 * 30 * 1000,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
      };

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
  async signin(@Body() body: LocalSignInDto, @Res() res: Response) {
    try {
      const user = this.authService.signInLocal(body.email, body.password);
      const sessionId = this.authService.createSession(user.id);

      const cookieBaseOptions = {
        path: '/',
        maxAge: 60 * 60 * 24 * 30 * 1000,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
      };

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

  private buildFrontendCallbackUrl(isNewUser: boolean, message?: string): string {
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
    const callbackUrl = new URL('/auth/callback', frontendBaseUrl);
    callbackUrl.searchParams.set('newUser', String(isNewUser));
    if (message) {
      callbackUrl.searchParams.set('message', message);
    }

    return callbackUrl.toString();
  }
}
