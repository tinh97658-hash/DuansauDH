import { Transform } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class SubmissionDto {
  @Transform(({ value }) => Number(value))
  @IsInt() @Min(1) @Max(7)
  submission: number;
}
