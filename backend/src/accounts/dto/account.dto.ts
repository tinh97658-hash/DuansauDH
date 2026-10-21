import { Transform, Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

const normalizeEmail = ({ value }: { value: unknown }) => String(value).trim().toLowerCase();
const trimName = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;

export class CreateAccountDto {
  @Transform(trimName) @IsString() @IsNotEmpty() @MaxLength(150) name: string;
  @IsEmail() @Transform(normalizeEmail) email: string;
  @IsArray() @ArrayNotEmpty() @IsUUID(undefined, { each: true }) roleIds: string[];
  @IsOptional() @IsUUID() primaryRoleId?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
}

export class UpdateAccountDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimName) @IsString() @IsNotEmpty() @MaxLength(150) name?: string;
  @IsOptional() @IsEmail() @Transform(normalizeEmail) email?: string;
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsUUID(undefined, { each: true }) roleIds?: string[];
  @IsOptional() @IsUUID() primaryRoleId?: string;
}

export class UpdateAccountStatusDto {
  @IsIn(["active", "disabled"]) status: string;
}

export class ResetAccountPasswordDto {
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
}

export class ChangeOwnPasswordDto {
  @IsString() @MinLength(1) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}

export class AccountListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(["active", "disabled"]) status?: string;
  @IsOptional() @IsUUID() roleId?: string;
}

export class AuditLogQueryDto {
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsUUID() actorStaffId?: string;
  @IsOptional() @IsUUID() targetStaffId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class ChangeLogQueryDto {
  @IsOptional() @IsString() table?: string;
  @IsOptional() @IsIn(["INSERT", "UPDATE", "DELETE"]) operation?: string;
  @IsOptional() @IsUUID() actorStaffId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
