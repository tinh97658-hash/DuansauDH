import { ArgumentsHost, ConflictException, NotFoundException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { AllExceptionsFilter } from "../../src/common/all-exceptions.filter.js";

describe("AllExceptionsFilter conflict payload", () => {
  it("preserves machine-readable scheduling conflict context", () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;
    const error = new ConflictException({
      code: "ROOM_CONFLICT",
      message: "Phòng học đã có lịch.",
      details: { teachingSessionId: "session-1", roomId: "room-1" },
    });

    new AllExceptionsFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      code: "ROOM_CONFLICT",
      message: "Phòng học đã có lịch.",
      details: { teachingSessionId: "session-1", roomId: "room-1" },
    });
  });

  it("preserves a domain not-found message", () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(new NotFoundException("Không tìm thấy học phần."), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Không tìm thấy học phần." });
  });

  it("uses the route message only for an unknown endpoint", () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch(new NotFoundException("Cannot POST /plan/missing"), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Không tìm thấy đường dẫn yêu cầu" });
  });

  it("returns a useful conflict for a database foreign-key constraint", () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch({ name: "SequelizeForeignKeyConstraintError" }, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      message: "Không thể xóa hoặc thay đổi dữ liệu vì đang được sử dụng ở chức năng khác.",
    });
  });

  it("returns a useful bad request for a database validation error", () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as unknown as ArgumentsHost;

    new AllExceptionsFilter().catch({ name: "SequelizeValidationError" }, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Dữ liệu không hợp lệ, vui lòng kiểm tra lại thông tin nhập.",
    });
  });
});
