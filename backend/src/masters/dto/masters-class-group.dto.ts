import { Transform } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const trimUpper = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim().toUpperCase());

export class CreateMastersClassGroupDto {
  @IsString() @MaxLength(30) @Transform(trimUpper) code!: string;
  @IsString() @MaxLength(200) @MinLength(1) @Transform(trim) name!: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) term?: string;
  @IsOptional() @IsInt() @Min(1) maxStudents?: number;
  @IsOptional() @IsEnum(["open", "closed"]) status?: "open" | "closed";
  @IsOptional() @IsString() @MaxLength(1000) @Transform(trim) note?: string;
}

export class UpdateMastersClassGroupDto {
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MaxLength(200) @MinLength(1) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) term?: string;
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
  @IsOptional() @IsEnum(["alphabetical", "round_robin"]) method?: "alphabetical" | "round_robin";
}

export class BatchCreateMastersClassGroupsDto {
  @IsString() @MaxLength(20) @Transform(trimUpper) codePrefix!: string;
  @IsString() @MaxLength(160) @Transform(trim) namePrefix!: string;
  @IsInt() @Min(1) @Max(20) count!: number;
  @IsInt() @Min(0) startIndex!: number;
  @IsOptional() @IsUUID() majorId?: string;
  @IsString() @MaxLength(20) @Transform(trim) academicYear!: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) term?: string;
  @IsInt() @Min(1) @Max(200) maxStudents!: number;
}

export class CreateClassFromStudentsDto {
  @IsUUID() parentGroupId!: string;
  @IsString() @MinLength(1) @MaxLength(30) @Transform(trimUpper) code!: string;
  @IsString() @MinLength(1) @MaxLength(200) @Transform(trim) name!: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("all", { each: true }) admissionRecordIds: string[] = [];
}
export class UpdateMemberNoteDto {
  @IsString() @MaxLength(2000) @Transform(trim) note!: string;
}

export class RenameClassDto {
  @IsString() @MinLength(1) @MaxLength(200) @Transform(trim) name!: string;
}
