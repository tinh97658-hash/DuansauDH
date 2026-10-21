import { Type } from 'class-transformer';
import { IsDateString, IsEmpty, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class ExamScheduleQueryDto {
  @IsDateString({strict:true}) @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/) from!:string;
  @IsDateString({strict:true}) @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/) to!:string;
}
export class ScheduleExamDto {
  @IsEmpty({message:'Danh sách thí sinh được lấy từ DS thi đã duyệt, không nhận từ yêu cầu xếp lịch.'}) candidateIds?:never;
  @IsUUID() courseOfferingId!:string;
  @IsUUID() snapshotId!:string;
  @IsInt() @Min(0) eligibilityVersion!:number;
  @IsDateString({strict:true}) @Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/) examDate!:string;
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) startTime!:string;
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/) endTime!:string;
  @IsUUID() roomId!:string;
  @IsUUID() lecturerId!:string;
  @IsOptional() @IsString() @MaxLength(2000) note?:string;
}
export class RescheduleExamDto extends ScheduleExamDto {
  @IsInt() @Min(0) version!:number;
}
export class ExamSessionActionDto {
  @IsInt() @Min(0) version!:number;
  @IsString() @MaxLength(2000) note!:string;
}
export class ConfirmExamDto {
  @IsInt() @Min(0) version!:number;
  @IsOptional() @IsString() @MaxLength(2000) note?:string;
  @IsIn(['held','not_held']) status!:'held'|'not_held';
}
