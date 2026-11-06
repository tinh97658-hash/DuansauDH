import { IsBoolean, IsDateString, IsOptional, IsString, Matches, ValidateIf } from "class-validator";

export class TrainingYearDto {
  @IsString() @Matches(/^[1-9][0-9]{3}$/) name!: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateTrainingYearDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString() @Matches(/^[1-9][0-9]{3}$/) name?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @ValidateIf((_, value) => value !== undefined) @IsBoolean() active?: boolean;
}
