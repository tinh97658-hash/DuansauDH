import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class LecturerPaymentQueryDto {
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() lecturerId?: string;
  @IsOptional() @IsIn(['all', 'paid', 'unpaid']) paymentStatus?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class UpdateLecturerPaymentDto {
  @IsBoolean() paid!: boolean;
}
