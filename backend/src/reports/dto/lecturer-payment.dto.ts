import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsDefined, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

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
  @ValidateIf((_, value) => value !== null) @IsString() @MaxLength(100) paymentVersion!: string | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) paymentDate?: string | null;
  @ValidateIf((_, value) => value !== undefined) @IsString() @MaxLength(2000) note?: string;
}

export class PreviewLecturerPaymentBatchDto {
  @IsBoolean() paid!: boolean;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) paymentDate?: string;
  @IsDefined() @ValidateNested() @Type(() => LecturerPaymentQueryDto) filters!: LecturerPaymentQueryDto;
}

export class ApplyLecturerPaymentBatchDto {
  @IsString() @MaxLength(5000000) token!: string;
}
