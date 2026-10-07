import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class ExamSubjectsQueryDto {
  @IsUUID() classGroupId!: string;
}

export class ExamGradebookQueryDto extends ExamSubjectsQueryDto {
  @IsUUID() courseOfferingId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(15) pageSize?: number;
  @IsOptional() @IsIn(["all", "exam"]) mode?: "all" | "exam";
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(81000) includeIds?: string;
  @IsOptional() @IsString() @MaxLength(81000) excludeIds?: string;
}

export class ExamGradeRowDto {
  @IsString() @MaxLength(80) participantId!: string;
  @IsOptional() @IsBoolean() eligible?: boolean | null;
  @IsBoolean() examExempt!: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(10) testScore?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) assignmentScore?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) examScore?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) courseScore?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(4) grade4?: number | null;
  @IsString() @MaxLength(10) letterGrade!: string;
  @IsArray() @ArrayMaxSize(20) @IsNumber({}, { each: true }) @Min(0, { each: true }) @Max(10, { each: true }) attemptScores!: number[];
  @IsIn(["pending", "passed", "failed", "exempt"]) result!: "pending" | "passed" | "failed" | "exempt";
}

export class SaveExamGradebookDto extends ExamGradebookQueryDto {
  @IsInt() @Min(0) revision!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ExamGradeRowDto) rows!: ExamGradeRowDto[];
}
