import { Module } from '@nestjs/common';
import { AdminModule } from './admin';
import { AuthModule } from './auth';
import { CommunityModule } from './community';
import { DatabaseService } from './db/database.service';
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
  providers: [DatabaseService],
})
export class AppModule {}
