import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsUUID,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  value === undefined || value === null ? value : String(value).trim();

export const PARTICIPANT_ID_PATTERN = /^(student|admission):[0-9a-fA-F-]{36}$/;

export class RecognizeAttendanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(trim)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  captureToken?: string;
}

// Client timings are diagnostic only; never used to decide attendance.
export class AttendanceTelemetryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsIn(["ACCEPT", "REVIEW", "UNKNOWN", "ERROR", "NO_CAPTURE"])
  outcome!: string;

  @IsNumber() @Min(0) @Max(600000)
  captureMs!: number;

  @IsNumber() @Min(0) @Max(600000)
  recognitionHttpMs!: number;

  @IsNumber() @Min(0) @Max(600000)
  uiCommitMs!: number;

  @IsNumber() @Min(0) @Max(600000)
  totalMs!: number;

  @IsInt() @Min(0) @Max(6)
  frameCount!: number;
}

export class ResolveAttendanceReviewDto {
  @IsIn(["ACCEPT_SUGGESTED", "ASSIGN_OTHER", "REJECT", "DISMISS"])
  resolution!: "ACCEPT_SUGGESTED" | "ASSIGN_OTHER" | "REJECT" | "DISMISS";

  @IsOptional()
  @Matches(PARTICIPANT_ID_PATTERN, { message: "participantId must be student:<uuid> or admission:<uuid>" })
  participantId?: string;

  @IsOptional()
  @IsIn(["PRESENT", "LATE"])
  status?: "PRESENT" | "LATE";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  note?: string;
}

export class ListAttendanceReviewsQueryDto {
  @IsOptional()
  @IsIn(["PENDING", "RESOLVED", "DISMISSED"])
  status?: "PENDING" | "RESOLVED" | "DISMISSED";
}
