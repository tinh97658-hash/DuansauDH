import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { trustedOrigin } from '../common/request-security.js';

/** Login and logout mutate browser sessions: accept only the configured UI origin,
 * including its scheme and port. Never infer trust from Host/forwarded headers.
 * Missing/opaque origins fail closed; non-browser clients must send Origin too. */
@Injectable()
export class LogoutOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const origin = context.switchToHttp().getRequest().get("origin");
    if (!trustedOrigin(origin, this.config.getOrThrow<string>('FRONTEND_URL'))) {
      throw new ForbiddenException("Nguồn yêu cầu không hợp lệ.");
    }
    return true;
  }
}
