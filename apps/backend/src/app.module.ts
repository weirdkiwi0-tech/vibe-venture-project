import { Module, OnModuleInit } from '@nestjs/common';
import { AdminModule } from './admin';
import { AuthModule } from './auth';
import { AuthService } from './auth/auth.service';
import { seedDevAdminOperatorAccounts } from './auth/dev-local-seed.util';
import { CommunityModule } from './community';
import { MentoringModule } from './mentoring';
import { HomeModule } from './home';
import { QuestionsModule } from './questions';
import { ReportsModule } from './reports';
import { RewardsModule } from './rewards';
import { VideosModule } from './videos';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    CommunityModule,
    HomeModule,
    QuestionsModule,
    ReportsModule,
    MentoringModule,
    VideosModule,
    RewardsModule,
  ],
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
