import { Body, Controller, INestApplication, Post, Req, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import bcrypt from "bcrypt";
import session from "express-session";
import { Passport } from "passport";
import request from "supertest";
import { AccountsController } from "../../src/accounts/accounts.controller.js";
import { AccountsService } from "../../src/accounts/accounts.service.js";
import { AuthController } from "../../src/auth/auth.controller.js";
import { AuthService } from "../../src/auth/auth.service.js";
import { LocalAuthGuard } from "../../src/auth/auth.guards.js";
import { GoogleStrategy } from "../../src/auth/google.strategy.js";
import { RbacService } from "../../src/auth/rbac.service.js";
import { SessionSerializer } from "../../src/auth/session.serializer.js";
import { UserController } from "../../src/auth/user.controller.js";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { StaffService } from "../../src/staff/staff.service.js";
import { StudentsService } from "../../src/students/students.service.js";

let staffData: any;
let studentData: any;
const publicUser = (student = false) => {
  const data = student ? studentData : staffData;
  const user = Object.create(student ? Student.prototype : Staff.prototype);
  for (const [key, value] of Object.entries(data)) if (key !== "password") Object.defineProperty(user, key, { value, writable: true });
  user.toJSON = () => ({ id: user.id, sessionVersion: user.sessionVersion });
  return user;
};
@Controller("security-test")
class LoginFixture {
  @Post("session") async login(@Req() req: any, @Body() body: any) {
    await new Promise<void>((resolve, reject) => req.logIn(publicUser(body.student), (error: Error) => error ? reject(error) : resolve()));
    return { ok: true };
  }
}

describe("Security fixes with real Passport sessions", () => {
  let app: INestApplication;
  const origin = "https://ui.example.invalid";
  const config = new ConfigService({ FRONTEND_URL: origin, API_PUBLIC_URL: "https://api.example.invalid", GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test" });
  const send = jest.fn();
  const authAttempt = jest.fn(() => true);
  const studentsRepo: any = {
    findById: async () => publicUser(true),
    findByIdWithPassword: async () => ({ ...studentData }),
    findByEmail: async () => ({ ...studentData, update: async () => {} }),
    findResetToken: async () => ({ ...studentData }),
    replacePassword: async (_id: string, previous: string, password: string) => {
      if (previous !== studentData.password) return null;
      studentData.password = password; studentData.sessionVersion++;
      return { ...studentData };
    },
  };
  const auth = new AuthService({ findById: async () => publicUser() } as any, studentsRepo, {} as any, {} as any);
  const students = new StudentsService(studentsRepo, { send } as any, {} as any, {} as any);
  const staffModel: any = { findByPk: async () => ({ ...staffData, update: async function (values: any) {
    Object.assign(staffData, { ...values, sessionVersion: staffData.sessionVersion + 1 });
    Object.assign(this, staffData);
  } }) };
  const accounts = new AccountsService(staffModel, {} as any, {} as any, {} as any, { record: async () => {} } as any, {} as any, {} as any, {} as any);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [LoginFixture, UserController, AccountsController, AuthController], providers: [
      { provide: ConfigService, useValue: config }, { provide: AuthService, useValue: auth },
      { provide: StudentsService, useValue: students }, { provide: StaffService, useValue: {} },
      { provide: AccountsService, useValue: accounts },
      { provide: RbacService, useValue: { effectiveAccess: async () => ({ permissions: new Set() }) } },
    ] }).overrideGuard(LocalAuthGuard).useValue({ canActivate: authAttempt }).compile();
    app = module.createNestApplication();
    const passport = new Passport();
    const serializer = new SessionSerializer(auth);
    passport.serializeUser(serializer.serializeUser.bind(serializer));
    passport.deserializeUser(serializer.deserializeUser.bind(serializer));
    app.use(session({ secret: "synthetic-test-session-secret-at-least-32", resave: false, saveUninitialized: false }));
    app.use(passport.initialize()); app.use(passport.session());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(async () => {
    staffData = { id: "staff", role: "admin", status: "active", sessionVersion: 0, mustChangePassword: true, password: await bcrypt.hash("old-password", 4) };
    studentData = { id: "student", accountType: "registered", approvalState: "approved", sessionVersion: 0, email: "learner@example.invalid", password: await bcrypt.hash("old-password", 4) };
    send.mockClear(); authAttempt.mockClear();
  });
  const login = async (student = false) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/security-test/session").send({ student }).expect(201);
    return agent;
  };
  const active = async (agent: any, expected: boolean) => {
    const response = await agent.get("/auth/session").expect(200);
    expect(response.body.authenticated).toBe(expected);
  };

  it("revokes other Staff sessions while keeping the changing browser signed in", async () => {
    const first = await login(); const second = await login();
    await first.patch("/accounts/me/password").send({ currentPassword: "old-password", newPassword: "new-password" }).expect(200);
    expect(staffData.sessionVersion).toBe(1);
    await active(first, true); await active(second, false);
  });
  it("revokes other Student sessions on self-service password change", async () => {
    const first = await login(true); const second = await login(true);
    await first.patch("/user/updatePassword").send({ passwordCurrent: "old-password", password: "new-password" }).expect(200);
    await active(first, true); await active(second, false);
  });
  it("revokes every Student session when resetting a forgotten password", async () => {
    const first = await login(true); const second = await login(true);
    await request(app.getHttpServer()).patch("/user/resetPassword/synthetic").send({ password: "new-password" }).expect(200);
    await active(first, false); await active(second, false);
  });
  it("rejects an existing Student session after approval is withdrawn", async () => {
    const agent = await login(true); studentData.approvalState = "not approved";
    await active(agent, false);
  });
  it("creates recovery links only for the configured frontend despite hostile headers", async () => {
    await request(app.getHttpServer()).post("/user/forgotPassword").set("Host", "attacker.example.invalid")
      .set("X-Forwarded-Host", "attacker.example.invalid").send({ email: studentData.email }).expect(201);
    expect(send).toHaveBeenCalledTimes(1);
    const email = send.mock.calls[0][2];
    expect(email).toContain(`${origin}/reset-password#`);
    expect(email).not.toContain("attacker.example.invalid");
  });
  it("blocks cross-origin and missing-origin local login before authentication", async () => {
    for (const value of ["https://attacker.example.invalid", "null", ""]) {
      const call = request(app.getHttpServer()).post("/user/login").type("form").send({ email: studentData.email, password: "old-password" });
      if (value) call.set("Origin", value);
      await call.expect(403);
    }
    expect(authAttempt).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post("/user/login").set("Origin", origin).send({}).expect(200);
    expect(authAttempt).toHaveBeenCalledTimes(1);
  });
  it("uses a real state store and rejects missing/mismatched OAuth state", async () => {
    const strategy: any = new GoogleStrategy(config, auth);
    expect(strategy._stateStore.constructor.name).not.toBe("NullStore");
    const req: any = { session: {} };
    const state = await new Promise<string>((resolve, reject) => strategy._stateStore.store(req, (error: Error, value: string) => error ? reject(error) : resolve(value)));
    const verify = (value: any) => new Promise(resolve => strategy._stateStore.verify(req, value, (_error: Error, ok: boolean) => resolve(ok)));
    expect(await verify("wrong-state")).toBe(false);
    expect(await verify(state)).toBe(false); // mismatch consumed state
    const next = await new Promise<string>((resolve, reject) => strategy._stateStore.store(req, (error: Error, value: string) => error ? reject(error) : resolve(value)));
    expect(await verify(next)).toBe(true);
    expect(await verify(next)).toBe(false);
  });
});
