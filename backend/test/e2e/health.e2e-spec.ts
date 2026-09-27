import { INestApplication } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/sequelize";
import { Test } from "@nestjs/testing";
import { jest } from "@jest/globals";
import request from "supertest";
import { HealthController } from "../../src/health/health.controller.js";

describe("Health endpoints (e2e)", () => {
  let app: INestApplication;
  const authenticate = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getConnectionToken(), useValue: { authenticate } }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health/live returns liveness without accessing the database", async () => {
    await request(app.getHttpServer())
      .get("/health/live")
      .expect(200)
      .expect({ status: "ok" });

    expect(authenticate).not.toHaveBeenCalled();
  });

  it("GET /health/ready returns 503 while the database is unavailable", async () => {
    authenticate.mockRejectedValueOnce(new Error("offline"));

    await request(app.getHttpServer())
      .get("/health/ready")
      .expect(503)
      .expect({ status: "not_ready" });
  });
});
