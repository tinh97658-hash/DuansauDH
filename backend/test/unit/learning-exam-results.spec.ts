import { applyLearningExamResults } from "../../src/plan/learning-exam-results.js";

describe("Saved exam outcomes", () => {
  it.each(["pre_masters", "early_enrollment", "external"])("keeps independent %s evidence despite a conflicting regular exam", sourceType => {
    const row = { id: "prior", sourceType, status: "completed", result: "passed", score: "8.5" };
    expect(applyLearningExamResults([row], [{ id: "prior", result: "failed", score: 3 }])[0])
      .toMatchObject({ result: "passed", score: 8.5, status: "completed" });
  });
  it.each(["passed", "failed", "pending", "exempt"])("preserves %s instead of a conflicting personal outcome", result => {
    const rows = [{ id: "lr-1", result: result === "passed" ? "failed" : "passed", score: 10, status: "completed" }];
    expect(applyLearningExamResults(rows, [{ id: "lr-1", result, score: 6 }])[0]).toMatchObject({ result, score: 6 });
  });
  it("does not treat completed teaching or a manual pass as an exam pass", () => {
    expect(applyLearningExamResults([{ id: "lr-1", status: "completed", result: "passed", score: 10 }], [])[0])
      .toMatchObject({ result: "pending", score: null, status: "studying" });
  });
});
