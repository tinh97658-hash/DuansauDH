import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { AuthenticatedGuard } from '../common/authenticated.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/permissions.decorator.js';
import { GroupResponsibilityService } from './group-responsibility.service.js';

export class AssignGroupStaffDto {
  @IsUUID() responsibleStaffId!: string;
}

@Controller('groups')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions('groups.assign')
export class GroupResponsibilityController {
  constructor(private readonly groups: GroupResponsibilityService) {}

  @Get('assignees') assignees() { return this.groups.assignees(); }

  @Put(':id/responsible-staff')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignGroupStaffDto) {
    return this.groups.assign(id, dto.responsibleStaffId);
  }
}
