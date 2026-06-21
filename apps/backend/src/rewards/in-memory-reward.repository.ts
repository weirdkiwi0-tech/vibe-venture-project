import { Injectable } from '@nestjs/common';
import { RewardPointEntity } from './entities/reward-point.entity';
import { RewardRepository } from './rewards.repository';

@Injectable()
export class InMemoryRewardRepository implements RewardRepository {
  private readonly store = new Map<string, RewardPointEntity>();

  async save(entry: RewardPointEntity): Promise<void> {
    this.store.set(entry.id, entry);
  }

  async listByUserId(userId: string): Promise<RewardPointEntity[]> {
    return Array.from(this.store.values())
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
