/**
 * Token Service
 * Handles JWT token generation and verification
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import type { JwtPayload, AuthTokens, UserRole, Permission } from '@sellergo/types';

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId?: string;
  storeId?: string;
  role?: UserRole;
  permissions?: readonly Permission[];
}

@Injectable()
export class TokenService {
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiry = this.configService.get<string>('jwt.accessTokenExpiry', '15m');
    this.refreshTokenExpiry = this.configService.get<string>('jwt.refreshTokenExpiry', '7d');
    this.accessTokenSecret = this.configService.getOrThrow<string>('jwt.accessTokenSecret');
    this.refreshTokenSecret = this.configService.getOrThrow<string>('jwt.refreshTokenSecret');
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const jti = this.generateTokenId();
    const now = Math.floor(Date.now() / 1000);

    const accessTokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub as JwtPayload['sub'],
      email: payload.email,
      tenantId: payload.tenantId as JwtPayload['tenantId'],
      storeId: payload.storeId as JwtPayload['storeId'],
      role: payload.role,
      permissions: payload.permissions,
      jti,
      type: 'access',
    };

    const refreshTokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub as JwtPayload['sub'],
      email: payload.email,
      tenantId: payload.tenantId as JwtPayload['tenantId'],
      jti: this.generateTokenId(),
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessTokenPayload, {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpiry,
      }),
      this.jwtService.signAsync(refreshTokenPayload, {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiry,
      }),
    ]);

    // Parse expiry to seconds
    const expiresIn = this.parseExpiryToSeconds(this.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.accessTokenSecret,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshTokenSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Decode token without verification (for inspection)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generate a unique token ID
   */
  generateTokenId(): string {
    return crypto.randomUUID();
  }

  /**
   * Hash refresh token for storage
   */
  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }

  /**
   * Get refresh token expiry date
   */
  getRefreshTokenExpiry(): Date {
    const seconds = this.parseExpiryToSeconds(this.refreshTokenExpiry);
    return new Date(Date.now() + seconds * 1000);
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate verification token (alias)
   */
  async generateVerificationToken(_email: string): Promise<string> {
    return this.generateEmailVerificationToken();
  }

  /**
   * Get refresh token expiry in milliseconds
   */
  getRefreshTokenExpiryMs(rememberMe: boolean = false): number {
    const seconds = this.parseExpiryToSeconds(this.refreshTokenExpiry);
    // If remember me, extend by 30 days
    const multiplier = rememberMe ? 30 : 1;
    return seconds * 1000 * multiplier;
  }

  /**
   * Get access token expiry in seconds
   */
  getAccessTokenExpirySeconds(): number {
    return this.parseExpiryToSeconds(this.accessTokenExpiry);
  }

  /**
   * Generate access token only
   */
  async generateAccessToken(payload: TokenPayload): Promise<string> {
    const jti = this.generateTokenId();
    const accessTokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub as JwtPayload['sub'],
      email: payload.email,
      tenantId: payload.tenantId as JwtPayload['tenantId'],
      storeId: payload.storeId as JwtPayload['storeId'],
      role: payload.role,
      permissions: payload.permissions,
      jti,
      type: 'access',
    };

    return this.jwtService.signAsync(accessTokenPayload, {
      secret: this.accessTokenSecret,
      expiresIn: this.accessTokenExpiry,
    });
  }

  /**
   * Generate refresh token only
   */
  async generateRefreshToken(payload: TokenPayload): Promise<string> {
    const refreshTokenPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: payload.sub as JwtPayload['sub'],
      email: payload.email,
      tenantId: payload.tenantId as JwtPayload['tenantId'],
      jti: this.generateTokenId(),
      type: 'refresh',
    };

    return this.jwtService.signAsync(refreshTokenPayload, {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiry,
    });
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate invite token
   */
  generateInviteToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
