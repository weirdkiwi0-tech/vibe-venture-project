import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionIdentityGuard } from './auth/session-identity.guard';
import { AdminModule } from './admin';
import { AuthModule } from './auth';
import { AuthService } from './auth/auth.service';
import { seedDevAdminOperatorAccounts } from './auth/dev-local-seed.util';
import { CommunityModule } from './community';
import { HealthModule } from './health';
import { MentoringModule } from './mentoring';
import { HomeModule } from './home';
import { QuestionsModule } from './questions';
import { ReportsModule } from './reports';
import { RewardsModule } from './rewards';
import { VideosModule } from './videos';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    CommunityModule,
    HealthModule,
    HomeModule,
    QuestionsModule,
    ReportsModule,
    MentoringModule,
    VideosModule,
    RewardsModule,
    UploadsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: SessionIdentityGuard }],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.AZURE_TABLES_CONNECTION_STRING) {
      return;
    }

    if (process.env.DEV_SEED_ADMIN === 'true' || process.env.NODE_ENV === 'test') {
      await seedDevAdminOperatorAccounts(this.authService, process.env);
    }
  }
}
