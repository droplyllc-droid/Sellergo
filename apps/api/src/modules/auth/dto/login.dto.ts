/**
 * Login DTOs
 */

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'SecureP@ss123!' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'MFA code if MFA is enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 8, { message: 'MFA code must be 6-8 characters' })
  mfaCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class SwitchStoreDto {
  @ApiProperty({ description: 'Store ID to switch to' })
  @IsUUID()
  storeId: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to invalidate' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Logout from all devices', default: false })
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}
