import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const clientID = process.env.GOOGLE_CLIENT_ID ?? 'missing-google-client-id';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? 'missing-google-client-secret';
    const callbackURL = process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['profile', 'email'],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new UnauthorizedException('google email not found'), undefined);
      return;
    }

    done(undefined, {
      googleId: profile.id,
      email,
      displayName: profile.displayName ?? email,
      photoUrl: profile.photos?.[0]?.value,
    });
  }
}
