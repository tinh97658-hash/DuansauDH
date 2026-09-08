import { Transform, Type } from "class-transformer";
import { ArrayMinSize, ArrayUnique, ValidateIf, ValidateNested, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CourseOfferingCandidatesQueryDto {
  @IsOptional() @IsIn(["masters", "doctoral"]) program = "masters";
  @IsUUID() majorId!: string;
  @IsString() @MinLength(1) @MaxLength(20) @Transform(trim) academicYear!: string;
}

export class CourseOfferingParticipantNoteDto {
  @ValidateIf((_o, value) => value !== undefined) @IsUUID() studentId?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsUUID() admissionRecordId?: string;
  @IsString() @MaxLength(2000) @Transform(trim) note!: string;
}

export class RenameCourseOfferingDto {
  @IsString() @MinLength(1) @MaxLength(200) @Transform(trim) name!: string;
}

export class UpdateCourseOfferingParticipantNoteDto {
  @IsString() @MaxLength(2000) @Transform(trim) note!: string;
}

export class CreateCourseOfferingDto {
  @IsString() @MinLength(1) @MaxLength(200) @Transform(trim) name!: string;
  @IsUUID() subjectId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) classGroupIds!: string[];
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) note?: string;
  @ValidateIf((_o, value) => value !== undefined) @IsArray() @ValidateNested({ each: true }) @Type(() => CourseOfferingParticipantNoteDto) participantNotes?: CourseOfferingParticipantNoteDto[];
}

export class PreviewCourseOfferingParticipantsDto {
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID("all", { each: true }) classGroupIds!: string[];
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
  @IsOptional() @Matches(timePattern, { message: "startTime phải theo định dạng HH:mm hoặc HH:mm:ss" }) startTime?: string;
  @IsOptional() @Matches(timePattern, { message: "endTime phải theo định dạng HH:mm hoặc HH:mm:ss" }) endTime?: string;
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
