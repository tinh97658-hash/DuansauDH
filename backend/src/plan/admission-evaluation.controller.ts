import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser } from "../common/auth-user.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { AdmissionEvaluationService } from "./admission-evaluation.service.js";
import { BulkAdmissionScoresDto, ConfirmAdmissionBatchDto, ConfirmAdmissionTuitionBatchDto, DecideAdmissionDto, SaveAdmissionEvaluationDto, SaveAdmissionRoundDto, UpdateAdmissionTuitionDto, WithdrawUnpaidAdmissionDto } from "./dto/admission.dto.js";

@Controller("plan")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@RequirePermissions("admission.view")
export class AdmissionEvaluationController {
  constructor(private readonly service: AdmissionEvaluationService) {}
  @Get("admission-rounds") rounds() { return this.service.listRounds(); }
  @Post("admission-rounds") @RequirePermissions("admission.manage") createRound(@Body() dto: SaveAdmissionRoundDto) { return this.service.saveRound(undefined, dto); }
  @Put("admission-rounds/:id") @RequirePermissions("admission.manage") updateRound(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveAdmissionRoundDto) { return this.service.saveRound(id, dto); }
  @Get("admission-rounds/:id/ranking") ranking(@Param("id", ParseUUIDPipe) id: string) { return this.service.ranking(id); }
  @Put("admission-rounds/:id/scores") @RequirePermissions("admission.manage") scores(@Param("id", ParseUUIDPipe) id: string, @Body() dto: BulkAdmissionScoresDto, @CurrentUser() actor: any) { return this.service.saveScores(id, dto, actor); }
  @Post("admission-rounds/:id/preview") @RequirePermissions("admission.manage") preview(@Param("id", ParseUUIDPipe) id: string) { return this.service.preview(id); }
  @Post("admission-rounds/:id/confirm") @RequirePermissions("admission.manage") confirm(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ConfirmAdmissionBatchDto, @CurrentUser() actor: any) { return this.service.confirmBatch(id, dto, actor); }
  @Get("admission-records/:id/evaluation") detail(@Param("id", ParseUUIDPipe) id: string) { return this.service.detail(id); }
  @Put("admission-records/:id/tuition") @RequirePermissions("admission.manage") tuition(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAdmissionTuitionDto, @CurrentUser() actor: any) { return this.service.updateTuition(id, dto, actor); }
  @Post("admission-records/:id/withdraw-unpaid") @RequirePermissions("admission.manage") withdrawUnpaid(@Param("id", ParseUUIDPipe) id: string, @Body() dto: WithdrawUnpaidAdmissionDto, @CurrentUser() actor: any) { return this.service.withdrawUnpaid(id, dto, actor); }
  @Put("admission-records/tuition/confirm-batch") @RequirePermissions("admission.manage") tuitionBatch(@Body() dto: ConfirmAdmissionTuitionBatchDto, @CurrentUser() actor: any) { return this.service.confirmTuitionBatch(dto, actor); }
  @Put("admission-records/:id/evaluation") @RequirePermissions("admission.manage") save(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveAdmissionEvaluationDto, @CurrentUser() actor: any) { return this.service.save(id, dto, actor); }
  @Post("admission-records/:id/evaluation/decision") @RequirePermissions("admission.manage") decide(@Param("id", ParseUUIDPipe) id: string, @Body() dto: DecideAdmissionDto, @CurrentUser() actor: any) { return this.service.decide(id, dto, actor); }
}
