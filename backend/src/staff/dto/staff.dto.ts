import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsString } from "class-validator";

export class AddStaffDto {
  @IsString() name: string;
  @IsEmail() @Transform(({ value }) => String(value).trim().toLowerCase()) email: string;
  @IsIn(["admin", "supervisor", "examiner"]) role: string;
}
