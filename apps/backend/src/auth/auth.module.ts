import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';
import { GoogleStrategy } from './google.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule.register({ session: false })],
  controllers: [AuthController],
  providers: [RolesGuard, GoogleAuthGuard, GoogleStrategy, AuthService],
  exports: [RolesGuard, AuthService],
})
export class AuthModule {}