import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { DatabaseService } from '../db/database.service';
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
    DatabaseService,
    SqliteMentoringSessionRepository,
    SqliteMentoringMessageRepository,
    {
      provide: MENTORING_SESSION_REPOSITORY,
      useExisting: SqliteMentoringSessionRepository,
    },
    {
      provide: MENTORING_MESSAGE_REPOSITORY,
      useExisting: SqliteMentoringMessageRepository,
    },
  ],
})
export class MentoringModule {}
