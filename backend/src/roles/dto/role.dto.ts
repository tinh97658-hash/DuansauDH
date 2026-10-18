import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateRoleDto {
  @IsString() @MaxLength(50) @Transform(({ value }) => String(value).trim().toLowerCase()) code: string;
  @IsString() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) permissionIds?: string[];
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) permissionIds?: string[];
}

export class SetRolePermissionsDto {
  @IsArray() @IsUUID(undefined, { each: true }) permissionIds: string[];
}
