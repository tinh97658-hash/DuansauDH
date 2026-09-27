import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, Roles } from "../common/auth-user.js";
import { RolesGuard } from "../common/roles.guard.js";
import { StaffService } from "../staff/staff.service.js";
import { StudentsService } from "../students/students.service.js";

@Controller("data")
export class DataController {
  constructor(private readonly students: StudentsService, private readonly staff: StaffService) {}

  @Get("admin/dashboard")
  @Roles("admin") @UseGuards(RolesGuard)
  async dashboard() { return { status: "success", users: await this.students.registered() }; }

  @Get("tobereviewed")
  @Roles("supervisor", "admin") @UseGuards(RolesGuard)
  toBeReviewed(@CurrentUser() user: any) { return this.staff.studentsToReview(user.id); }

  @Get("profile/:id")
  @Roles("admin") @UseGuards(RolesGuard)
  profile(@Param("id") id: string) { return this.students.profile(id); }

  @Post("submitreview")
  @Roles("supervisor", "admin") @UseGuards(RolesGuard)
  review(@Body() body: unknown) { return { status: "success", message: body }; }
}
