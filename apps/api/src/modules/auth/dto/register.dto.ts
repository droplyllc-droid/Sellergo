/**
 * Registration DTOs
 */

import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { Language } from '@sellergo/types';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'es'] as const;

export class RegisterDto {
  @ApiProperty({ example: 'John', description: 'User first name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'User last name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'SecureP@ss123!',
    description: 'Password (min 12 chars, must include uppercase, lowercase, number, special char)',
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
    message: 'Password must contain at least one special character',
  })
  password: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LANGUAGES, default: 'fr' })
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  preferredLanguage?: Language;
}

export class RegisterWithStoreDto extends RegisterDto {
  @ApiProperty({ example: 'My Store', description: 'Store name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  storeName: string;

  @ApiProperty({ example: 'my-store', description: 'Store slug (URL-friendly)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })
  @Transform(({ value }) => value?.toLowerCase().trim())
  storeSlug: string;

  @ApiProperty({ example: 'TND', description: 'Store currency code' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(3)
  @Transform(({ value }) => value?.toUpperCase().trim())
  currency: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
