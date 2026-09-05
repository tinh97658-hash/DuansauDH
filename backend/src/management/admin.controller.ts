import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import { AddStaffDto, ResetStaffPasswordDto, UpdateStaffDto } from "../staff/dto/staff.dto.js";
import { StaffService } from "../staff/staff.service.js";

@Controller("admin")
@Roles("admin")
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly staff: StaffService) {}

  @Post("addStaff") addStaff(@Body() input: AddStaffDto) { return this.staff.add(input); }
  @Get("users") users(@Query("q") query?: string, @Query("role") role?: string) { return this.staff.list(query, role); }
  @Post("users") createUser(@Body() input: AddStaffDto) { return this.staff.add(input); }
  @Patch("users/:id") updateUser(@Param("id") id: string, @Body() input: UpdateStaffDto, @CurrentUser() actor: any) {
    return this.staff.update(id, input, actor.id);
  }
  @Patch("users/:id/password") resetPassword(@Param("id") id: string, @Body() input: ResetStaffPasswordDto) {
    return this.staff.resetPassword(id, input.password);
  }
}
