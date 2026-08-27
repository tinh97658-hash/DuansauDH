import { Module } from "@nestjs/common";
import { DoctoralController } from "./doctoral.controller.js";
import { DoctoralService } from "./doctoral.service.js";

@Module({
  controllers: [DoctoralController],
  providers: [DoctoralService],
  exports: [DoctoralService],
})
export class DoctoralModule {}
