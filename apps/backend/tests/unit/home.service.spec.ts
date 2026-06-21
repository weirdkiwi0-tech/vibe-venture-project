import { HomeService } from '../../src/home/home.service';

describe('HomeService (unit)', () => {
  it('combines videos and questions into a home feed', async () => {
    const questionsService = {
      listTopQuestions: jest.fn().mockResolvedValue([
        {
          question: {
            id: 'q-1',
            title: 'Question 1',
            body: 'Body 1',
            subject: 'MATH',
            grade: '2',
            attachments: [],
            visibility: 'anonymous' as const,
            status: 'open' as const,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          answerCount: 3,
        },
      ]),
    };

    const videosService = {
      listHomeTopVideos: jest.fn().mockResolvedValue([
        {
          id: 'v-1',
          title: 'Video 1',
          url: 'https://stream.test/v1',
          durationSeconds: 120,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]),
    };

    const service = new HomeService(
      questionsService as never,
      videosService as never,
    );

    const result = await service.getHomeFeed();

    expect(questionsService.listTopQuestions).toHaveBeenCalledTimes(1);
    expect(videosService.listHomeTopVideos).toHaveBeenCalledTimes(1);
    expect(result.videos).toHaveLength(1);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answerCount).toBe(3);
    expect(result.generatedAt).toBeDefined();
  });
});