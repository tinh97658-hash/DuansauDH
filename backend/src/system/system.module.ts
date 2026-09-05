import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { RolesGuard } from "../common/roles.guard.js";
import { BridgeKnowledgeSubject } from "../database/models/common/bridge-knowledge-subject.model.js";
import { City } from "../database/models/common/city.model.js";
import { District } from "../database/models/common/district.model.js";
import { Ethnicity } from "../database/models/common/ethnicity.model.js";
import { Lecturer } from "../database/models/common/lecturer.model.js";
import { Major } from "../database/models/common/major.model.js";
import { Room } from "../database/models/common/room.model.js";
import { Nationality } from "../database/models/common/nationality.model.js";
import { StudyStatus } from "../database/models/common/study-status.model.js";
import { TrainingLevel } from "../database/models/common/training-level.model.js";
import { TrainingMode } from "../database/models/common/training-mode.model.js";
import { TrainingModeGroup } from "../database/models/common/training-mode-group.model.js";
import { Ward } from "../database/models/common/ward.model.js";
import { Staff } from "../database/models/staff.model.js";
import { SystemController } from "./system.controller.js";
import { SystemService } from "./system.service.js";

@Module({
  imports: [SequelizeModule.forFeature([
    Ethnicity, Nationality, City, District, Ward,
    TrainingModeGroup, TrainingMode, TrainingLevel, Major, StudyStatus, BridgeKnowledgeSubject, Lecturer, Room,
    Staff,
  ])],
  controllers: [SystemController],
  providers: [SystemService, RolesGuard],
  exports: [SystemService],
})
export class SystemModule {}
