/**
 * MFA DTOs
 */

import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class VerifyMfaDto {
  @ApiProperty({ example: '123456', description: 'TOTP code from authenticator app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'MFA code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'MFA code must be 6 digits' })
  @Transform(({ value }) => value?.trim())
  code: string;
}

// Aliases for compatibility
export class MfaSetupDto {}

export class MfaVerifyDto extends VerifyMfaDto {}

export class VerifyMfaBackupDto {
  @ApiProperty({ example: 'ABCD-1234', description: 'Backup code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/, {
    message: 'Invalid backup code format',
  })
  @Transform(({ value }) => value?.trim().toUpperCase())
  code: string;
}

export class DisableMfaDto {
  @ApiProperty({ description: 'Current password to confirm MFA disable' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '123456', description: 'Current TOTP code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  @Transform(({ value }) => value?.trim())
  code: string;
}

export class RegenerateMfaBackupCodesDto {
  @ApiProperty({ description: 'Current password to confirm' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '123456', description: 'Current TOTP code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  @Transform(({ value }) => value?.trim())
  code: string;
}
