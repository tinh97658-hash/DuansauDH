import { Transform, Type } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested, IsInt, Min, Max } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CourseOfferingCandidatesQueryDto {
  @IsOptional() @IsIn(["masters", "doctoral"]) program = "masters";
  @IsUUID() majorId!: string;
  @IsString() @MinLength(1) @MaxLength(20) @Transform(trim) academicYear!: string;
}

export class CourseOfferingParticipantNoteDto {
  @IsString() @MaxLength(100) participantId!: string;
  @IsString() @MaxLength(2000) @Transform(trim) note!: string;
}

export class CreateCourseOfferingDto {
  @IsOptional() @IsString() @MaxLength(255) @Transform(trim) name?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsArray() @ArrayUnique((entry: CourseOfferingParticipantNoteDto) => entry.participantId)
  @ValidateNested({ each: true }) @Type(() => CourseOfferingParticipantNoteDto)
  participantNotes?: CourseOfferingParticipantNoteDto[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("all", { each: true }) admissionRecordIds?: string[];
  @IsUUID() subjectId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) classGroupIds!: string[];
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string;
}

export class PreviewCourseOfferingParticipantsDto {
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("all", { each: true }) admissionRecordIds?: string[];
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) classGroupIds!: string[];
}

export class RetakeQueryDto {
  @IsUUID() subjectId!: string;
  @IsUUID() majorId!: string;
  @IsString() @MinLength(1) @MaxLength(20) academicYear!: string;
}

export class RegisterRetakeDto {
  @IsUUID() sourceCourseOfferingId!: string;
  @IsString() @MaxLength(100) participantId!: string;
}

export class UpdateRosterNotesDto {
  @IsArray() @ArrayUnique((entry: CourseOfferingParticipantNoteDto) => entry.participantId)
  @ValidateNested({ each: true }) @Type(() => CourseOfferingParticipantNoteDto)
  participantNotes!: CourseOfferingParticipantNoteDto[];
}

export class SchedulingGroupSettingsDto {
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  allowedWeekdays!: number[];
  @IsIn(["ADMINISTRATIVE", "NON_ADMINISTRATIVE"]) groupType!: string;
}

export class ListCourseOfferingsQueryDto {
  @IsOptional() @IsIn(["masters", "doctoral"]) program = "masters";
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @IsString() @MaxLength(20) @Transform(trim) academicYear?: string;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsIn(["active", "completed"]) status?: "active" | "completed";
}

export class AssignSchedulingManagerDto {
  @IsUUID() staffId!: string;
}

export class ListTeachingSessionsQueryDto {
  @IsDateString({}, { message: "from phải là ngày hợp lệ theo định dạng YYYY-MM-DD" })
  @Matches(datePattern, { message: "from phải theo định dạng YYYY-MM-DD" })
  from!: string;

  @IsDateString({}, { message: "to phải là ngày hợp lệ theo định dạng YYYY-MM-DD" })
  @Matches(datePattern, { message: "to phải theo định dạng YYYY-MM-DD" })
  to!: string;

  @IsOptional() @IsUUID() courseOfferingId?: string;
  @IsOptional() @IsUUID() lecturerId?: string;
  @IsOptional() @IsUUID() roomId?: string;
}

export class CreateTeachingSessionDto {
  @IsUUID() courseOfferingId!: string;
  @IsDateString({}, { message: "sessionDate phải là ngày hợp lệ theo định dạng YYYY-MM-DD" })
  @Matches(datePattern, { message: "sessionDate phải theo định dạng YYYY-MM-DD" })
  sessionDate!: string;
  @Matches(timePattern, { message: "startTime phải theo định dạng HH:mm hoặc HH:mm:ss" }) startTime!: string;
  @Matches(timePattern, { message: "endTime phải theo định dạng HH:mm hoặc HH:mm:ss" }) endTime!: string;
  @IsIn(["MORNING", "AFTERNOON"]) period!: "MORNING" | "AFTERNOON";
  @IsUUID() lecturerId!: string;
  @IsUUID() roomId!: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string | null;
}

export class UpdateTeachingSessionDto {
  @IsOptional()
  @IsDateString({}, { message: "sessionDate phải là ngày hợp lệ theo định dạng YYYY-MM-DD" })
  @Matches(datePattern, { message: "sessionDate phải theo định dạng YYYY-MM-DD" })
  sessionDate?: string;
  @IsOptional() @Matches(timePattern, { message: "startTime phải theo định dạng HH:mm hoặc HH:mm:ss" }) startTime?: string;
  @IsOptional() @Matches(timePattern, { message: "endTime phải theo định dạng HH:mm hoặc HH:mm:ss" }) endTime?: string;
  @IsOptional() @IsIn(["MORNING", "AFTERNOON"]) period?: "MORNING" | "AFTERNOON";
  @IsOptional() @IsUUID() lecturerId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string | null;
}

export class ConfirmTeachingSessionDto {
  @IsIn(["held", "not_held"]) status!: "held" | "not_held";
}
