import { Controller, Get } from "@nestjs/common";
import { ReportsService } from "./reports.service.js";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("class-lists") classLists() { return this.reports.classLists(); }
  @Get("course-scores") courseScores() { return this.reports.courseScores(); }
  @Get("class-score-summary") classScoreSummary() { return this.reports.classScoreSummary(); }
  @Get("ministerial-report") ministerialReport() { return this.reports.ministerialReport(); }
  @Get("temp-score-masters") tempScoreMasters() { return this.reports.tempScoreMasters(); }
  @Get("temp-score-doctoral") tempScoreDoctoral() { return this.reports.tempScoreDoctoral(); }
  @Get("diploma-appendix-masters") diplomaAppendixMasters() { return this.reports.diplomaAppendixMasters(); }
  @Get("diploma-appendix-doctoral") diplomaAppendixDoctoral() { return this.reports.diplomaAppendixDoctoral(); }
}
