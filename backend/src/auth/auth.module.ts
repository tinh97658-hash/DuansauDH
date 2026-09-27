import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { StaffModule } from "../staff/staff.module.js";
import { StudentsModule } from "../students/students.module.js";
import { AuthController } from "./auth.controller.js";
import { GoogleAuthGuard, LocalAuthGuard } from "./auth.guards.js";
import { AuthService } from "./auth.service.js";
import { GoogleStrategy } from "./google.strategy.js";
import { LocalStrategy } from "./local.strategy.js";
import { SessionSerializer } from "./session.serializer.js";
import { UserController } from "./user.controller.js";
import { AuthenticatedGuard } from "../common/authenticated.guard.js";
import { RolesGuard } from "../common/roles.guard.js";

@Module({
  imports: [PassportModule.register({ session: true }), StaffModule, StudentsModule],
  controllers: [AuthController, UserController],
  providers: [AuthService, LocalStrategy, GoogleStrategy, SessionSerializer, LocalAuthGuard, GoogleAuthGuard, AuthenticatedGuard, RolesGuard],
  exports: [PassportModule],
})
export class AuthModule {}
