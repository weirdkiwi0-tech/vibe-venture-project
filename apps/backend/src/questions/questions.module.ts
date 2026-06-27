import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ReportsModule } from '../reports/reports.module';
import { ANSWER_REPOSITORY } from './answers.repository';
import { AnswersService } from './answers.service';
import { InMemoryAnswerRepository } from './in-memory-answer.repository';
import { InMemoryQuestionLikeRepository } from './in-memory-question-like.repository';
import { InMemoryQuestionRepository } from './in-memory-question.repository';
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
    InMemoryQuestionRepository,
    InMemoryAnswerRepository,
    InMemoryQuestionLikeRepository,
    {
      provide: QUESTION_REPOSITORY,
      inject: [InMemoryQuestionRepository],
      useFactory: (inMemoryRepository: InMemoryQuestionRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteQuestionRepository();
      },
    },
    {
      provide: ANSWER_REPOSITORY,
      inject: [InMemoryAnswerRepository],
      useFactory: (inMemoryRepository: InMemoryAnswerRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteAnswerRepository();
      },
    },
    {
      provide: QUESTION_LIKE_REPOSITORY,
      inject: [InMemoryQuestionLikeRepository],
      useFactory: (inMemoryRepository: InMemoryQuestionLikeRepository) => {
        if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
          return inMemoryRepository;
        }

        return new SqliteQuestionLikeRepository();
      },
    },
  ],
  exports: [QuestionsService, AnswersService, QUESTION_REPOSITORY, ANSWER_REPOSITORY],
})
export class QuestionsModule {}
