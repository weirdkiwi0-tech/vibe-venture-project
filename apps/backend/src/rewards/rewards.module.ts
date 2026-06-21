import { Module } from '@nestjs/common';
import { InMemoryRewardRepository } from './in-memory-reward.repository';
import { REWARD_REPOSITORY } from './rewards.repository';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  controllers: [RewardsController],
  providers: [
    RewardsService,
    InMemoryRewardRepository,
    {
      provide: REWARD_REPOSITORY,
      useExisting: InMemoryRewardRepository,
    },
  ],
})
export class RewardsModule {}
