import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestStudyLeaveDto {
  @IsString() @MaxLength(4000) reason!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate!: string;
}

export class StudyLeaveActionDto {
  @IsIn(['approve', 'reject', 'request_extension', 'approve_extension', 'reject_extension', 'resume', 'withdraw'])
  action!: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
}
