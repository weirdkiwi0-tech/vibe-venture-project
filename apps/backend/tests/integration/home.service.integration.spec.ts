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
});