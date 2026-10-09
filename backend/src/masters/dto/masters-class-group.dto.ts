import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const trimUpper = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim().toUpperCase());

export class CreateMastersClassGroupDto {
  @IsString() @MaxLength(100) @Transform(trimUpper) code!: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsUUID() curriculumId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsInt() @Min(1) maxStudents?: number;
  @IsOptional() @IsEnum(["open", "closed"]) status?: "open" | "closed";
  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim) note?: string;
}

export class UpdateMastersClassGroupDto {
  @IsOptional() @IsString() @MaxLength(100) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsUUID() curriculumId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsInt() @Min(1) maxStudents?: number;
  @IsOptional() @IsEnum(["open", "closed"]) status?: "open" | "closed";
  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim) note?: string;
}

export class AssignMembersDto {
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) admissionRecordIds!: string[];
}

export class AutoAssignDto {
  @IsArray() @ArrayMinSize(2) @ArrayUnique() @IsUUID("all", { each: true }) classGroupIds!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) admissionRecordIds!: string[];
  @IsOptional() @IsEnum(["alphabetical", "round_robin", "balanced", "fill_first", "custom"])
  method?: "alphabetical" | "round_robin" | "balanced" | "fill_first" | "custom";
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) @Min(0, { each: true }) targetCounts?: number[];
}

export class BatchCreateMastersClassGroupsDto {
  @IsOptional() @IsString() @MaxLength(100) @Transform(trimUpper) codePrefix?: string;
  @IsOptional() @IsString() @MaxLength(160) @Transform(trim) namePrefix?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) nameTemplate?: string;
  @IsInt() @Min(1) @Max(10) count!: number;
  @IsOptional() @IsInt() @Min(0) startIndex?: number;
  @IsOptional() @IsInt() @Min(1) @Max(99) intakeRound?: number;
  @IsOptional() @IsInt() @Min(0) codeStartIndex?: number;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) nameIndexes?: number[];
  @IsOptional() @IsUUID() majorId?: string;
  @IsUUID() curriculumId!: string;
  @IsString() @MaxLength(20) @Transform(trim) academicYear!: string;
  @IsInt() @Min(1) @Max(200) maxStudents!: number;
  @IsOptional() @IsEnum(["open", "closed"]) status?: "open" | "closed";
  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim) note?: string;
}
