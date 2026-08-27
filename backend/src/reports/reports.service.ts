import { Injectable } from "@nestjs/common";

@Injectable()
export class ReportsService {
  private stub(feature: string, label: string) {
    return { feature, label, status: "not_implemented", message: `Chức năng "${label}" chưa được triển khai.` };
  }

  classLists() { return this.stub("class-lists", "Danh sách lớp"); }
  courseScores() { return this.stub("course-scores", "Bảng điểm môn học"); }
  classScoreSummary() { return this.stub("class-score-summary", "Tổng hợp điểm cả lớp"); }
  ministerialReport() { return this.stub("ministerial-report", "Báo cáo gửi Bộ"); }
  tempScoreMasters() { return this.stub("temp-score-masters", "Bảng điểm Thạc sĩ"); }
  tempScoreDoctoral() { return this.stub("temp-score-doctoral", "Bảng điểm Tiến sĩ"); }
  diplomaAppendixMasters() { return this.stub("diploma-appendix-masters", "Phụ lục văn bằng Thạc sĩ"); }
  diplomaAppendixDoctoral() { return this.stub("diploma-appendix-doctoral", "Phụ lục văn bằng Tiến sĩ"); }
}
