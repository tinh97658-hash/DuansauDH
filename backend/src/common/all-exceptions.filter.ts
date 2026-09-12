import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = error instanceof HttpException
      ? error.getStatus()
      : error?.name === "SequelizeUniqueConstraintError"
        ? HttpStatus.CONFLICT
        : error?.status || HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(error?.message || String(error), error?.stack);

    let message = status === HttpStatus.INTERNAL_SERVER_ERROR ? "Lỗi máy chủ nội bộ" : error?.message;
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    if (error instanceof HttpException) {
      const body = error.getResponse() as any;
      message = typeof body === "string" ? body : body?.message || message;
      if (typeof body === "object" && body !== null) {
        if (typeof body.code === "string") code = body.code;
        if (typeof body.details === "object" && body.details !== null) details = body.details;
      }
      // Nest's router emits `Cannot <METHOD> <PATH>` for an unknown endpoint.
      // Preserve domain-level NotFoundException messages such as a missing
      // subject/curriculum instead of incorrectly reporting them as bad routes.
      if (status === HttpStatus.NOT_FOUND && /^Cannot\s+[A-Z]+\s+\//.test(String(message || ""))) {
        message = "Không tìm thấy đường dẫn yêu cầu";
      }
    } else if (error?.name === "SequelizeUniqueConstraintError") {
      message = "Resource already exists";
    }
    if (Array.isArray(message)) message = message.join(", ");
    response.status(status).json({
      message: message || "Lỗi máy chủ nội bộ",
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    });
  }
}
