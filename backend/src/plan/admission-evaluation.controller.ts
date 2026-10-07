import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { CurrentUser, Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import { AdmissionEvaluationService } from "./admission-evaluation.service.js";
import { BulkAdmissionScoresDto, ConfirmAdmissionBatchDto, DecideAdmissionDto, SaveAdmissionEvaluationDto, SaveAdmissionRoundDto } from "./dto/admission.dto.js";

@Controller("plan")
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles("admin", "supervisor", "examiner")
export class AdmissionEvaluationController {
  constructor(private readonly service: AdmissionEvaluationService) {}
  @Get("admission-rounds") rounds() { return this.service.listRounds(); }
  @Post("admission-rounds") @Roles("admin") createRound(@Body() dto: SaveAdmissionRoundDto) { return this.service.saveRound(undefined, dto); }
  @Put("admission-rounds/:id") @Roles("admin") updateRound(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveAdmissionRoundDto) { return this.service.saveRound(id, dto); }
  @Get("admission-rounds/:id/ranking") ranking(@Param("id", ParseUUIDPipe) id: string) { return this.service.ranking(id); }
  @Put("admission-rounds/:id/scores") @Roles("admin") scores(@Param("id", ParseUUIDPipe) id: string, @Body() dto: BulkAdmissionScoresDto, @CurrentUser() actor: any) { return this.service.saveScores(id, dto, actor); }
  @Post("admission-rounds/:id/preview") @Roles("admin") preview(@Param("id", ParseUUIDPipe) id: string) { return this.service.preview(id); }
  @Post("admission-rounds/:id/confirm") @Roles("admin") confirm(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ConfirmAdmissionBatchDto, @CurrentUser() actor: any) { return this.service.confirmBatch(id, dto, actor); }
  @Get("admission-records/:id/evaluation") detail(@Param("id", ParseUUIDPipe) id: string) { return this.service.detail(id); }
  @Put("admission-records/:id/evaluation") @Roles("admin") save(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveAdmissionEvaluationDto, @CurrentUser() actor: any) { return this.service.save(id, dto, actor); }
  @Post("admission-records/:id/evaluation/decision") @Roles("admin") decide(@Param("id", ParseUUIDPipe) id: string, @Body() dto: DecideAdmissionDto, @CurrentUser() actor: any) { return this.service.decide(id, dto, actor); }
}
