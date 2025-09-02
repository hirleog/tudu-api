// change-password.dto.ts
import {
  IsString,
  IsEmail,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
} from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  newPassword: string;

  @IsString()
  @MinLength(6)
  confirmNewPassword: string;

  @IsOptional()
  @IsNumberString() // ✅ Agora valida que é string numérica
  verificationCode?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyResetCodeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumberString() // ✅ Valida que é string numérica
  @IsNotEmpty()
  code: string;
}
