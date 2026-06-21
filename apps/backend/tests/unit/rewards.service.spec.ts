import { InMemoryRewardRepository } from '../../src/rewards/in-memory-reward.repository';
import { RewardsService } from '../../src/rewards/rewards.service';

describe('RewardsService (unit)', () => {
  let service: RewardsService;

  beforeEach(() => {
    service = new RewardsService(new InMemoryRewardRepository());
  });

  it('earns points', async () => {
    const entry = await service.earn({
      userId: 'u-1',
      reason: 'first answer',
      points: 20,
    });

    expect(entry.id).toBeDefined();
    expect(entry.points).toBe(20);
  });

  it('returns history with total points', async () => {
    await service.earn({
      userId: 'u-1',
      reason: 'first answer',
      points: 20,
    });
    await service.earn({
      userId: 'u-1',
      reason: 'helpful answer',
      points: 15,
    });

    const history = await service.getHistory('u-1');
    expect(history.entries).toHaveLength(2);
    expect(history.totalPoints).toBe(35);
  });
});
