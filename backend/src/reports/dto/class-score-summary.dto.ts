import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class ClassScoreSummaryQueryDto {
  @IsUUID() classGroupId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class LearnerScorecardQueryDto {
  @IsOptional() @IsUUID() classGroupId?: string;
}
