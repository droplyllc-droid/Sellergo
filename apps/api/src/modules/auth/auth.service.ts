import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode, Language, UserRole } from '@sellergo/types';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { MfaService } from './services/mfa.service';
import { SessionService } from './services/session.service';
import { AuthRepository } from './auth.repository';
import { QueueService } from '../../core/queue/queue.service';
import { RedisService } from '../../core/redis/redis.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  MfaSetupDto,
  MfaVerifyDto,
} from './dto';
import type {
  AuthTokens,
  UserProfile,
  StoreMembershipSummary,
  MfaSetupResponse,
} from './types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
    private readonly mfaService: MfaService,
    private readonly sessionService: SessionService,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Register a new user
   */
  async register(
    dto: RegisterDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<{ user: UserProfile; requiresVerification: boolean }> {
    // Check if email already exists
    const existingUser = await this.authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Email already registered',
      });
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      dto.password
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        code: ErrorCode.PASSWORD_TOO_WEAK,
        message: passwordValidation.errors.join(', '),
      });
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Create user and tenant
    const { user, tenant } = await this.authRepository.createUserWithTenant({
      email: dto.email.toLowerCase().trim(),
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      preferredLanguage: dto.preferredLanguage ?? 'en',
    });

    // Generate verification token
    const verificationToken = await this.tokenService.generateVerificationToken(
      user.email
    );

    // Store verification token
    await this.authRepository.createEmailVerificationToken({
      email: user.email,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Queue verification email
    await this.queueService.queueEmail({
      type: 'verification',
      to: user.email,
      data: {
        firstName: user.firstName,
        verificationUrl: `${this.configService.get('urls.app')}/auth/verify-email?token=${verificationToken}`,
      },
    });

    // Log audit event
    await this.authRepository.createAuditLog({
      userId: user.id,
      tenantId: tenant.id,
      action: 'REGISTER',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      user: this.mapToUserProfile(user),
      requiresVerification: true,
    };
  }

  /**
   * Login user
   */
  async login(
    dto: LoginDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<{
    user: UserProfile;
    tokens: AuthTokens;
    requiresMfa: boolean;
    stores: StoreMembershipSummary[];
  }> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    // Check if user exists
    if (!user) {
      await this.logFailedLogin(dto.email, metadata);
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.ACCOUNT_LOCKED,
        message: `Account is locked. Try again after ${user.lockedUntil.toISOString()}`,
      });
    }

    // Check if account is active
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Account is not active',
      });
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(
      dto.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.email, metadata);
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    // Check email verification (allow login but flag it)
    if (!user.emailVerified) {
      // We'll allow login but the frontend should prompt for verification
    }

    // Check MFA
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        // Return partial response - MFA required
        return {
          user: this.mapToUserProfile(user),
          tokens: null as unknown as AuthTokens,
          requiresMfa: true,
          stores: [],
        };
      }

      // Verify MFA code
      const isMfaValid = this.mfaService.verifyTotp(
        dto.mfaCode,
        user.mfaSecret!
      );
      if (!isMfaValid) {
        throw new UnauthorizedException({
          code: ErrorCode.MFA_INVALID,
          message: 'Invalid MFA code',
        });
      }
    }

    // Get user's store memberships
    const memberships = await this.authRepository.getUserStoreMemberships(
      user.id
    );

    // Generate tokens
    const tokens = await this.generateAuthTokens(user, memberships[0]);

    // Create session
    await this.sessionService.createSession({
      userId: user.id,
      refreshTokenHash: await this.passwordService.hash(tokens.refreshToken),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt: new Date(
        Date.now() +
          this.tokenService.getRefreshTokenExpiryMs(dto.rememberMe ?? false)
      ),
    });

    // Reset failed attempts and update last login
    await this.authRepository.updateUser(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: metadata.ipAddress,
    });

    // Log audit event
    await this.authRepository.createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return {
      user: this.mapToUserProfile(user),
      tokens,
      requiresMfa: false,
      stores: this.mapToStoreMembershipSummaries(memberships),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    dto: RefreshTokenDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<AuthTokens> {
    // Verify refresh token
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);

    // Check if session exists and is valid
    const session = await this.sessionService.findValidSession(
      payload.sub,
      dto.refreshToken
    );

    if (!session) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired refresh token',
      });
    }

    // Get user
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'User not found or inactive',
      });
    }

    // Get memberships
    const memberships = await this.authRepository.getUserStoreMemberships(
      user.id
    );

    // Rotate refresh token (security best practice)
    const newTokens = await this.generateAuthTokens(user, memberships[0]);

    // Update session with new refresh token hash
    await this.sessionService.updateSession(session.id, {
      refreshTokenHash: await this.passwordService.hash(newTokens.refreshToken),
      lastActivityAt: new Date(),
    });

    return newTokens;
  }

  /**
   * Logout user
   */
  async logout(
    userId: string,
    refreshToken: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    // Revoke session
    await this.sessionService.revokeSessionByToken(userId, refreshToken);

    // Log audit event
    await this.authRepository.createAuditLog({
      userId,
      action: 'LOGOUT',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(
    userId: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    await this.sessionService.revokeAllUserSessions(userId);

    await this.authRepository.createAuditLog({
      userId,
      action: 'LOGOUT_ALL',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.debug(`Password reset requested for non-existent email: ${dto.email}`);
      return;
    }

    // Check rate limit for password reset
    const rateLimitKey = `password-reset:${dto.email}`;
    const { allowed } = await this.redisService.checkRateLimit(
      rateLimitKey,
      3,
      3600 // 3 requests per hour
    );

    if (!allowed) {
      this.logger.warn(`Password reset rate limit exceeded for: ${dto.email}`);
      return;
    }

    // Generate reset token
    const resetToken = await this.tokenService.generatePasswordResetToken();

    // Store reset token
    await this.authRepository.createPasswordResetToken({
      userId: user.id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Queue reset email
    await this.queueService.queueEmail({
      type: 'password-reset',
      to: user.email,
      data: {
        firstName: user.firstName,
        resetUrl: `${this.configService.get('urls.app')}/auth/reset-password?token=${resetToken}`,
      },
    });

    // Log audit event
    await this.authRepository.createAuditLog({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    dto: ResetPasswordDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    // Validate token
    const resetToken = await this.authRepository.findValidPasswordResetToken(
      dto.token
    );

    if (!resetToken) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired reset token',
      });
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      dto.newPassword
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        code: ErrorCode.PASSWORD_TOO_WEAK,
        message: passwordValidation.errors.join(', '),
      });
    }

    // Hash new password
    const passwordHash = await this.passwordService.hash(dto.newPassword);

    // Update password
    await this.authRepository.updateUser(resetToken.userId, {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    // Mark token as used
    await this.authRepository.markPasswordResetTokenUsed(resetToken.id);

    // Revoke all sessions (force re-login)
    await this.sessionService.revokeAllUserSessions(resetToken.userId);

    // Log audit event
    await this.authRepository.createAuditLog({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Verify email
   */
  async verifyEmail(
    dto: VerifyEmailDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    const verificationToken =
      await this.authRepository.findValidEmailVerificationToken(dto.token);

    if (!verificationToken) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired verification token',
      });
    }

    // Find user and update
    const user = await this.authRepository.findUserByEmail(
      verificationToken.email
    );
    if (!user) {
      throw new BadRequestException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'User not found',
      });
    }

    await this.authRepository.updateUser(user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
    });

    // Delete verification token
    await this.authRepository.deleteEmailVerificationToken(verificationToken.id);

    // Log audit event
    await this.authRepository.createAuditLog({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Change password (authenticated)
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Verify current password
    const isPasswordValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Current password is incorrect',
      });
    }

    // Validate new password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      dto.newPassword
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException({
        code: ErrorCode.PASSWORD_TOO_WEAK,
        message: passwordValidation.errors.join(', '),
      });
    }

    // Hash and update password
    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.authRepository.updateUser(userId, { passwordHash });

    // Revoke all other sessions
    await this.sessionService.revokeAllUserSessions(userId);

    // Log audit event
    await this.authRepository.createAuditLog({
      userId,
      action: 'PASSWORD_CHANGED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Setup MFA
   */
  async setupMfa(userId: string): Promise<MfaSetupResponse> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.mfaEnabled) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'MFA is already enabled',
      });
    }

    // Generate MFA secret
    const { secret, qrCodeUrl, backupCodes } = await this.mfaService.generateSecret(
      user.email
    );

    // Store secret temporarily (not enabled yet)
    await this.redisService.setJson(
      `mfa-setup:${userId}`,
      { secret, backupCodes },
      600 // 10 minutes
    );

    return { secret, qrCodeUrl, backupCodes };
  }

  /**
   * Verify and enable MFA
   */
  async verifyMfa(
    userId: string,
    dto: MfaVerifyDto,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    // Get pending MFA setup
    const pendingSetup = await this.redisService.getJson<{
      secret: string;
      backupCodes: string[];
    }>(`mfa-setup:${userId}`);

    if (!pendingSetup) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'No pending MFA setup found. Please start again.',
      });
    }

    // Verify code
    const isValid = this.mfaService.verifyTotp(dto.code, pendingSetup.secret);
    if (!isValid) {
      throw new BadRequestException({
        code: ErrorCode.MFA_INVALID,
        message: 'Invalid verification code',
      });
    }

    // Enable MFA
    await this.authRepository.updateUser(userId, {
      mfaEnabled: true,
      mfaMethod: 'TOTP',
      mfaSecret: pendingSetup.secret,
      mfaBackupCodes: pendingSetup.backupCodes,
    });

    // Clear pending setup
    await this.redisService.del(`mfa-setup:${userId}`);

    // Log audit event
    await this.authRepository.createAuditLog({
      userId,
      action: 'MFA_ENABLED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Disable MFA
   */
  async disableMfa(
    userId: string,
    password: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(
      password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new BadRequestException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'Password is incorrect',
      });
    }

    // Disable MFA
    await this.authRepository.updateUser(userId, {
      mfaEnabled: false,
      mfaMethod: null,
      mfaSecret: null,
      mfaBackupCodes: [],
    });

    // Log audit event
    await this.authRepository.createAuditLog({
      userId,
      action: 'MFA_DISABLED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.mapToUserProfile(user);
  }

  /**
   * Get user's active sessions
   */
  async getSessions(
    userId: string
  ): Promise<{ id: string; userAgent: string; ipAddress: string; lastActivityAt: Date }[]> {
    return this.sessionService.getUserSessions(userId);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    await this.sessionService.revokeSession(userId, sessionId);

    await this.authRepository.createAuditLog({
      userId,
      action: 'SESSION_REVOKED',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: { revokedSessionId: sessionId },
    });
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async generateAuthTokens(
    user: { id: string; email: string },
    membership?: { tenantId: string; storeId: string; role: string }
  ): Promise<AuthTokens> {
    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      tenantId: membership?.tenantId,
      storeId: membership?.storeId,
      role: membership?.role,
    });

    const refreshToken = await this.tokenService.generateRefreshToken({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokenService.getAccessTokenExpirySeconds(),
      tokenType: 'Bearer',
    };
  }

  private async handleFailedLogin(
    userId: string,
    email: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    const maxAttempts = this.configService.get<number>('security.maxLoginAttempts') ?? 5;
    const lockoutMinutes = this.configService.get<number>('security.lockoutDurationMinutes') ?? 30;

    // Get current attempts
    const user = await this.authRepository.findUserById(userId);
    const attempts = (user?.failedLoginAttempts ?? 0) + 1;

    // Check if should lock
    const updates: Record<string, unknown> = {
      failedLoginAttempts: attempts,
    };

    if (attempts >= maxAttempts) {
      updates['lockedUntil'] = new Date(Date.now() + lockoutMinutes * 60 * 1000);

      this.logger.warn(`Account locked due to too many failed attempts: ${email}`);

      await this.authRepository.createAuditLog({
        userId,
        action: 'ACCOUNT_LOCKED',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { attempts },
      });
    }

    await this.authRepository.updateUser(userId, updates);
    await this.logFailedLogin(email, metadata);
  }

  private async logFailedLogin(
    email: string,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<void> {
    this.logger.warn(`Failed login attempt for: ${email} from ${metadata.ipAddress}`);
  }

  private mapToUserProfile(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    preferredLanguage: string;
    mfaEnabled: boolean;
    emailVerified: boolean;
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatarUrl ? { url: user.avatarUrl } : undefined,
      preferredLanguage: user.preferredLanguage as 'en' | 'fr' | 'ar' | 'es',
      mfaEnabled: user.mfaEnabled,
      emailVerified: user.emailVerified,
    };
  }

  private mapToStoreMembershipSummaries(
    memberships: Array<{
      storeId: string;
      role: string;
      store: {
        id: string;
        name: string;
        logoUrl: string | null;
        ownerId: string;
      };
    }>
  ): StoreMembershipSummary[] {
    return memberships.map((m) => ({
      storeId: m.storeId,
      storeName: m.store.name,
      storeLogo: m.store.logoUrl ? { url: m.store.logoUrl } : undefined,
      role: m.role as 'owner' | 'admin' | 'manager' | 'staff' | 'read_only',
      isOwner: m.role === 'OWNER',
    }));
  }
}
