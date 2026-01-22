/**
 * Auth Repository
 * Database operations for authentication
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { Prisma } from '@sellergo/database';
import type { Language } from '@sellergo/types';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  preferredLanguage?: Language;
  emailVerificationToken?: string;
}

export interface CreateUserWithStoreData extends CreateUserData {
  storeName: string;
  storeSlug: string;
  currency: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    return this.db.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find user by ID
   */
  async findUserById(id: string) {
    return this.db.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by email verification token
   */
  async findUserByEmailVerificationToken(token: string) {
    return this.db.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });
  }

  /**
   * Find user by password reset token
   */
  async findUserByPasswordResetToken(tokenHash: string) {
    return this.db.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.db.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Check if store slug exists
   */
  async storeSlugExists(slug: string): Promise<boolean> {
    const store = await this.db.prisma.store.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true },
    });
    return !!store;
  }

  /**
   * Create user
   */
  async createUser(data: CreateUserData) {
    return this.db.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        preferredLanguage: data.preferredLanguage || 'fr',
        emailVerificationToken: data.emailVerificationToken,
        status: 'pending',
      },
    });
  }

  /**
   * Create user with tenant (alias for createUserWithStore)
   */
  async createUserWithTenant(data: CreateUserData) {
    // Create a minimal store setup
    return this.db.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: `${data.firstName}'s Workspace`,
          status: 'active',
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          preferredLanguage: data.preferredLanguage || 'fr',
          emailVerificationToken: data.emailVerificationToken,
          status: 'pending',
        },
      });

      return { user, tenant };
    });
  }

  /**
   * Generic user update method
   */
  async updateUser(userId: string, data: Record<string, unknown>) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: data as any,
    });
  }

  /**
   * Create email verification token record
   */
  async createEmailVerificationToken(data: {
    email: string;
    token: string;
    expiresAt: Date;
  }) {
    const user = await this.findUserByEmail(data.email);
    if (user) {
      return this.db.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: data.token,
        },
      });
    }
    return null;
  }

  /**
   * Create user with store (full registration)
   */
  async createUserWithStore(data: CreateUserWithStoreData) {
    return this.db.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.storeName,
          status: 'active',
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          preferredLanguage: data.preferredLanguage || 'fr',
          emailVerificationToken: data.emailVerificationToken,
          status: 'pending',
        },
      });

      // Create store
      const store = await tx.store.create({
        data: {
          tenantId: tenant.id,
          name: data.storeName,
          slug: data.storeSlug.toLowerCase(),
          currency: data.currency,
          defaultLanguage: data.preferredLanguage || 'fr',
          supportedLanguages: [data.preferredLanguage || 'fr'],
          timezone: 'Africa/Tunis',
          status: 'active',
          plan: 'free',
          ownerId: user.id,
          subdomain: data.storeSlug.toLowerCase(),
        },
      });

      // Create store membership
      await tx.storeMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          storeId: store.id,
          role: 'owner',
          status: 'active',
        },
      });

      return { user, store, tenant };
    });
  }

  /**
   * Verify email
   */
  async verifyEmail(userId: string) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        status: 'active',
      },
    });
  }

  /**
   * Update password
   */
  async updatePassword(userId: string, passwordHash: string) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });
  }

  /**
   * Update MFA settings
   */
  async updateMfa(
    userId: string,
    data: {
      mfaEnabled: boolean;
      mfaSecret?: string | null;
      mfaBackupCodes?: string[] | null;
    },
  ) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: data.mfaEnabled,
        mfaSecret: data.mfaSecret,
        mfaBackupCodes: data.mfaBackupCodes,
      },
    });
  }

  /**
   * Update backup codes
   */
  async updateBackupCodes(userId: string, codes: string[]) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: codes,
      },
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId: string, ipAddress: string) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * Increment failed login attempts
   */
  async incrementFailedLoginAttempts(userId: string) {
    const user = await this.db.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: {
          increment: 1,
        },
      },
    });

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await this.db.prisma.user.update({
        where: { id: userId },
        data: {
          lockedUntil: lockUntil,
        },
      });
    }

    return user;
  }

  /**
   * Get user's store memberships
   */
  async getUserStoreMemberships(userId: string) {
    return this.db.prisma.storeMember.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            tenantId: true,
          },
        },
      },
    });
  }

  /**
   * Get user's default store membership
   */
  async getUserDefaultStoreMembership(userId: string) {
    return this.db.prisma.storeMember.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            tenantId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Create session record
   */
  async createSession(data: {
    userId: string;
    refreshTokenHash: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
  }) {
    return this.db.prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Find session by refresh token hash
   */
  async findSessionByRefreshTokenHash(tokenHash: string) {
    return this.db.prisma.session.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string) {
    return this.db.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string) {
    return this.db.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Update session refresh token
   */
  async updateSessionRefreshToken(sessionId: string, tokenHash: string) {
    return this.db.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: tokenHash,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string) {
    return this.db.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastActivityAt: 'desc',
      },
    });
  }

  /**
   * Create audit log
   */
  async createAuditLog(data: {
    userId: string;
    tenantId?: string;
    action: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.db.prisma.activityLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        resource: 'auth',
        resourceId: data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      },
    });
  }

  /**
   * Update email verification token
   */
  async updateEmailVerificationToken(userId: string, token: string) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
      },
    });
  }

  /**
   * Find user by valid password reset token
   */
  async findValidPasswordResetToken(tokenHash: string) {
    const user = await this.db.prisma.user.findFirst({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) return null;

    // In production, compare hashed token
    return { id: user.id, userId: user.id, token: user.passwordResetToken };
  }

  /**
   * Mark password reset token as used
   */
  async markPasswordResetTokenUsed(userId: string) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }

  /**
   * Find valid email verification token
   */
  async findValidEmailVerificationToken(token: string) {
    const user = await this.db.prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: false,
      },
    });

    if (!user) return null;

    return { id: user.id, email: user.email, userId: user.id };
  }

  /**
   * Delete email verification token (mark as used)
   */
  async deleteEmailVerificationToken(userId: string) {
    return this.db.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: null,
      },
    });
  }
}
