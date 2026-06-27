import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RequireRoles, RolesGuard } from '../auth';
import { AuthService } from '../auth/auth.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(
    @Body() body: CreateReportDto,
    @Req() req: Request,
    @Headers('x-user-id') reporterId?: string,
  ) {
    const sessionId = req.cookies?.['keepit-session'] as string | undefined;
    const user = await this.authService.getUserBySessionId(sessionId);
    const resolvedReporterId = user?.id ?? reporterId;
    const report = await this.reportsService.create(body, resolvedReporterId);
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      severity: report.severity,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @Get()
  async listAll() {
    const reports = await this.reportsService.listAll();
    return reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      severity: report.severity,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    }));
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Get('queue')
  async listQueue(@Query('status') status?: string | string[]) {
    const statuses = Array.isArray(status)
      ? status
      : typeof status === 'string' && status.length > 0
        ? status.split(',')
        : undefined;

    const reports = await this.reportsService.listQueue(
      (statuses as Array<'pending' | 'reviewing'> | undefined) ?? ['pending', 'reviewing'],
    );

    return reports.map((report) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      severity: report.severity,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    }));
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: ModerationActionDto,
    @Headers('x-user-id') adminId?: string,
  ) {
    const report = await this.reportsService.approve(id, body.reason, adminId ?? body.adminId);
    return {
      id: report.id,
      status: report.status,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: ModerationActionDto,
    @Headers('x-user-id') adminId?: string,
  ) {
    const report = await this.reportsService.reject(id, body.reason, adminId ?? body.adminId);
    return {
      id: report.id,
      status: report.status,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Post(':id/restore')
  async restore(
    @Param('id') id: string,
    @Body() body: ModerationActionDto,
    @Headers('x-user-id') adminId?: string,
  ) {
    const report = await this.reportsService.restore(id, body.reason, adminId ?? body.adminId);
    return {
      id: report.id,
      status: report.status,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Post(':id/delete-target')
  async deleteTarget(
    @Param('id') id: string,
    @Body() body: ModerationActionDto,
    @Headers('x-user-id') adminId?: string,
  ) {
    const report = await this.reportsService.deleteTargetAndResolve(id, body.reason, adminId ?? body.adminId);
    return {
      id: report.id,
      status: report.status,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      createdAt: report.createdAt.toISOString(),
    };
  }

  @UseGuards(RolesGuard)
  @RequireRoles('admin')
  @Get('audit-logs')
  async listAuditLogs() {
    const logs = await this.reportsService.listAuditLogs();
    return logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      reason: log.reason,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
