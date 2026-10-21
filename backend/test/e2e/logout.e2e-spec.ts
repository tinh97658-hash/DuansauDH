import { Body, Controller, Get, INestApplication, Post, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import session from "express-session";
import { Passport } from "passport";
import request from "supertest";
import { AuthController } from "../../src/auth/auth.controller.js";
import { AuthService } from "../../src/auth/auth.service.js";
import { UserController } from "../../src/auth/user.controller.js";
import { LogoutOriginGuard } from "../../src/auth/logout-origin.guard.js";
import { AuthenticatedGuard } from "../../src/common/authenticated.guard.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { StaffService } from "../../src/staff/staff.service.js";
import { StudentsService } from "../../src/students/students.service.js";

const users = new Map<string, any>();
@Controller("logout-test")
class TestSessionController {
  @Post("login")
  async login(@Req() req: any, @Body() body: any) {
    const id = body.id || randomUUID();
    const user = Object.defineProperties(Object.create(Staff.prototype), {
      id: { value: id }, role: { value: "custom" }, mustChangePassword: { value: body.forced === true },
      toJSON: { value: () => ({ id, role: "custom", mustChangePassword: body.forced === true }) },
    });
    users.set(id, user);
    await new Promise<void>((resolve, reject) => req.login(user, (error: Error) => error ? reject(error) : resolve()));
    return { id };
  }
  @Get("protected") @UseGuards(AuthenticatedGuard)
  protected() { return { ok: true }; }
}

describe("POST logout with real Passport/session lifecycle and origin boundary", () => {
  let app: INestApplication;
  const store = new session.MemoryStore();
  const audit = { recordLogout: jest.fn().mockResolvedValue(undefined) };
  const origin = "http://localhost:3100";
  const config = new ConfigService({ FRONTEND_URL: origin + "/", NODE_ENV: "test" });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController, AuthController, TestSessionController],
      providers: [LogoutOriginGuard, { provide: ConfigService, useValue: config },
        { provide: AuthService, useValue: audit }, { provide: StaffService, useValue: {} }, { provide: StudentsService, useValue: {} }],
    }).compile();
    app = module.createNestApplication();
    const passport = new Passport();
    passport.serializeUser((user: any, done) => done(null, user.id));
    passport.deserializeUser((id: string, done) => done(null, users.get(id) || false));
    app.use(session({ name: "pgsms.sid", secret: "test-only-session-secret-not-a-real-credential", store, resave: false, saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 8 * 60 * 60 * 1000 } }));
    app.use(passport.initialize());app.use(passport.session());await app.init();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => { users.clear();jest.clearAllMocks();await new Promise<void>(resolve => store.clear(() => resolve())); });
  const login = async (forced = false, id?: string) => {
    const agent = request.agent(app.getHttpServer());
    const result = await agent.post("/logout-test/login").send({ forced, id }).expect(201);
    return { agent, id: result.body.id, cookie: result.headers["set-cookie"][0].split(";")[0] };
  };
  it("destroys the current session, expires its secure attributes correctly and keeps semantic audit", async () => {
    const { agent, id, cookie } = await login();
    await agent.get("/logout-test/protected").expect(200);
    const result = await agent.post("/user/logout").set("Origin", origin).expect(204);
    expect(result.headers.location).toBeUndefined();
    const cleared = result.headers["set-cookie"].find((value: string) => value.startsWith("pgsms.sid="));
    expect(cleared).toContain("pgsms.sid=;");expect(cleared).toContain("Path=/");expect(cleared).toContain("HttpOnly");expect(cleared).toContain("SameSite=Lax");expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
    expect(audit.recordLogout).toHaveBeenCalledWith(expect.objectContaining({ id }));
    await agent.get("/logout-test/protected").expect(401);
    await request(app.getHttpServer()).get("/logout-test/protected").set("Cookie", cookie).expect(401);
    const state = await agent.get("/auth/session").expect(200);expect(state.body.authenticated).toBe(false);
  });
  it("GET and HEAD have no logout route or side effects", async () => {
    const { agent } = await login();
    await agent.get("/user/logout").expect(404);await agent.head("/user/logout").expect(404);
    await agent.get("/logout-test/protected").expect(200);expect(audit.recordLogout).not.toHaveBeenCalled();
  });
  it("allows forced-password Staff to log out without allowing business access", async () => {
    const { agent } = await login(true);
    await agent.get("/logout-test/protected").expect(403);
    await agent.post("/user/logout").set("Origin", origin).expect(204);
    await agent.get("/logout-test/protected").expect(401);
  });
  it("defines anonymous/expired logout as idempotent 204 for an accepted origin", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/user/logout").set("Origin", origin).expect(204);
    await agent.post("/user/logout").set("Origin", origin).expect(204);expect(audit.recordLogout).not.toHaveBeenCalled();
  });
  it("leaves another session for the same Staff valid", async () => {
    const a = await login(), b = await login(false, a.id);
    await a.agent.post("/user/logout").set("Origin", origin).expect(204);
    await a.agent.get("/logout-test/protected").expect(401);await b.agent.get("/logout-test/protected").expect(200);
  });
  it.each([undefined, "null", "https://attacker.invalid", "http://localhost:3101", "https://localhost:3100", "http://localhost:3100.attacker.invalid", "http://localhost:3100/path", "http://localhost:3100/", "not a URL"])("rejects Origin %p before touching an authenticated session", async supplied => {
    const { agent } = await login();
    const post = agent.post("/user/logout").type("form").send({});if (supplied !== undefined) post.set("Origin", supplied);
    await post.expect(403);await agent.get("/logout-test/protected").expect(200);expect(audit.recordLogout).not.toHaveBeenCalled();
  });
  it("does not accept Referer or forwarded Host as an Origin substitute", async () => {
    const { agent } = await login();
    await agent.post("/user/logout").set("Referer", origin + "/system/unit-info").set("X-Forwarded-Host", "localhost:3100").expect(403);
    await agent.get("/logout-test/protected").expect(200);
  });
});
