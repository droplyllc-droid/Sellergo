/**
 * Store DTOs
 */

import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsIn,
  IsBoolean,
  IsNumber,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Language, UserRole, CountryRestrictionMode } from '@sellergo/types';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar', 'es'] as const;

export class CreateStoreDto {
  @ApiProperty({ example: 'My Store' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'my-store' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Transform(({ value }) => value?.toLowerCase().trim())
  slug: string;

  @ApiProperty({ example: 'TND' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Transform(({ value }) => value?.toUpperCase().trim())
  currency: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LANGUAGES, default: 'fr' })
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  defaultLanguage?: Language;

  @ApiPropertyOptional({ example: 'Africa/Tunis' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional({ example: 'My Store' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'A great store' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'my-store' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Transform(({ value }) => value?.toLowerCase().trim())
  slug?: string;

  @ApiPropertyOptional({ example: 'TND' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Transform(({ value }) => value?.toUpperCase().trim())
  currency?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LANGUAGES })
  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  defaultLanguage?: Language;

  @ApiPropertyOptional({ example: 'Africa/Tunis' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  favicon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDescription?: string;
}

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({ enum: CountryRestrictionMode })
  @IsOptional()
  @IsEnum(CountryRestrictionMode)
  countryRestrictionMode?: CountryRestrictionMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedCountries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedCountries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requirePhone?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireAddress?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showQuantityOffers?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showUpsells?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showTrustBadges?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  orderNotificationEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lowStockNotificationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  thankYouPageTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  thankYouPageSubtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  thankYouPageNextStepsTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thankYouPageNextStepsDescription?: string;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'team@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class AddDomainDto {
  @ApiProperty({ example: 'mystore.com' })
  @IsString()
  @MinLength(4)
  @MaxLength(253)
  @Matches(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/)
  @Transform(({ value }) => value?.toLowerCase().trim())
  domain: string;
}

export class NavigationMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: '/' })
  @IsString()
  @MaxLength(500)
  url: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  position: number;
}

export class CreateNavigationMenuDto {
  @ApiProperty({ enum: ['header', 'footer'] })
  @IsString()
  type: 'header' | 'footer';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  column?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  @ApiProperty({ type: [NavigationMenuItemDto] })
  @IsArray()
  @Type(() => NavigationMenuItemDto)
  items: NavigationMenuItemDto[];
}

export class UpdateNavigationMenuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  title?: string;

  @ApiPropertyOptional({ type: [NavigationMenuItemDto] })
  @IsOptional()
  @IsArray()
  @Type(() => NavigationMenuItemDto)
  items?: NavigationMenuItemDto[];
}
