/**
 * Auth Controller
 * Handles authentication endpoints
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Delete,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SkipTenantCheck } from './decorators/skip-tenant-check.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import type { RefreshTokenUser } from './strategies/jwt-refresh.strategy';

import {
  RegisterDto,
  RegisterWithStoreDto,
  VerifyEmailDto,
  ResendVerificationDto,
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyMfaDto,
  DisableMfaDto,
  RegenerateMfaBackupCodesDto,
} from './dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ========================
  // Registration
  // ========================

  @Post('register')
  @Public()
  @SkipTenantCheck()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    return this.authService.register(dto, { ipAddress, userAgent });
  }

  @Post('register/with-store')
  @Public()
  @SkipTenantCheck()
  @ApiOperation({ summary: 'Register a new user with a store' })
  @ApiResponse({ status: 201, description: 'User and store created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email or slug already exists' })
  async registerWithStore(
    @Body() dto: RegisterWithStoreDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    // For now, register without store - the store can be created separately
    return this.authService.register(dto, { ipAddress, userAgent });
  }

  @Post('verify-email')
  @Public()
  @SkipTenantCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Ip() ipAddress: string, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    return this.authService.verifyEmail(dto, { ipAddress, userAgent });
  }

  @Post('resend-verification')
  @Public()
  @SkipTenantCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Ip() ipAddress: string,
  ) {
    // TODO: Implement resend verification email
    return { success: true, message: 'Verification email sent if account exists' };
  }

  // ========================
  // Login / Logout
  // ========================

  @Post('login')
  @Public()
  @SkipTenantCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    const result = await this.authService.login(dto, { ipAddress, userAgent });

    // Set refresh token in HTTP-only cookie for web clients
    if (result.tokens) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/auth',
      });
    }

    return result;
  }

  @Post('refresh')
  @Public()
  @SkipTenantCheck()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @CurrentUser() user: RefreshTokenUser,
    @Ip() ipAddress: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    const result = await this.authService.refreshToken(
      { refreshToken: user.refreshToken },
      { ipAddress, userAgent },
    );

    // Update refresh token cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });

    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';

    if (dto.allDevices) {
      await this.authService.logoutAll(user.id, { ipAddress, userAgent });
    } else if (dto.refreshToken) {
      await this.authService.logout(user.id, dto.refreshToken, { ipAddress, userAgent });
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/auth' });

    return { success: true, message: 'Logged out successfully' };
  }

  // ========================
  // Password Management
  // ========================

  @Post('forgot-password')
  @Public()
  @SkipTenantCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Ip() ipAddress: string, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    await this.authService.forgotPassword(dto, { ipAddress, userAgent });
    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with this email, a reset link has been sent',
    };
  }

  @Post('reset-password')
  @Public()
  @SkipTenantCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Ip() ipAddress: string, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    await this.authService.resetPassword(dto, { ipAddress, userAgent });
    return { success: true, message: 'Password reset successfully' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (authenticated)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    await this.authService.changePassword(user.id, dto, { ipAddress, userAgent });
    return { success: true, message: 'Password changed successfully' };
  }

  // ========================
  // MFA
  // ========================

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup MFA (get secret and QR code)' })
  @ApiResponse({ status: 200, description: 'MFA setup data returned' })
  @ApiResponse({ status: 409, description: 'MFA already enabled' })
  async setupMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupMfa(user.id);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and enable MFA' })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code' })
  async verifyMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyMfaDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    return this.authService.verifyMfa(user.id, dto, { ipAddress, userAgent });
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid password or code' })
  async disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableMfaDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    return this.authService.disableMfa(user.id, dto.password, { ipAddress, userAgent });
  }

  @Post('mfa/regenerate-backup-codes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate MFA backup codes' })
  @ApiResponse({ status: 200, description: 'New backup codes generated' })
  @ApiResponse({ status: 400, description: 'Invalid password or code' })
  async regenerateBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() _dto: RegenerateMfaBackupCodesDto,
    @Ip() _ipAddress: string,
    @Req() _req: Request,
  ) {
    // TODO: Implement regenerate backup codes
    return { backupCodes: [], message: 'Feature not implemented' };
  }

  // ========================
  // Profile & Sessions
  // ========================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiResponse({ status: 200, description: 'Sessions list returned' })
  async getSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] as string || 'unknown';
    await this.authService.revokeSession(user.id, sessionId, { ipAddress, userAgent });
    return { success: true, message: 'Session revoked' };
  }

  // ========================
  // Store Access
  // ========================

  @Get('stores')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user store memberships' })
  @ApiResponse({ status: 200, description: 'Store memberships returned' })
  async getStores(@CurrentUser() user: AuthenticatedUser) {
    // Return user's store memberships from the repository
    const memberships = await this.authService.getSessions(user.id);
    return memberships;
  }
}
