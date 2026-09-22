import { Transform } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const trimUpper = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim().toUpperCase());

export class CreateMastersClassGroupDto {
  @IsString() @MaxLength(30) @Transform(trimUpper) code!: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsInt() @Min(1) maxStudents?: number;
  @IsOptional() @IsEnum(["open", "closed"]) status?: "open" | "closed";
  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim) note?: string;
}

export class UpdateMastersClassGroupDto {
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
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
  @IsString() @MaxLength(20) @Transform(trimUpper) codePrefix!: string;
  @IsString() @MaxLength(160) @Transform(trim) namePrefix!: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) nameTemplate?: string;
  @IsInt() @Min(1) @Max(10) count!: number;
  @IsInt() @Min(0) startIndex!: number;
  @IsOptional() @IsUUID() majorId?: string;
  @IsString() @MaxLength(20) @Transform(trim) academicYear!: string;
  @IsInt() @Min(1) @Max(200) maxStudents!: number;
  @IsOptional() @IsEnum(["open", "closed"]) status?: "open" | "closed";
  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim) note?: string;
  @IsOptional() @IsBoolean() autoAssign?: boolean;
  @IsOptional() @IsEnum(["balanced", "fill_first", "custom"])
  assignmentMethod?: "balanced" | "fill_first" | "custom";
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) admissionRecordIds?: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) @Min(0, { each: true }) targetCounts?: number[];
}
