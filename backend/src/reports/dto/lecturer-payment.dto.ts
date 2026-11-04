import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsDefined, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

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

export class PreviewLecturerPaymentBatchDto extends UpdateLecturerPaymentDto {
  @IsDefined() @ValidateNested() @Type(() => LecturerPaymentQueryDto) filters!: LecturerPaymentQueryDto;
}

export class ApplyLecturerPaymentBatchDto {
  @IsString() @MaxLength(5000000) token!: string;
}
