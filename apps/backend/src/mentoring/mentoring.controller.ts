import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { RequireRoles, RolesGuard } from '../auth';
import { CreateMentoringMessageDto } from './dto/create-mentoring-message.dto';
import { CreateMentoringSessionDto } from './dto/create-mentoring-session.dto';
import { MentoringService } from './mentoring.service';

@Controller('mentoring/sessions')
export class MentoringController {
  constructor(private readonly mentoringService: MentoringService) {}

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
  ) {
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
  async findSessionById(@Param('id') id: string) {
    const { session, messages, isSlaBreached } =
      await this.mentoringService.findSessionById(id);

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
