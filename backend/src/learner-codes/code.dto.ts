import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
const upper = ({ value }: any) => typeof value === 'string' ? value.trim().toUpperCase() : value;
const trim = ({ value }: any) => typeof value === 'string' ? value.trim() : value;
export class CodeTypeDto {
  @Transform(trim) @IsString() @Length(1,100) name!: string;
  @IsString() @Matches(/^[a-z][a-z0-9_]{1,39}$/) key!: string;
  @IsOptional() @Transform(upper) @Matches(/^[A-Z]$/) letter?: string;
  @IsBoolean() active!: boolean;
  @IsBoolean() requiresAdmission!: boolean;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class CodePartDto {
  @IsIn(['major','year','round','group','sequence','literal','manual']) kind!: any;
  @IsOptional() @IsInt() @Min(1) @Max(12) width?: number;
  @IsOptional() @IsString() @MaxLength(12) @Transform(upper) value?: string;
}
export class CodeRuleDto {
  @IsOptional() @IsDateString() effectiveFrom?: string;
  @Transform(trim) @IsString() @Length(1,120) name!: string;
  @IsBoolean() active!: boolean;
  @IsOptional() @IsIn(['masters','doctoral']) program?: string;
  @IsOptional() @IsUUID() majorId?: string;
  @IsOptional() @Matches(/^\d{4}$/) academicYear?: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) intakeRound?: number;
  @IsOptional() @IsUUID() classGroupId?: string;
  @IsOptional() @IsUUID() typeId?: string;
  @IsIn(['global','year','major_year','major_round','class']) counterScope!: string;
  @IsInt() @Min(1) @Max(999999999) startNumber!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => CodePartDto) parts!: CodePartDto[];
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class CodePreviewDto {
  @IsUUID() classGroupId!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.split(',') : value)
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', { each: true }) recordIds!: string[];
  @IsOptional() @IsIn(['name','selected']) order?: string;
  @IsOptional() @IsString() @MaxLength(12) @Transform(upper) manual?: string;
}
export class CodeIssueDto extends CodePreviewDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) fingerprint!: string;
  @IsUUID() requestId!: string;
}
export class CodeRecordTypeDto {
  @IsUUID() typeId!: string;
  @Transform(trim) @IsString() @Length(3,500) reason!: string;
}
export class CodeReissueDto {
  @IsString() @Length(1,50) @Matches(/^[A-Z0-9.-]+$/) @Transform(upper) code!: string;
  @Transform(trim) @IsString() @Length(3,500) reason!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) fingerprint!: string;
  @IsUUID() requestId!: string;
}
export class CodeAbbreviationDto { @Transform(upper) @Matches(/^[A-Z0-9]{2,12}$/) abbreviation!: string; }
export class CodeAdvanceDto {
  @IsString() @Length(1,500) key!: string;
  @IsInt() @Min(2) @Max(999999999) nextNumber!: number;
  @Transform(trim) @IsString() @Length(3,500) reason!: string;
}
