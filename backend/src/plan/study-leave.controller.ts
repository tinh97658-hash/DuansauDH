import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../common/authenticated.guard.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CurrentUser, Roles } from '../common/auth-user.js';
import { StudyLeaveService } from './study-leave.service.js';
import { RequestStudyLeaveDto, StudyLeaveActionDto } from './dto/study-leave.dto.js';

@Controller('plan')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('admin', 'supervisor', 'examiner')
export class StudyLeaveController {
  constructor(private readonly leaves: StudyLeaveService) {}
  @Get('study-leaves') list(@Query() query: any) { return this.leaves.list(query); }
  @Get('admission-records/:id/study-leaves') detail(@Param('id', ParseUUIDPipe) id: string) { return this.leaves.detail(id); }
  @Post('admission-records/:id/study-leaves') @Roles('admin') @UseGuards(RolesGuard)
  request(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestStudyLeaveDto, @CurrentUser() actor: any) {
    return this.leaves.request(id, dto, actor);
  }
  @Post('study-leaves/:id/actions') @Roles('admin') @UseGuards(RolesGuard)
  action(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StudyLeaveActionDto, @CurrentUser() actor: any) {
    return this.leaves.action(id, dto, actor);
  }
}
