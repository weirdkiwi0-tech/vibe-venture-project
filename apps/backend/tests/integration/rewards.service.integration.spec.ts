import { InMemoryRewardRepository } from '../../src/rewards/in-memory-reward.repository';
import { RewardsService } from '../../src/rewards/rewards.service';

describe('RewardsService + Repository (integration)', () => {
  it('stores entries and returns user history', async () => {
    const service = new RewardsService(new InMemoryRewardRepository());

    await service.earn({ userId: 'user-a', reason: 'answer-1', points: 10 });
    await service.earn({ userId: 'user-a', reason: 'answer-2', points: 25 });
    await service.earn({ userId: 'user-b', reason: 'answer-3', points: 50 });

    const history = await service.getHistory('user-a');

    expect(history.entries).toHaveLength(2);
    expect(history.totalPoints).toBe(35);
  });
});
