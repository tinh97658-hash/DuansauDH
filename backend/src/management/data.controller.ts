import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/auth-user.js";
import { RequirePermissions } from "../common/permissions.decorator.js";
import { PermissionsGuard } from "../common/permissions.guard.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { StaffService } from "../staff/staff.service.js";
import { StudentsService } from "../students/students.service.js";

@Controller("data")
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class DataController {
  constructor(private readonly students: StudentsService, private readonly staff: StaffService) {}

  @Get("admin/dashboard")
  @RequirePermissions("account.view")
  async dashboard() { return { status: "success", users: await this.students.registered() }; }

  @Get("tobereviewed")
  @RequirePermissions("supervision.review")
  toBeReviewed(@CurrentUser() user: any) { return this.staff.studentsToReview(user.id); }

  @Get("profile/:id")
  @RequirePermissions("account.view")
  profile(@Param("id") id: string) { return this.students.profile(id); }

  @Post("submitreview")
  @RequirePermissions("supervision.review")
  review(@Body() body: unknown) { return { status: "success", message: body }; }
}
