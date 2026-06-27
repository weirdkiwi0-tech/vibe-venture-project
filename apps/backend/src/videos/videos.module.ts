import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { InMemoryVideoRepository } from './in-memory-video.repository';
import { SqliteVideoRepository } from './sqlite-video.repository';
import { VIDEO_REPOSITORY } from './videos.repository';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [AuthModule],
  controllers: [VideosController],
  providers: [
    VideosService,
    InMemoryVideoRepository,
    {
      provide: VIDEO_REPOSITORY,
      inject: [InMemoryVideoRepository],
      useFactory: (inMemoryRepository: InMemoryVideoRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteVideoRepository();
      },
    },
  ],
  exports: [VideosService],
})
export class VideosModule {}
