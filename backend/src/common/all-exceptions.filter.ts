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
    if (error instanceof HttpException) {
      const body = error.getResponse() as any;
      message = typeof body === "string" ? body : body?.message || message;
      if (status === HttpStatus.NOT_FOUND) message = "Không tìm thấy đường dẫn yêu cầu";
    } else if (error?.name === "SequelizeUniqueConstraintError") {
      message = "Resource already exists";
    }
    if (Array.isArray(message)) message = message.join(", ");
    response.status(status).json({ message: message || "Lỗi máy chủ nội bộ" });
  }
}
