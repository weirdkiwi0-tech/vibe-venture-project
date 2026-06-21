import { RewardPointEntity } from '../../src/rewards/entities/reward-point.entity';
import { DomainValidationError } from '../../src/rewards/errors/domain-validation.error';

describe('RewardPointEntity (unit)', () => {
  it('creates reward point entry', () => {
    const entry = RewardPointEntity.create({
      id: 'rp-1',
      userId: 'u-1',
      reason: 'answer accepted',
      points: 30,
    });

    expect(entry.userId).toBe('u-1');
    expect(entry.points).toBe(30);
  });

  it('throws when points are invalid', () => {
    expect(() =>
      RewardPointEntity.create({
        id: 'rp-2',
        userId: 'u-1',
        reason: 'invalid',
        points: 0,
      }),
    ).toThrow(DomainValidationError);
  });
});
