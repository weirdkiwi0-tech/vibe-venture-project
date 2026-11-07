import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, RequireRoles, RolesGuard } from '../auth';
import { CreateMentoringMessageDto } from './dto/create-mentoring-message.dto';
import { CreateMentoringSessionDto } from './dto/create-mentoring-session.dto';
import { MentoringService } from './mentoring.service';

@Controller('mentoring/sessions')
export class MentoringController {
  constructor(private readonly mentoringService: MentoringService, private readonly authService: AuthService) {}

  private async requireParticipant(id: string, req: Request) {
    const user = await this.authService.getUserBySessionId(req.cookies?.['keepit-session']);
    if (!user) throw new UnauthorizedException('authenticated session required');
    const detail = await this.mentoringService.findSessionById(id);
    if (detail.session.learnerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('only participants can access mentoring');
    }
    return { user, detail };
  }

  @Post()
  async createSession(
    @Body() body: CreateMentoringSessionDto,
    @Headers('x-user-id') learnerId?: string,
  ) {
    const session = await this.mentoringService.createSession(body, learnerId);
    return {
      id: session.id,
      learnerId: session.learnerId,
      question: session.question,
      createdAt: session.createdAt.toISOString(),
      firstMentorResponseAt: session.firstMentorResponseAt,
    };
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() body: CreateMentoringMessageDto,
    @Req() req: Request,
  ) {
    const { user, detail } = await this.requireParticipant(id, req);
    const sender = detail.session.learnerId === user.id ? 'learner' : 'mentor';
    if (body.sender !== sender) throw new ForbiddenException('cannot impersonate mentoring role');
    const message = await this.mentoringService.sendMessage(id, body);
    return {
      id: message.id,
      sessionId: message.sessionId,
      sender: message.sender,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  @Get(':id')
  async findSessionById(@Param('id') id: string, @Req() req: Request) {
    const { session, messages, isSlaBreached } =
      (await this.requireParticipant(id, req)).detail;

    return {
      id: session.id,
      learnerId: session.learnerId,
      question: session.question,
      createdAt: session.createdAt.toISOString(),
      firstMentorResponseAt: session.firstMentorResponseAt
        ? session.firstMentorResponseAt.toISOString()
        : null,
      isSlaBreached,
      messages: messages.map((message) => ({
        id: message.id,
        sessionId: message.sessionId,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Get('sla/breaches')
  async listSlaBreaches() {
    const sessions = await this.mentoringService.listSlaBreaches();

    return sessions.map((session) => ({
      id: session.id,
      learnerId: session.learnerId,
      question: session.question,
      createdAt: session.createdAt.toISOString(),
      firstMentorResponseAt: session.firstMentorResponseAt
        ? session.firstMentorResponseAt.toISOString()
        : null,
      isSlaBreached: session.isSlaBreached,
    }));
  }
}
