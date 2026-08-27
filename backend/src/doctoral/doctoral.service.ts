import { Injectable } from "@nestjs/common";

@Injectable()
export class DoctoralService {
  private stub(feature: string, label: string) {
    return { feature, label, status: "not_implemented", message: `Chức năng "${label}" chưa được triển khai.` };
  }

  admissionScores() { return this.stub("admission-scores", "Điểm đầu vào TS"); }
  createClassGroups() { return this.stub("create-class-groups", "Tạo nhóm học phần TS"); }
  assignClassGroups() { return this.stub("assign-class-groups", "Phân nhóm học phần TS"); }
  examEligibility() { return this.stub("exam-eligibility", "Xét tư cách thi hết môn"); }
  examScores() { return this.stub("exam-scores", "Điểm thi"); }
  examLists() { return this.stub("exam-lists", "Danh sách thi, điểm thi"); }
  overviewTopics() { return this.stub("overview-topics", "Tổng quan, chuyên đề"); }
  universityWorkshops() { return this.stub("university-workshops", "Hội thảo cấp trường"); }
  facultyDefense() { return this.stub("faculty-defense", "Bảo vệ cấp cơ sở"); }
  closedReview() { return this.stub("closed-review", "Phản biện kín 2 người"); }
  universityDefense() { return this.stub("university-defense", "Bảo vệ cấp trường"); }
  graduationDocs() { return this.stub("graduation-docs", "Hồ sơ tốt nghiệp"); }
}
