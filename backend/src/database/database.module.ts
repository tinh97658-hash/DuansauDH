import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SequelizeModule } from "@nestjs/sequelize";
import { StaffStudent } from "./models/staff-student.model.js";
import { Staff } from "./models/staff.model.js";
import { Student } from "./models/student.model.js";
import { Submission } from "./models/submission.model.js";
// Bảng chung (danh mục dùng chung)
import { Ethnicity } from "./models/common/ethnicity.model.js";
import { Nationality } from "./models/common/nationality.model.js";
import { City } from "./models/common/city.model.js";
import { District } from "./models/common/district.model.js";
import { Ward } from "./models/common/ward.model.js";
import { TrainingModeGroup } from "./models/common/training-mode-group.model.js";
import { TrainingMode } from "./models/common/training-mode.model.js";
import { TrainingLevel } from "./models/common/training-level.model.js";
import { Major } from "./models/common/major.model.js";
import { StudyStatus } from "./models/common/study-status.model.js";
import { BridgeKnowledgeSubject } from "./models/common/bridge-knowledge-subject.model.js";
import { Lecturer } from "./models/common/lecturer.model.js";
import { Room } from "./models/common/room.model.js";
import { TrainingProgram } from "./models/common/training-program.model.js";
// Bảng riêng: Kế hoạch khóa mới
import { TrainingPlan } from "./models/plan/training-plan.model.js";
import { AdmissionTarget } from "./models/plan/admission-target.model.js";
import { AnnualFee } from "./models/plan/annual-fee.model.js";
import { AdmissionRecord } from "./models/plan/admission-record.model.js";
import { Subject } from "./models/plan/subject.model.js";
import { SubjectPackage } from "./models/plan/subject-package.model.js";
import { SubjectPackageSubject } from "./models/plan/subject-package-subject.model.js";
// Bảng riêng: nhóm học phần & thi (dùng chung)
import { ClassGroup } from "./models/training/class-group.model.js";
import { ClassGroupMember } from "./models/training/class-group-member.model.js";
import { ExamSession } from "./models/training/exam-session.model.js";
import { ExamEligibility } from "./models/training/exam-eligibility.model.js";
import { ExamResult } from "./models/training/exam-result.model.js";
import { CourseOffering } from "./models/training/course-offering.model.js";
import { CourseOfferingClassGroup } from "./models/training/course-offering-class-group.model.js";
import { TeachingSession } from "./models/training/teaching-session.model.js";
// Bảng riêng: Đào tạo Thạc sĩ
import { MastersAdmissionScore } from "./models/masters/masters-admission-score.model.js";
import { EnglishExamSession } from "./models/masters/english-exam-session.model.js";
import { EnglishExamScore } from "./models/masters/english-exam-score.model.js";
import { EnglishCertification } from "./models/masters/english-certification.model.js";
import { GraduationDefense } from "./models/masters/graduation-defense.model.js";
import { GraduationRecord } from "./models/masters/graduation-record.model.js";
// Bảng riêng: Đào tạo Tiến sĩ
import { DoctoralAdmissionScore } from "./models/doctoral/doctoral-admission-score.model.js";
import { DoctoralThesisTopic } from "./models/doctoral/doctoral-thesis-topic.model.js";
import { DoctoralWorkshop } from "./models/doctoral/doctoral-workshop.model.js";
import { DoctoralDefense } from "./models/doctoral/doctoral-defense.model.js";
import { DoctoralReview } from "./models/doctoral/doctoral-review.model.js";

export const databaseModels = [
  Student, Staff, StaffStudent, Submission,
  // Common
  Ethnicity, Nationality, City, District, Ward, TrainingModeGroup, TrainingMode, TrainingLevel,
  Major, StudyStatus, BridgeKnowledgeSubject, Lecturer, Room, TrainingProgram,
  // Plan
  TrainingPlan, AdmissionTarget, AnnualFee, AdmissionRecord,
  Subject, SubjectPackage, SubjectPackageSubject,
  // Training (class & exam)
  ClassGroup, ClassGroupMember, CourseOffering, CourseOfferingClassGroup, TeachingSession, ExamSession, ExamEligibility, ExamResult,
  // Masters
  MastersAdmissionScore, EnglishExamSession, EnglishExamScore, EnglishCertification, GraduationDefense, GraduationRecord,
  // Doctoral
  DoctoralAdmissionScore, DoctoralThesisTopic, DoctoralWorkshop, DoctoralDefense, DoctoralReview,
];

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: "postgres",
        uri: config.getOrThrow<string>("DATABASE_URL"),
        models: databaseModels,
        autoLoadModels: true,
        synchronize: false,
        logging: config.get("NODE_ENV") === "development" ? (sql: string) => console.debug(sql) : false,
        dialectOptions: config.get<boolean>("DATABASE_SSL")
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
        pool: {
          max: config.get<number>("DB_POOL_MAX", 10),
          min: config.get<number>("DB_POOL_MIN", 0),
          idle: config.get<number>("DB_POOL_IDLE_MS", 10000),
          acquire: config.get<number>("DB_POOL_ACQUIRE_MS", 30000),
        },
        define: { underscored: true, timestamps: true },
      }),
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
