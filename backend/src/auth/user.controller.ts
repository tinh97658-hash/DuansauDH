import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/auth-user.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { AllowPasswordChangeRequired } from "../common/allow-password-change-required.decorator.js";
import { StudentGuard } from "../common/student.guard.js";
import { photoUploadOptions, submissionUploadOptions, UploadAdmissionInterceptor } from "../common/uploads.js";
import { Staff } from "../database/models/staff.model.js";
import { StaffService } from "../staff/staff.service.js";
import { ForgotPasswordDto, ResetPasswordDto, UpdatePasswordDto } from "../students/dto/password.dto.js";
import { SubmissionDto } from "../students/dto/submission.dto.js";
import { StudentsService } from "../students/students.service.js";
import { AuthService } from "./auth.service.js";
import { LocalAuthGuard } from "./auth.guards.js";
import { LogoutOriginGuard } from "./logout-origin.guard.js";

@Controller("user")
export class UserController {
  constructor(
    private readonly students: StudentsService,
    private readonly staff: StaffService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  index() { return { message: "Đăng nhập thành công" }; }

  @Post("login")
  @UseGuards(LogoutOriginGuard, LocalAuthGuard)
  @HttpCode(200)
  login() { return { message: "Đăng nhập thành công" }; }

  @Get("profile")
  @UseGuards(AuthenticatedGuard)
  profile(@CurrentUser() user: any) {
    return user instanceof Staff ? this.staff.profile(user.id) : this.students.profile(user.id);
  }

  @Post("forgotPassword")
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.students.forgotPassword(input.email, String(this.config.getOrThrow("FRONTEND_URL")).replace(/\/$/, ""));
  }

  @Patch("resetPassword/:token")
  resetPassword(@Param("token") token: string, @Body() input: ResetPasswordDto) {
    return this.students.resetPassword(token, input.password);
  }

  @Patch("updatePassword")
  @UseGuards(StudentGuard)
  async updatePassword(@CurrentUser() user: any, @Body() input: UpdatePasswordDto, @Req() request: any) {
    const result = await this.students.updatePassword(user.id, input);
    user.sessionVersion = result.sessionVersion;
    await new Promise<void>((resolve, reject) => request.logIn(user, (error: Error) => error ? reject(error) : resolve()));
    return { message: result.message };
  }

  @Post("submit")
  @UseGuards(StudentGuard)
  @UseInterceptors(UploadAdmissionInterceptor, FileInterceptor("submissionFile", submissionUploadOptions))
  submit(@CurrentUser() user: any, @Body() input: SubmissionDto, @UploadedFile() file?: Express.Multer.File) {
    return this.students.submit(user.id, input.submission, file);
  }

  @Patch("uploadpp")
  @UseGuards(StudentGuard)
  @UseInterceptors(UploadAdmissionInterceptor, FileInterceptor("photo", photoUploadOptions))
  uploadPhoto(@CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.students.updatePhoto(user.id, file);
  }

  @Post("logout")
  @UseGuards(LogoutOriginGuard)
  @AllowPasswordChangeRequired()
  async logout(@Req() request: any, @Res() response: Response) {
    const user = request.user;
    await new Promise<void>((resolve, reject) => request.logout((error: Error) => error ? reject(error) : resolve()));
    // Passport regenerates the session on logout. Destroy that anonymous session
    // too, rather than leaving a replacement SID in the browser/session store.
    if (request.session) {
      await new Promise<void>((resolve, reject) => request.session.destroy((error: Error) => error ? reject(error) : resolve()));
    }
    response.clearCookie("pgsms.sid", {
      path: "/", httpOnly: true, sameSite: "lax",
      secure: this.config.get<boolean>("SESSION_COOKIE_SECURE") ?? this.config.get("NODE_ENV") === "production",
    });
    if (user instanceof Staff) await this.auth.recordLogout(user);
    return response.status(204).send();
  }
}
