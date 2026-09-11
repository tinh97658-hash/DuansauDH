import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const trimUpper = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim().toUpperCase());

// ===== Học phần =====
export class CreateSubjectDto {
  @IsInt() @Min(1) codeNumber!: number;
  @IsString() @MaxLength(20) @Transform(trimUpper) codeText!: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsUUID() majorId!: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsBoolean() majorAssignment?: boolean;
  @IsOptional() @IsIn(["KC", "CS", "CN", "TC", "CH"]) subjectType?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() canonicalSubjectId?: string | null;
  @IsOptional() @IsBoolean() allowCrossMajor?: boolean;
}

export class UpdateSubjectDto {
  @IsOptional() @IsInt() @Min(1) codeNumber?: number;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trimUpper) codeText?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsBoolean() majorAssignment?: boolean;
  @IsOptional() @IsIn(["KC", "CS", "CN", "TC", "CH"]) subjectType?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() canonicalSubjectId?: string | null;
  @IsOptional() @IsBoolean() allowCrossMajor?: boolean;
}

// ===== Chương trình đào tạo (CTĐT theo ngành + bậc + khóa) =====
export class CurriculumBlockDto {
  @IsString() @MaxLength(30) @Transform(trimUpper) code!: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsOptional() @IsInt() @Min(0) minCredits?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CurriculumElectiveGroupDto {
  @IsString() @MaxLength(30) @Transform(trimUpper) code!: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsOptional() @IsInt() @Min(0) minCredits?: number;
  @IsOptional() @IsInt() @Min(0) maxCredits?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CurriculumSubjectEntryDto {
  @IsUUID() subjectId!: string;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimUpper) blockCode?: string;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimUpper) electiveGroupCode?: string | null;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CreateCurriculumDto {
  @IsString() @MaxLength(60) @Transform(trimUpper) code!: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsUUID() majorId!: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) applicableFromYear?: string;
  @IsOptional() @IsInt() @Min(0) totalCredits?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CurriculumBlockDto) blocks?: CurriculumBlockDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CurriculumElectiveGroupDto) electiveGroups?: CurriculumElectiveGroupDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CurriculumSubjectEntryDto) subjects?: CurriculumSubjectEntryDto[];
}

export class UpdateCurriculumDto {
  @IsOptional() @IsString() @MaxLength(60) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) applicableFromYear?: string;
  @IsOptional() @IsInt() @Min(0) totalCredits?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string;
}

export class SetCurriculumSubjectsDto {
  @IsArray() @ArrayUnique((entry: CurriculumSubjectEntryDto) => entry.subjectId)
  @ValidateNested({ each: true }) @Type(() => CurriculumSubjectEntryDto) subjects!: CurriculumSubjectEntryDto[];
}

export class SetClassElectivesDto {
  @IsArray() @IsUUID("4", { each: true }) @ArrayUnique() curriculumSubjectIds!: string[];
}

// ===== Lớp học (class group) =====
export class CreateClassDto {
  @IsString() @MaxLength(30) @Transform(trimUpper) code!: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) academicYear?: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string;
}

export class UpdateClassDto {
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) academicYear?: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string;
}

// ===== Hồ sơ tuyển sinh (Admission Record) =====
export class CreateAdmissionRecordDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsString() @Transform(trim) fullName!: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() idCard?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() pob?: string;
  @IsOptional() @IsString() receiptType?: string;
  @IsOptional() @IsString() profileCategory?: string;
  @IsOptional() @IsString() admissionDate?: string;
  @IsOptional() @IsString() photo?: string;

  @IsOptional() @IsBoolean() isExemptForeignLanguage?: boolean;
  @IsOptional() @IsString() trainingModeGroup?: string;
  @IsOptional() @IsString() trainingLevel?: string;
  @IsOptional() @IsUUID() trainingModeId?: string;
  @IsOptional() @IsString() trainingModeName?: string;
  @IsUUID() majorId!: string;
  @IsOptional() @IsString() majorName?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() studyStatus?: string;
  @IsOptional() @IsString() academicYear?: string;

  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() ward?: string;

  @IsOptional() documents?: Record<string, boolean>;

  @IsOptional() @IsString() priorityObject?: string;
  @IsOptional() @IsString() workplace?: string;
  @IsOptional() @IsString() job?: string;
  @IsOptional() @IsInt() supplementSubjectsCount?: number;
  @IsOptional() @IsString() gradSchool?: string;
  @IsOptional() @IsString() gradDegreeType?: string;
  @IsOptional() @IsString() gradYear?: string;
  @IsOptional() @IsString() gpa?: string;
  @IsOptional() @IsString() gradMajor?: string;
  @IsOptional() @IsString() gradClassification?: string;
  @IsOptional() @IsString() diplomaNumber?: string;
  @IsOptional() @IsString() registryBookNumber?: string;

  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() extraData?: Record<string, any>;
}

export class UpdateAdmissionRecordDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() @Transform(trim) fullName?: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() idCard?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() pob?: string;
  @IsOptional() @IsString() receiptType?: string;
  @IsOptional() @IsString() profileCategory?: string;
  @IsOptional() @IsString() admissionDate?: string;
  @IsOptional() @IsString() photo?: string;

  @IsOptional() @IsBoolean() isExemptForeignLanguage?: boolean;
  @IsOptional() @IsString() trainingModeGroup?: string;
  @IsOptional() @IsString() trainingLevel?: string;
  @IsOptional() @IsUUID() trainingModeId?: string;
  @IsOptional() @IsString() trainingModeName?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() majorName?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() studyStatus?: string;
  @IsOptional() @IsString() academicYear?: string;

  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() ethnicity?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() ward?: string;

  @IsOptional() documents?: Record<string, boolean>;

  @IsOptional() @IsString() priorityObject?: string;
  @IsOptional() @IsString() workplace?: string;
  @IsOptional() @IsString() job?: string;
  @IsOptional() @IsInt() supplementSubjectsCount?: number;
  @IsOptional() @IsString() gradSchool?: string;
  @IsOptional() @IsString() gradDegreeType?: string;
  @IsOptional() @IsString() gradYear?: string;
  @IsOptional() @IsString() gpa?: string;
  @IsOptional() @IsString() gradMajor?: string;
  @IsOptional() @IsString() gradClassification?: string;
  @IsOptional() @IsString() diplomaNumber?: string;
  @IsOptional() @IsString() registryBookNumber?: string;

  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() extraData?: Record<string, any>;
}
