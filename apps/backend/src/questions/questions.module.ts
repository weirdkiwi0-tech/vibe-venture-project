import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ReportsModule } from '../reports/reports.module';
import { DatabaseService } from '../db/database.service';
import { ANSWER_REPOSITORY } from './answers.repository';
import { AnswersService } from './answers.service';
import { SqliteAnswerRepository } from './sqlite-answer.repository';
import { SqliteQuestionLikeRepository } from './sqlite-question-like.repository';
import { SqliteQuestionRepository } from './sqlite-question.repository';
import { QUESTION_LIKE_REPOSITORY } from './question-like.repository';
import { QuestionsController } from './questions.controller';
import { QUESTION_REPOSITORY } from './questions.repository';
import { QuestionsService } from './questions.service';

@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [QuestionsController],
  providers: [
    QuestionsService,
    AnswersService,
    DatabaseService,
    SqliteQuestionRepository,
    SqliteAnswerRepository,
    SqliteQuestionLikeRepository,
    {
      provide: QUESTION_REPOSITORY,
      useExisting: SqliteQuestionRepository,
    },
    {
      provide: ANSWER_REPOSITORY,
      useExisting: SqliteAnswerRepository,
    },
    {
      provide: QUESTION_LIKE_REPOSITORY,
      useExisting: SqliteQuestionLikeRepository,
    },
  ],
  exports: [QuestionsService, AnswersService, QUESTION_REPOSITORY, ANSWER_REPOSITORY],
})
export class QuestionsModule {}
