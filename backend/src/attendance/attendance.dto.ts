import { Transform } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  value === undefined || value === null ? value : String(value).trim();

export const PARTICIPANT_ID_PATTERN = /^(student|admission):[0-9a-fA-F-]{36}$/;

export class RecognizeAttendanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  deviceId?: string;
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
