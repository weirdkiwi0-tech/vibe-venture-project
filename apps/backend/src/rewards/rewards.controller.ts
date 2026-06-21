import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EarnRewardDto } from './dto/earn-reward.dto';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Post('earn')
  async earn(@Body() body: EarnRewardDto) {
    const entry = await this.rewardsService.earn(body);
    return {
      id: entry.id,
      userId: entry.userId,
      reason: entry.reason,
      points: entry.points,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  @Get('users/:userId/history')
  async getHistory(@Param('userId') userId: string) {
    const { entries, totalPoints } = await this.rewardsService.getHistory(userId);

    return {
      userId,
      totalPoints,
      entries: entries.map((entry) => ({
        id: entry.id,
        userId: entry.userId,
        reason: entry.reason,
        points: entry.points,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }
}
