import { RewardPointEntity } from './entities/reward-point.entity';

export const REWARD_REPOSITORY = Symbol('REWARD_REPOSITORY');

export interface RewardRepository {
  save(entry: RewardPointEntity): Promise<void>;
  listByUserId(userId: string): Promise<RewardPointEntity[]>;
}
