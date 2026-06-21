import { Controller, Delete, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { RequireRoles, RolesGuard } from '../auth';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
@RequireRoles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    this.adminService.deleteUser(id);
    return { success: true };
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string, @Body() body: { banUntil: string }) {
    this.adminService.banUser(id, body.banUntil);
    return { success: true };
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    this.adminService.unbanUser(id);
    return { success: true };
  }

  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body() body: { role: 'user' | 'admin' }) {
    this.adminService.updateUserRole(id, body.role);
    return { success: true };
  }
}