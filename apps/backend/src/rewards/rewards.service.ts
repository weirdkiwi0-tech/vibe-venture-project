import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EarnRewardDto } from './dto/earn-reward.dto';
import { RewardPointEntity } from './entities/reward-point.entity';
import { REWARD_REPOSITORY, RewardRepository } from './rewards.repository';

@Injectable()
export class RewardsService {
  constructor(
    @Inject(REWARD_REPOSITORY)
    private readonly rewardRepository: RewardRepository,
  ) {}

  async earn(input: EarnRewardDto) {
    const entry = RewardPointEntity.create({
      id: randomUUID(),
      userId: input.userId,
      reason: input.reason,
      points: input.points,
    });

    await this.rewardRepository.save(entry);
    return entry;
  }

  async getHistory(userId: string) {
    const entries = await this.rewardRepository.listByUserId(userId);
    const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);

    return { entries, totalPoints };
  }
}
