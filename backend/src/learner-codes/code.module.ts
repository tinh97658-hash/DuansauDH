import { Module } from '@nestjs/common';
import { LearnerCodeController } from './code.controller.js';
import { LearnerCodeService } from './code.service.js';
@Module({controllers:[LearnerCodeController],providers:[LearnerCodeService]})
export class LearnerCodeModule {}
