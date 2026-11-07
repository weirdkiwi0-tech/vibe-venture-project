import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InMemoryRewardRepository } from './in-memory-reward.repository';
import { REWARD_REPOSITORY } from './rewards.repository';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [AuthModule],
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
