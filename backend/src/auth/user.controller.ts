import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { CurrentUser, Roles } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { RolesGuard } from "../common/roles.guard.js";
import { photoUploadOptions, submissionUploadOptions } from "../common/uploads.js";
import { Staff } from "../database/models/staff.model.js";
import { StaffService } from "../staff/staff.service.js";
import { ForgotPasswordDto, ResetPasswordDto, UpdatePasswordDto } from "../students/dto/password.dto.js";
import { SubmissionDto } from "../students/dto/submission.dto.js";
import { StudentsService } from "../students/students.service.js";
import { LocalAuthGuard } from "./auth.guards.js";

@Controller("user")
export class UserController {
  constructor(private readonly students: StudentsService, private readonly staff: StaffService, private readonly config: ConfigService) {}

  @Get()
  index() { return { message: "Đăng nhập thành công" }; }

  @Post("login")
  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  login() { return { message: "Đăng nhập thành công" }; }

  @Get("profile")
  @UseGuards(AuthenticatedGuard)
  profile(@CurrentUser() user: any) {
    return user instanceof Staff ? this.staff.profile(user.id) : this.students.profile(user.id);
  }

  @Post("forgotPassword")
  forgotPassword(@Body() input: ForgotPasswordDto, @Req() request: Request) {
    return this.students.forgotPassword(input.email, `${request.protocol}://${request.get("host")}`);
  }

  @Patch("resetPassword/:token")
  resetPassword(@Param("token") token: string, @Body() input: ResetPasswordDto) {
    return this.students.resetPassword(token, input.password);
  }

  @Patch("updatePassword")
  @Roles("student")
  @UseGuards(RolesGuard)
  updatePassword(@CurrentUser() user: any, @Body() input: UpdatePasswordDto) {
    return this.students.updatePassword(user.id, input);
  }

  @Post("submit")
  @Roles("student")
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor("submissionFile", submissionUploadOptions))
  submit(@CurrentUser() user: any, @Body() input: SubmissionDto, @UploadedFile() file?: Express.Multer.File) {
    return this.students.submit(user.id, input.submission, file);
  }

  @Patch("uploadpp")
  @Roles("student")
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor("photo", photoUploadOptions))
  uploadPhoto(@CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.students.updatePhoto(user.id, file);
  }

  @Get("logout")
  logout(@Req() request: any, @Res() response: Response) {
    request.logout((error: Error) => {
      if (error) return response.status(500).json({ message: "Lỗi máy chủ nội bộ" });
      return response.redirect(`${String(this.config.get("FRONTEND_URL")).replace(/\/$/, "")}/login`);
    });
  }
}
