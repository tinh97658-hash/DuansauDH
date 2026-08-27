import { ExecutionContext, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    // @nestjs/passport v11 không tự gọi req.logIn() khi authenticate kèm callback,
    // nên phải tự đăng nhập vào session tại đây (nếu không login sẽ không lưu phiên).
    await this.logIn(context.switchToHttp().getRequest());
    return true;
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private readonly config: ConfigService) { super(); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const configOk = Boolean(this.config.get("GOOGLE_CLIENT_ID") && this.config.get("GOOGLE_CLIENT_SECRET"));
    if (!configOk) {
      throw new ServiceUnavailableException("Đăng nhập Google chưa được cấu hình");
    }
    await super.canActivate(context);
    await this.logIn(context.switchToHttp().getRequest());
    return true;
  }
}
