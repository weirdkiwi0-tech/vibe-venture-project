import { HomeService } from '../../src/home/home.service';
import { InMemoryAnswerRepository } from '../../src/questions/in-memory-answer.repository';
import { InMemoryQuestionLikeRepository } from '../../src/questions/in-memory-question-like.repository';
import { InMemoryQuestionRepository } from '../../src/questions/in-memory-question.repository';
import { QuestionsService } from '../../src/questions/questions.service';
import { InMemoryVideoRepository } from '../../src/videos/in-memory-video.repository';
import { VideosService } from '../../src/videos/videos.service';

describe('HomeService + domain services (integration)', () => {
  it('builds a combined home feed from real repositories', async () => {
    const questionsService = new QuestionsService(
      new InMemoryQuestionRepository(),
      new InMemoryAnswerRepository(),
      new InMemoryQuestionLikeRepository(),
    );
    const videosService = new VideosService(new InMemoryVideoRepository());
    const homeService = new HomeService(questionsService, videosService);

    const question = await questionsService.create({
      title: 'Integration question',
      body: 'Need help with algebra',
      subject: 'MATH',
      grade: '2',
    });
    await videosService.create({
      title: 'Integration video',
      url: 'https://stream.test/integration-video',
      durationSeconds: 150,
    });

    const feed = await homeService.getHomeFeed();

    expect(feed.videos).toHaveLength(1);
    expect(feed.questions).toHaveLength(1);
    expect(feed.questions[0].question.id).toBe(question.id);
    expect(feed.generatedAt).toBeDefined();
  });

  it('returns top 10 questions as popular 7 + help-needed 3 with no duplicates', async () => {
    const questionsService = new QuestionsService(
      new InMemoryQuestionRepository(),
      new InMemoryAnswerRepository(),
      new InMemoryQuestionLikeRepository(),
    );
    const videosService = new VideosService(new InMemoryVideoRepository());
    const homeService = new HomeService(questionsService, videosService);

    const ids: string[] = [];

    for (let i = 0; i < 12; i += 1) {
      const question = await questionsService.create({
        title: `home-policy-${i}`,
        body: 'body',
        subject: 'MATH',
        grade: '2',
      });
      ids.push(question.id);
    }

    for (let i = 0; i < 7; i += 1) {
      for (let j = 0; j < 20 - i; j += 1) {
        await questionsService.like(ids[i], `popular-user-${i}-${j}`);
      }
    }

    await questionsService.solve(ids[7]);

    for (let v = 0; v < 1; v += 1) {
      await questionsService.findById(ids[8]);
    }
    for (let v = 0; v < 2; v += 1) {
      await questionsService.findById(ids[9]);
    }
    for (let v = 0; v < 3; v += 1) {
      await questionsService.findById(ids[10]);
    }

    const feed = await homeService.getHomeFeed();
    const topIds = feed.questions.map((item) => item.question.id);
    const uniqueIds = new Set(topIds);

    expect(feed.questions).toHaveLength(10);
    expect(uniqueIds.size).toBe(10);
    expect(topIds.slice(0, 7)).toEqual(ids.slice(0, 7));
    expect(topIds.slice(7)).toEqual([ids[11], ids[8], ids[9]]);
  });
});