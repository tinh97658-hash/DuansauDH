import { Transform } from "class-transformer";
import { IsArray, IsObject, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";

const trimName = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value;
const normalizeCode = ({ value }: { value: unknown }) => typeof value === "string" ? value.trim().toLowerCase() : value;

export class CreateRoleDto {
  @ValidateIf((_object, value) => value !== undefined) @IsObject() schedulingScopes?: Record<string, string>;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() restrictGroupView?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() restrictGroupEdit?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() groupReadOnly?: boolean;

  @Transform(normalizeCode) @IsString() @IsNotEmpty() @MaxLength(50) code: string;
  @Transform(trimName) @IsString() @IsNotEmpty() @MaxLength(150) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) permissionIds?: string[];
}

export class UpdateRoleDto {
  @ValidateIf((_object, value) => value !== undefined) @IsObject() schedulingScopes?: Record<string, string>;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() restrictGroupView?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() restrictGroupEdit?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() groupReadOnly?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimName) @IsString() @IsNotEmpty() @MaxLength(150) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) permissionIds?: string[];
}

export class SetRolePermissionsDto {
  @ValidateIf((_object, value) => value !== undefined) @IsObject() schedulingScopes?: Record<string, string>;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() restrictGroupView?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() restrictGroupEdit?: boolean;
  @ValidateIf((_object, value) => value !== undefined) @IsBoolean() groupReadOnly?: boolean;

  @IsArray() @IsUUID(undefined, { each: true }) permissionIds: string[];
}
