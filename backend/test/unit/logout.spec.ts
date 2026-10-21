import { ConfigService } from "@nestjs/config";
import { LogoutOriginGuard } from "../../src/auth/logout-origin.guard.js";
import { UserController } from "../../src/auth/user.controller.js";

describe("Logout origin configuration and failure handling", () => {
  const context = (origin: string) => ({ switchToHttp: () => ({ getRequest: () => ({ get: () => origin }) }) }) as any;
  it("accepts the configured production UI origin with its canonical scheme/port", () => {
    const guard = new LogoutOriginGuard(new ConfigService({ FRONTEND_URL: "https://portal.example.invalid/app/" }));
    expect(guard.canActivate(context("https://portal.example.invalid"))).toBe(true);
    for (const origin of ["http://portal.example.invalid", "https://sibling.example.invalid", "https://portal.example.invalid:8443", "https://portal.example.invalid@attacker.invalid"]) {
      expect(() => guard.canActivate(context(origin))).toThrow();
    }
  });
  it.each(["null", "file:///frontend", "not a URL"])("fails closed for unusable configured frontend %s", frontend => {
    expect(() => new LogoutOriginGuard(new ConfigService({ FRONTEND_URL: frontend })).canActivate(context("http://localhost:3100"))).toThrow();
  });
  const build = (values: any = { NODE_ENV: "production" }) => {
    const auth = { recordLogout: jest.fn() };
    const controller = new UserController({} as any, {} as any, auth as any, new ConfigService(values));
    const req: any = { logout: jest.fn(done => done()), session: { destroy: jest.fn(done => done()) } };
    const res: any = { clearCookie: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
    return { controller, req, res, auth };
  };
  it("keeps production Secure default and the current host-only cookie path", async () => {
    const f = build();await f.controller.logout(f.req, f.res);
    expect(f.res.clearCookie).toHaveBeenCalledWith("pgsms.sid", { path: "/", httpOnly: true, sameSite: "lax", secure: true });
    expect(f.res.status).toHaveBeenCalledWith(204);
  });
  it("honors the existing explicit Secure configuration", async () => {
    const f = build({ NODE_ENV: "test", SESSION_COOKIE_SECURE: true });await f.controller.logout(f.req, f.res);
    expect(f.res.clearCookie.mock.calls[0][1].secure).toBe(true);
  });
  it("does not return success or expire the cookie on Passport failure", async () => {
    const f = build();f.req.logout.mockImplementation(done => done(new Error("logout failed")));
    await expect(f.controller.logout(f.req, f.res)).rejects.toThrow("logout failed");
    expect(f.req.session.destroy).not.toHaveBeenCalled();expect(f.res.status).not.toHaveBeenCalled();expect(f.res.clearCookie).not.toHaveBeenCalled();
  });
  it("does not return success on session-store destruction failure", async () => {
    const f = build();f.req.session.destroy.mockImplementation(done => done(new Error("store unavailable")));
    await expect(f.controller.logout(f.req, f.res)).rejects.toThrow("store unavailable");
    expect(f.res.status).not.toHaveBeenCalled();expect(f.res.clearCookie).not.toHaveBeenCalled();
  });
});
