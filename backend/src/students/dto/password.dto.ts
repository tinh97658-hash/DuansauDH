import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail() email: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}

export class UpdatePasswordDto {
  @IsString() passwordCurrent: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
