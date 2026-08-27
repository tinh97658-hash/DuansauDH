import { Controller, Get } from "@nestjs/common";
import { DoctoralService } from "./doctoral.service.js";

@Controller("doctoral")
export class DoctoralController {
  constructor(private readonly doctoral: DoctoralService) {}

  @Get("admission-scores") admissionScores() { return this.doctoral.admissionScores(); }
  @Get("create-class-groups") createClassGroups() { return this.doctoral.createClassGroups(); }
  @Get("assign-class-groups") assignClassGroups() { return this.doctoral.assignClassGroups(); }
  @Get("exam-eligibility") examEligibility() { return this.doctoral.examEligibility(); }
  @Get("exam-scores") examScores() { return this.doctoral.examScores(); }
  @Get("exam-lists") examLists() { return this.doctoral.examLists(); }
  @Get("overview-topics") overviewTopics() { return this.doctoral.overviewTopics(); }
  @Get("university-workshops") universityWorkshops() { return this.doctoral.universityWorkshops(); }
  @Get("faculty-defense") facultyDefense() { return this.doctoral.facultyDefense(); }
  @Get("closed-review") closedReview() { return this.doctoral.closedReview(); }
  @Get("university-defense") universityDefense() { return this.doctoral.universityDefense(); }
  @Get("graduation-docs") graduationDocs() { return this.doctoral.graduationDocs(); }
}
