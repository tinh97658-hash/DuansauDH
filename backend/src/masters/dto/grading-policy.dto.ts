import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDefined, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

class WeightsDto {
  @IsNumber() @Min(0) @Max(100) testScore!: number;
  @IsNumber() @Min(0) @Max(100) assignmentScore!: number;
  @IsNumber() @Min(0) @Max(100) examScore!: number;
}
class MinimumsDto {
  @IsNumber() @Min(0) @Max(10) testScore!: number;
  @IsNumber() @Min(0) @Max(10) assignmentScore!: number;
  @IsNumber() @Min(0) @Max(10) examScore!: number;
}
class BandDto {
  @IsNumber() @Min(0) @Max(10) minimum!: number;
  @IsString() @MinLength(1) @MaxLength(10) letter!: string;
  @IsNumber() @Min(0) @Max(4) grade4!: number;
}
export class GradingPoliciesQueryDto {
  @IsUUID() majorId!: string;
  @IsString() @MinLength(1) @MaxLength(20) year!: string;
}
export class GradingPolicyEntryDto {
  @IsUUID() subjectId!: string;
  @IsString() @MinLength(1) @MaxLength(20) year!: string;
  @IsInt() @Min(0) revision!: number;
  @IsDefined() @ValidateNested() @Type(() => WeightsDto) weights!: WeightsDto;
  @IsDefined() @ValidateNested() @Type(() => MinimumsDto) minimums!: MinimumsDto;
  @IsNumber() @Min(0) @Max(10) courseMinimum!: number;
  @IsBoolean() useDefaultBands!: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BandDto) bands!: BandDto[];
}
export class SharedGradingRulesDto {
  @IsInt() @Min(0) revision!: number;
  @IsDefined() @ValidateNested() @Type(() => MinimumsDto) minimums!: MinimumsDto;
  @IsNumber() @Min(0) @Max(10) courseMinimum!: number;
  @IsBoolean() useDefaultBands!: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BandDto) bands!: BandDto[];
}
export class SaveGradingPoliciesDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => GradingPolicyEntryDto) rows!: GradingPolicyEntryDto[];
  @IsOptional() @ValidateNested() @Type(() => SharedGradingRulesDto) shared?: SharedGradingRulesDto;
}
