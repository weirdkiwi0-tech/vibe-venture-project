import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { InMemoryMentoringMessageRepository } from './in-memory-mentoring-message.repository';
import { InMemoryMentoringSessionRepository } from './in-memory-mentoring-session.repository';
import { SqliteMentoringMessageRepository } from './sqlite-mentoring-message.repository';
import { SqliteMentoringSessionRepository } from './sqlite-mentoring-session.repository';
import { MentoringController } from './mentoring.controller';
import {
  MENTORING_MESSAGE_REPOSITORY,
} from './mentoring-message.repository';
import {
  MENTORING_SESSION_REPOSITORY,
} from './mentoring-session.repository';
import { MentoringService } from './mentoring.service';

@Module({
  imports: [AuthModule],
  controllers: [MentoringController],
  providers: [
    MentoringService,
    InMemoryMentoringSessionRepository,
    InMemoryMentoringMessageRepository,
    {
      provide: MENTORING_SESSION_REPOSITORY,
      inject: [InMemoryMentoringSessionRepository],
      useFactory: (inMemoryRepository: InMemoryMentoringSessionRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteMentoringSessionRepository();
      },
    },
    {
      provide: MENTORING_MESSAGE_REPOSITORY,
      inject: [InMemoryMentoringMessageRepository],
      useFactory: (inMemoryRepository: InMemoryMentoringMessageRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteMentoringMessageRepository();
      },
    },
  ],
})
export class MentoringModule {}
