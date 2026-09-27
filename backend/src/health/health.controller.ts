import { Controller, Get, HttpCode, Res } from "@nestjs/common";
import { InjectConnection } from "@nestjs/sequelize";
import type { Response } from "express";
import { Sequelize } from "sequelize-typescript";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  @Get("live") @HttpCode(200)
  live() { return { status: "ok" }; }

  @Get("ready")
  async ready(@Res() response: Response) {
    try {
      await this.sequelize.authenticate();
      return response.status(200).json({ status: "ready" });
    } catch {
      return response.status(503).json({ status: "not_ready" });
    }
  }
}
