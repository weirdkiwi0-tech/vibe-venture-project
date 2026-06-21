import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { QuestionsModule } from '../questions/questions.module';
import { ReportsModule } from '../reports';
import { VideosModule } from '../videos';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, ReportsModule, QuestionsModule, VideosModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}