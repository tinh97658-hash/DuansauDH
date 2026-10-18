import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { Staff } from "../../src/database/models/staff.model.js";
import { Student } from "../../src/database/models/student.model.js";
import { PlanController } from "../../src/plan/plan.controller.js";
import { PlanService } from "../../src/plan/plan.service.js";
import { CurriculumService } from "../../src/plan/curriculum.service.js";
import { MajorTransferService } from "../../src/plan/major-transfer.service.js";
import { SubjectRecognitionService } from "../../src/plan/subject-recognition.service.js";
import { StudyLeaveController } from "../../src/plan/study-leave.controller.js";
import { StudyLeaveService } from "../../src/plan/study-leave.service.js";
import { MastersController } from "../../src/masters/masters.controller.js";
import { MastersService } from "../../src/masters/masters.service.js";
import { ExamGradebookService } from "../../src/masters/exam-gradebook.service.js";
import { GradingPolicyService } from "../../src/masters/grading-policy.service.js";
import { AdmissionEvaluationService } from "../../src/plan/admission-evaluation.service.js";
import { ReportsController } from "../../src/reports/reports.controller.js";
import { ReportsService } from "../../src/reports/reports.service.js";
import { ClassScoreSummaryService } from "../../src/reports/class-score-summary.service.js";

describe("Learner data access over HTTP", () => {
  let app: INestApplication;
  const id = "00000000-0000-4000-8000-000000000001";
  const read = jest.fn().mockResolvedValue({ source: "staff-only-data" });
  const write = jest.fn().mockResolvedValue({ created: true });
  const routes = [
    "/plan/admission-records",
    `/plan/admission-records/${id}`,
    `/plan/admission-records/${id}/major-transfers`,
    `/plan/admission-records/${id}/learning-results`,
    `/plan/admission-records/${id}/studied-subjects`,
    `/plan/admission-records/${id}/subject-recognitions`,
    `/plan/admission-records/${id}/recognized-credits`,
    "/plan/study-leaves",
    `/plan/admission-records/${id}/study-leaves`,
    "/masters/class-groups",
    "/masters/class-groups/eligible-students",
    `/masters/class-groups/${id}`,
    `/masters/exam-lists/history?classGroupId=${id}&courseOfferingId=${id}`,
    `/reports/learner-scorecard/${id}`,
    `/reports/learner-scorecard/${id}/issues`,
    `/reports/transcript-issues/${id}`,
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlanController, StudyLeaveController, MastersController, ReportsController],
      providers: [
        { provide: PlanService, useValue: { listAdmissionRecords: read, getAdmissionRecord: read, createAdmissionRecord: write } },
        { provide: CurriculumService, useValue: {} },
        { provide: MajorTransferService, useValue: { list: read } },
        { provide: SubjectRecognitionService, useValue: {
          listLearningResults: read, listStudiedSubjects: read, listRecognitions: read, recognizedCredits: read,
        } },
        { provide: StudyLeaveService, useValue: { list: read, detail: read } },
        { provide: MastersService, useValue: { listClassGroups: read, getClassGroup: read, listEligibleStudents: read } },
        { provide: ExamGradebookService, useValue: { history: read, transition: write } },
        { provide: ReportsService, useValue: {} },
        { provide: ClassScoreSummaryService, useValue: { learnerScorecard: read, issuesForRecord: read, issued: read, issue: write } },
        { provide: GradingPolicyService, useValue: {} },
        { provide: AdmissionEvaluationService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    // Test-only authentication middleware. Run the actual controller guards;
    // role checks must use model identity, not a client-supplied role property.
    app.use((req: any, _res: any, next: () => void) => {
      const role = req.headers["x-test-role"];
      req.isAuthenticated = () => !!role;
      if (role === "student") req.user = Object.create(Student.prototype);
      else if (role === "spoofed-admin") req.user = { role: "admin" };
      else if (role) {
        req.user = Object.create(Staff.prototype);
        Object.defineProperty(req.user, "role", { value: role });
      }
      next();
    });
    await app.init();
  });

  afterAll(async () => { await app?.close(); });
  beforeEach(() => { read.mockClear(); write.mockClear(); });

  it.each(routes)("rejects anonymous requests before reading %s", async route => {
    await request(app.getHttpServer()).get(route).expect(401);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(routes)("rejects a student before reading %s", async route => {
    await request(app.getHttpServer()).get(route).set("x-test-role", "student").expect(401);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["admin", "supervisor", "examiner"])("preserves staff reads for %s", async role => {
    for (const route of routes) {
      await request(app.getHttpServer()).get(route).set("x-test-role", role)
        .expect(200).expect({ source: "staff-only-data" });
    }
    expect(read).toHaveBeenCalledTimes(routes.length);
  });

  it.each(["unknown", "spoofed-admin"])("rejects an untrusted identity %s", async role => {
    for (const route of routes) await request(app.getHttpServer()).get(route).set("x-test-role", role).expect(401);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["student", "supervisor", "examiner"])("keeps admission writes admin-only for %s", async role => {
    await request(app.getHttpServer()).post("/plan/admission-records").set("x-test-role", role).send({}).expect(401);
    expect(write).not.toHaveBeenCalled();
  });

  it("allows an admin to create a record", async () => {
    await request(app.getHttpServer()).post("/plan/admission-records").set("x-test-role", "admin")
      .send({ fullName: "Applicant" }).expect(201).expect({ created: true });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each(["student", "supervisor", "examiner"])("keeps issued transcript creation admin-only for %s", async role => {
    await request(app.getHttpServer()).post(`/reports/learner-scorecard/${id}/issue`)
      .set("x-test-role", role).send({ classGroupId: id }).expect(401);
    expect(write).not.toHaveBeenCalled();
  });

  it("allows an admin to create an issued transcript", async () => {
    await request(app.getHttpServer()).post(`/reports/learner-scorecard/${id}/issue`)
      .set("x-test-role", "admin").send({ classGroupId: id }).expect(201);
    expect(write).toHaveBeenCalledWith(id, id, expect.anything());
  });

  it.each(["student", "supervisor"])("rejects gradebook workflow writes for %s", async role => {
    await request(app.getHttpServer()).post("/masters/exam-lists/workflow")
      .set("x-test-role", role).send({ action: "approve" }).expect(401);
    expect(write).not.toHaveBeenCalled();
  });
});
