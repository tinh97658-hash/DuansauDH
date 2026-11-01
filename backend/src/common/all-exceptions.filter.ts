import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(error: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const isUniqueConstraint = error?.name === "SequelizeUniqueConstraintError";
    const isForeignKeyConstraint = error?.name === "SequelizeForeignKeyConstraintError";
    const isValidationError = error?.name === "SequelizeValidationError";
    const constraint = error?.original?.constraint || error?.parent?.constraint;
    const isLearnerCodeConflict = ["admission_records_code_reserved", "admission_records_code_unique", "learner_code_reservations_pkey"].includes(constraint);
    const isLearnerCodeRequired = constraint === "admission_records_code_required";
    const status = error instanceof HttpException
      ? error.getStatus()
      : isUniqueConstraint || isForeignKeyConstraint || isLearnerCodeConflict
        ? HttpStatus.CONFLICT
        : isValidationError || isLearnerCodeRequired
          ? HttpStatus.BAD_REQUEST
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
    } else if (isLearnerCodeConflict) {
      message = "Mã học viên đã được sử dụng. Vui lòng nhập mã khác; mã của hồ sơ cũ vẫn được giữ dù đã thôi học, bảo lưu hoặc bị xóa.";
      code = "LEARNER_CODE_EXISTS";
    } else if (isLearnerCodeRequired) {
      message = "Mã học viên không được để trống khi sửa hồ sơ.";
    } else if (isUniqueConstraint) {
      message = "Dữ liệu đã tồn tại, vui lòng kiểm tra lại thông tin nhập.";
    } else if (isForeignKeyConstraint) {
      message = "Không thể xóa hoặc thay đổi dữ liệu vì đang được sử dụng ở chức năng khác.";
    } else if (isValidationError) {
      message = "Dữ liệu không hợp lệ, vui lòng kiểm tra lại thông tin nhập.";
    }
    if (Array.isArray(message)) message = message.join(", ");
    response.status(status).json({
      message: message || "Lỗi máy chủ nội bộ",
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    });
  }
}
