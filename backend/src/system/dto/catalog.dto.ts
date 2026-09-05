import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim());
const trimUpper = ({ value }: { value: unknown }) => (value === undefined || value === null ? value : String(value).trim().toUpperCase());

export class CreateCatalogDto {
  @IsString() @IsOptional() @MaxLength(30) @Transform(trimUpper) code?: string;
  @IsString() @MaxLength(200) @Transform(trim) name!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  // Khóa ngoại (tùy chọn)
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() districtId?: string;
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @IsUUID() trainingLevelId?: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsUUID() staffId?: string;
  // Trường bổ sung theo từng danh mục
  @IsOptional() @IsBoolean() isAdmissionScreening?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) durationYears?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) maxOvertimeYears?: number;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) description?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trim) phone?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) academicRank?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) academicDegree?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) teachingType?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) title?: string;
  @IsOptional() @IsString() @MaxLength(150) @Transform(trim) department?: string;
}

export class UpdateCatalogDto {
  @IsOptional() @IsString() @MaxLength(30) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() districtId?: string;
  @IsOptional() @IsUUID() groupId?: string;
  @IsOptional() @IsUUID() trainingLevelId?: string;
  @IsOptional() @IsIn(["masters", "doctoral"]) program?: string;
  @IsOptional() @IsUUID() staffId?: string;
  @IsOptional() @IsBoolean() isAdmissionScreening?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) durationYears?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) maxOvertimeYears?: number;
  @IsOptional() @IsInt() @Min(0) credits?: number;
  @IsOptional() @IsString() @MaxLength(2000) @Transform(trim) description?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) @Transform(trim) phone?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) academicRank?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) academicDegree?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) teachingType?: string;
  @IsOptional() @IsString() @MaxLength(50) @Transform(trim) title?: string;
  @IsOptional() @IsString() @MaxLength(150) @Transform(trim) department?: string;
}

export class CreateRoomDto {
  @IsString() @MinLength(1) @MaxLength(30) @Matches(/^\d/, { message: "Mã phòng phải bắt đầu bằng số tầng" }) @Transform(trimUpper) code!: string;
  @IsString() @MinLength(1) @MaxLength(200) @Transform(trim) name!: string;
  @IsInt() @Min(1) capacity!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateRoomDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(30) @Matches(/^\d/, { message: "Mã phòng phải bắt đầu bằng số tầng" }) @Transform(trimUpper) code?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) @Transform(trim) name?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
