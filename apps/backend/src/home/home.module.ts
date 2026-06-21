import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { QuestionsModule } from '../questions';
import { VideosModule } from '../videos';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [AuthModule, QuestionsModule, VideosModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}