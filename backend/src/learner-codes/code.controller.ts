import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/auth-user.js';
import { AuthenticatedGuard } from '../common/authenticated.guard.js';
import { PermissionsGuard } from '../common/permissions.guard.js';
import { RequirePermissions } from '../common/permissions.decorator.js';
import { LearnerCodeService } from './code.service.js';
import { CodeAbbreviationDto, CodeAdvanceDto, CodeIssueDto, CodePreviewDto, CodeRecordTypeDto, CodeReissueDto, CodeRuleDto, CodeTypeDto } from './code.dto.js';

@Controller('learner-codes')
@UseGuards(AuthenticatedGuard,PermissionsGuard)
export class LearnerCodeController {
  constructor(private readonly codes:LearnerCodeService) {}
  @Get('config') @RequirePermissions('learnercode.config.view') config(@CurrentUser() actor:any){return this.codes.config(actor);}
  @Get('options') @RequirePermissions('admission.view') options(@CurrentUser() actor:any,@Query('recordId') recordId?:string){return this.codes.options(actor,recordId);}
  @Get('class/:id/records') @RequirePermissions('admission.view') classRecords(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string){return this.codes.classRecords(actor,id);}
  @Post('types') @RequirePermissions('learnercode.config.manage') createType(@CurrentUser() actor:any,@Body() dto:CodeTypeDto){return this.codes.saveType(actor,null,dto);}
  @Put('types/:id') @RequirePermissions('learnercode.config.manage') saveType(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CodeTypeDto){return this.codes.saveType(actor,id,dto);}
  @Put('abbreviations/:id') @RequirePermissions('learnercode.config.manage') abbreviation(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CodeAbbreviationDto){return this.codes.abbreviation(actor,id,dto.abbreviation);}
  @Post('rules') @RequirePermissions('learnercode.config.manage') createRule(@CurrentUser() actor:any,@Body() dto:CodeRuleDto){return this.codes.saveRule(actor,null,dto);}
  @Put('rules/:id') @RequirePermissions('learnercode.config.manage') saveRule(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CodeRuleDto){return this.codes.saveRule(actor,id,dto);}
  @Get('preview') @RequirePermissions('learnercode.preview') preview(@CurrentUser() actor:any,@Query() dto:CodePreviewDto){return this.codes.preview(actor,dto);}
  @Post('issue') @RequirePermissions('learnercode.issue') issue(@CurrentUser() actor:any,@Body() dto:CodeIssueDto){return this.codes.issue(actor,dto);}
  @Get('records/:id') @RequirePermissions('admission.view') record(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string){return this.codes.record(actor,id);}
  @Put('records/:id/type') @RequirePermissions('admission.view') type(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CodeRecordTypeDto){return this.codes.setType(actor,id,dto);}
  @Post('records/:id/reissue') @RequirePermissions('learnercode.reissue') reissue(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string,@Body() dto:CodeReissueDto){return this.codes.reissue(actor,id,dto);}
  @Get('records/:id/history') @RequirePermissions('learnercode.history.view') history(@CurrentUser() actor:any,@Param('id',ParseUUIDPipe) id:string){return this.codes.history(actor,id);}
  @Get('counters') @RequirePermissions('learnercode.config.view') counters(@CurrentUser() actor:any){return this.codes.counters(actor);}
  @Post('counters/advance') @RequirePermissions('learnercode.counter.advance') advance(@CurrentUser() actor:any,@Body() dto:CodeAdvanceDto){return this.codes.advance(actor,dto);}
}
