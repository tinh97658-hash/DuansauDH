import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";

const trimName = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const normalizeCode = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim().toLowerCase() : value;

export class CreateRoleDto {
  @Transform(normalizeCode) @IsString() @IsNotEmpty() @MaxLength(50) code: string;
  @Transform(trimName) @IsString() @IsNotEmpty() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) permissionIds?: string[];
}

export class UpdateRoleDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimName) @IsString() @IsNotEmpty() @MaxLength(150) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) permissionIds?: string[];
}

export class SetRolePermissionsDto {
  @IsArray() @IsUUID(undefined, { each: true }) permissionIds: string[];
}
