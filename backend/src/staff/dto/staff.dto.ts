import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AddStaffDto {
  @IsString() @MinLength(2) @MaxLength(150) @Transform(({ value }) => String(value).trim()) name: string;
  @IsEmail() @Transform(({ value }) => String(value).trim().toLowerCase()) email: string;
  @IsIn(["admin", "supervisor", "examiner"]) role: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) @Transform(({ value }) => String(value).trim()) name?: string;
  @IsOptional() @IsEmail() @Transform(({ value }) => String(value).trim().toLowerCase()) email?: string;
  @IsOptional() @IsIn(["admin", "supervisor", "examiner"]) role?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ResetStaffPasswordDto {
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
