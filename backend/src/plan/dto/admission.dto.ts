import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Matches, Min, ValidateNested } from "class-validator";
import { AdmissionInputs } from "../admission-scoring.js";

export class AdmissionRulesDto {
  @IsNumber() @Min(0) @Max(10) direct!: number;
  @IsNumber() @Min(0) @Max(10) bridge!: number;
  @IsNumber() @Min(0) @Max(1) priority!: number;
  @IsNumber() @Min(0) @Max(6) excellent!: number;
  @IsNumber() @Min(0) @Max(6) veryGood!: number;
  @IsNumber() @Min(0) @Max(6) good!: number;
  @IsNumber() @Min(0) @Max(6) fairlyGood!: number;
  @IsNumber() @Min(0) @Max(6) average!: number;
  @IsNumber() @Min(0) @Max(3) englishDegree!: number;
  @IsNumber() @Min(0) @Max(3) certificateB3!: number;
  @IsNumber() @Min(0) @Max(3) certificateB4!: number;
  @IsNumber() @Min(0) @Max(3) exam5!: number;
  @IsNumber() @Min(0) @Max(3) exam7!: number;
  @IsNumber() @Min(0) @Max(3) exam8!: number;
}
export class MajorAdmissionThresholdDto {
  @IsUUID() majorId!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(20) cutoff?: number | null;
}
export class SaveAdmissionRoundDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(10) academicYear!: string;
  @IsArray() @ArrayMaxSize(2000) @ArrayUnique((row: MajorAdmissionThresholdDto) => row.majorId)
  @ValidateNested({ each: true }) @Type(() => MajorAdmissionThresholdDto) majorThresholds!: MajorAdmissionThresholdDto[];
  @IsOptional() @IsString() @MaxLength(300) regulationNo?: string;
  @IsOptional() @IsString() @MaxLength(300) decisionNo?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) decisionDate?: string;
  @IsOptional() @ValidateNested() @Type(() => AdmissionRulesDto) rules?: AdmissionRulesDto;
}
export class AdmissionInputsDto implements AdmissionInputs {
  @IsOptional() @IsNumber() @Min(0) @Max(20) manualTotal?: number;
  @IsOptional() @IsBoolean() degreeVerified?: boolean;
  @IsOptional() @IsBoolean() documentsVerified?: boolean;
  @IsOptional() @IsBoolean() healthVerified?: boolean;
  @IsOptional() @IsIn(["direct", "bridge", "unsuitable"]) majorFit?: "direct" | "bridge" | "unsuitable";
  @IsOptional() @IsString() @MaxLength(1000) fitEvidence?: string;
  @IsOptional() @IsBoolean() bridgeCompleted?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) bridgeEvidence?: string;
  @IsOptional() @IsBoolean() priorityVerified?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) priorityEvidence?: string;
  @IsOptional() @IsIn(["exam", "certificate_b3", "certificate_b4", "english_degree", "vmu_degree", "none"]) englishType?: AdmissionInputs["englishType"];
  @IsOptional() @IsBoolean() englishVerified?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) englishEvidence?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) englishValidUntil?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) englishDegreeDate?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) applicationDate?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(10) englishScore?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10) gpa10?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10) graduationScore?: number;
}
export class SaveAdmissionEvaluationDto {
  @IsUUID() roundId!: string;
  @ValidateNested() @Type(() => AdmissionInputsDto) inputs!: AdmissionInputsDto;
  @IsInt() @Min(0) version!: number;
}
export class DecideAdmissionDto {
  @IsIn(["admitted", "rejected", "reopen"]) decision!: string;
  @IsOptional() @IsString() @MaxLength(300) decisionNo?: string;
  @IsOptional() @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) decisionDate?: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) note!: string;
  @IsInt() @Min(1) version!: number;
}
export class AdmissionScoreRowDto {
  @IsUUID() admissionRecordId!: string;
  @IsNumber() @Min(0) @Max(20) score!: number;
  @IsInt() @Min(0) version!: number;
}
export class BulkAdmissionScoresDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000) @ArrayUnique((row: AdmissionScoreRowDto) => row.admissionRecordId)
  @ValidateNested({ each: true }) @Type(() => AdmissionScoreRowDto) rows!: AdmissionScoreRowDto[];
}
export class ConfirmAdmissionBatchDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) previewToken!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000) @ArrayUnique() @IsUUID(undefined, { each: true }) admissionRecordIds!: string[];
}
