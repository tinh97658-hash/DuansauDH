import { Controller, Get, Post, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { AuthenticatedGuard } from '../common/authenticated.guard.js';
import { CurrentUser } from '../common/auth-user.js';
import { InboxService } from './inbox.service.js';

export class InboxQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 6;
}
@Controller('notifications')
@UseGuards(AuthenticatedGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}
  @Get() list(@CurrentUser() user: unknown, @Query() query: InboxQuery) { return this.inbox.list(user, query.page, query.pageSize); }
  @Get('unread-count') unread(@CurrentUser() user: unknown) { return this.inbox.unread(user); }
  @Post('read-all') readAll(@CurrentUser() user: unknown) { return this.inbox.readAll(user); }
  @Post(':id/read') read(@CurrentUser() user: unknown, @Param('id', ParseUUIDPipe) id: string) { return this.inbox.read(user, id); }
}
