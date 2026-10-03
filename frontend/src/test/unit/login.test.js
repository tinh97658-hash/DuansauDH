import { loginErrorMessage } from "../../components/login";

describe("loginErrorMessage", () => {
  it("preserves the authentication error returned by the backend", () => {
    expect(loginErrorMessage({ response: { data: { message: "Email hoặc mật khẩu không chính xác" } } }))
      .toBe("Email hoặc mật khẩu không chính xác");
  });

  it("reports a connection problem when the backend cannot be reached", () => {
    expect(loginErrorMessage({ code: "ERR_NETWORK" }))
      .toBe("Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend và thử lại.");
  });

  it("uses a neutral message for an HTTP error without a server message", () => {
    expect(loginErrorMessage({ response: { status: 500 } }))
      .toBe("Không thể đăng nhập. Vui lòng thử lại.");
  });
});
