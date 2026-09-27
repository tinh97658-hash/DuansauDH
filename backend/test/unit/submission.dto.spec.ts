import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SubmissionDto } from "../../src/students/dto/submission.dto.js";

describe("SubmissionDto", () => {
  it("accepts and converts a valid reporting period", async () => {
    const dto = plainToInstance(SubmissionDto, { submission: "3" });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.submission).toBe(3);
  });

  it.each([0, 8, 1.5, "invalid"])("rejects invalid reporting period %p", async (submission) => {
    const dto = plainToInstance(SubmissionDto, { submission });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
