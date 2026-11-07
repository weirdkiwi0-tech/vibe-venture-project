import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, RequireRoles, RolesGuard } from '../auth';
import { EarnRewardDto } from './dto/earn-reward.dto';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService, private readonly authService: AuthService) {}

  @Post('earn')
  @UseGuards(RolesGuard)
  @RequireRoles('admin')
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
  async getHistory(@Param('userId') userId: string, @Req() req: Request) {
    const user = await this.authService.getUserBySessionId(req.cookies?.['keepit-session']);
    if (!user) throw new UnauthorizedException('authenticated session required');
    if (user.id !== userId && user.role !== 'admin') throw new ForbiddenException('reward history is private');
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
