import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import { AddStaffDto } from "../staff/dto/staff.dto.js";
import { StaffService } from "../staff/staff.service.js";

@Controller("admin")
@Roles("admin")
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly staff: StaffService) {}

  @Post("addStaff") addStaff(@Body() input: AddStaffDto) { return this.staff.add(input); }
}
