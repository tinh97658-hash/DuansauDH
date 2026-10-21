import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Logout is a browser session mutation: accept only the configured UI origin,
 * including its scheme and port. Never infer trust from Host/forwarded headers.
 * Missing/opaque origins fail closed; non-browser clients must send Origin too. */
@Injectable()
export class LogoutOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const origin = context.switchToHttp().getRequest().get("origin");
    try {
      const frontend = new URL(this.config.getOrThrow<string>("FRONTEND_URL"));
      if (!["http:", "https:"].includes(frontend.protocol) || !origin || origin === "null") throw new Error();
      const supplied = new URL(origin);
      if (origin !== supplied.origin || supplied.origin !== frontend.origin) throw new Error();
    } catch {
      throw new ForbiddenException("Nguồn yêu cầu đăng xuất không hợp lệ.");
    }
    return true;
  }
}
