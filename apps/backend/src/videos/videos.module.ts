import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { DatabaseService } from '../db/database.service';
import { SqliteVideoRepository } from './sqlite-video.repository';
import { VIDEO_REPOSITORY } from './videos.repository';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [AuthModule],
  controllers: [VideosController],
  providers: [
    VideosService,
    DatabaseService,
    SqliteVideoRepository,
    {
      provide: VIDEO_REPOSITORY,
      useExisting: SqliteVideoRepository,
    },
  ],
  exports: [VideosService],
})
export class VideosModule {}
