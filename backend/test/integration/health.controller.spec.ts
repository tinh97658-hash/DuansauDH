import type { Response } from "express";
import { jest } from "@jest/globals";
import type { Sequelize } from "sequelize-typescript";
import { HealthController } from "../../src/health/health.controller.js";

describe("HealthController readiness", () => {
  const status = jest.fn();
  const json = jest.fn();
  const response = { status, json } as unknown as Response;

  beforeEach(() => {
    status.mockReturnValue(response);
    json.mockReturnValue(response);
  });

  it("reports ready when the database accepts a connection", async () => {
    const sequelize = { authenticate: jest.fn().mockResolvedValue(undefined) } as unknown as Sequelize;
    const controller = new HealthController(sequelize);

    await controller.ready(response);

    expect(sequelize.authenticate).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ status: "ready" });
  });

  it("reports unavailable when the database rejects a connection", async () => {
    const sequelize = { authenticate: jest.fn().mockRejectedValue(new Error("offline")) } as unknown as Sequelize;
    const controller = new HealthController(sequelize);

    await controller.ready(response);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ status: "not_ready" });
  });
});
