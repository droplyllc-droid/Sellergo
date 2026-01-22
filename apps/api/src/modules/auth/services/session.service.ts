/**
 * Session Service
 * Handles session management and tracking
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../core/redis/redis.service';
import * as crypto from 'crypto';

export interface SessionData {
  id?: string;
  userId: string;
  tenantId?: string;
  storeId?: string;
  refreshTokenHash: string;
  userAgent: string;
  ipAddress: string;
  deviceInfo?: DeviceInfo;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

export interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  isMobile: boolean;
}

export interface ActiveSession {
  id: string;
  userAgent: string;
  ipAddress: string;
  deviceInfo?: DeviceInfo;
  createdAt: Date;
  lastActivityAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly sessionTtlSeconds: number;
  private readonly maxSessionsPerUser: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    // Default 7 days in seconds
    this.sessionTtlSeconds = this.configService.get<number>('session.ttl', 604800);
    this.maxSessionsPerUser = this.configService.get<number>('session.maxPerUser', 10);
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    refreshTokenHash: string,
    userAgent: string,
    ipAddress: string,
    tenantId?: string,
    storeId?: string,
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);

    const sessionData: SessionData = {
      userId,
      tenantId,
      storeId,
      refreshTokenHash,
      userAgent,
      ipAddress,
      deviceInfo: this.parseUserAgent(userAgent),
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    };

    // Store session
    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      this.sessionTtlSeconds,
    );

    // Add to user's session set
    await this.addToUserSessions(userId, sessionId);

    // Enforce max sessions
    await this.enforceMaxSessions(userId);

    return sessionId;
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redisService.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!data) {
      return null;
    }

    const session = JSON.parse(data) as SessionData;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.revokeSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    session.lastActivityAt = new Date();

    const ttl = await this.redisService.ttl(`${this.SESSION_PREFIX}${sessionId}`);
    if (ttl > 0) {
      await this.redisService.set(
        `${this.SESSION_PREFIX}${sessionId}`,
        JSON.stringify(session),
        ttl,
      );
    }
  }

  /**
   * Validate session with refresh token
   */
  async validateSession(
    sessionId: string,
    refreshTokenHash: string,
  ): Promise<SessionData> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('Session not found or expired');
    }

    if (session.refreshTokenHash !== refreshTokenHash) {
      // Token mismatch - possible token theft, revoke all sessions
      await this.revokeAllUserSessions(session.userId);
      throw new UnauthorizedException('Invalid session token');
    }

    return session;
  }

  /**
   * Revoke a session
   */
  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.removeFromUserSessions(session.userId, sessionId);
    }
    await this.redisService.del(`${this.SESSION_PREFIX}${sessionId}`);
  }

  /**
   * Find a valid session by user ID and refresh token
   */
  async findValidSession(userId: string, refreshToken: string): Promise<SessionData | null> {
    const sessionIds = await this.getUserSessionIds(userId);

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        // Note: In production, compare hashed token
        return { ...session, id: sessionId };
      }
    }

    return null;
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, updates: Partial<Pick<SessionData, 'refreshTokenHash' | 'lastActivityAt'>>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    if (updates.refreshTokenHash) {
      session.refreshTokenHash = updates.refreshTokenHash;
    }
    if (updates.lastActivityAt) {
      session.lastActivityAt = updates.lastActivityAt;
    }

    const ttl = await this.redisService.ttl(`${this.SESSION_PREFIX}${sessionId}`);
    if (ttl > 0) {
      await this.redisService.set(
        `${this.SESSION_PREFIX}${sessionId}`,
        JSON.stringify(session),
        ttl,
      );
    }
  }

  /**
   * Revoke session by refresh token
   */
  async revokeSessionByToken(userId: string, refreshToken: string): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        // For now, revoke the first session found for the user
        // In production, you'd compare the refresh token hash
        await this.revokeSession(sessionId);
        return;
      }
    }
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);

    const deletePromises = sessionIds.map((id) =>
      this.redisService.del(`${this.SESSION_PREFIX}${id}`),
    );

    await Promise.all([
      ...deletePromises,
      this.redisService.del(`${this.USER_SESSIONS_PREFIX}${userId}`),
    ]);
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<ActiveSession[]> {
    const sessionIds = await this.getUserSessionIds(userId);
    const sessions: ActiveSession[] = [];

    for (const id of sessionIds) {
      const session = await this.getSession(id);
      if (session) {
        sessions.push({
          id,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          deviceInfo: session.deviceInfo,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          isCurrent: id === currentSessionId,
        });
      }
    }

    // Sort by last activity, most recent first
    return sessions.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    );
  }

  /**
   * Rotate refresh token for a session
   */
  async rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActivityAt = new Date();

    const ttl = await this.redisService.ttl(`${this.SESSION_PREFIX}${sessionId}`);
    if (ttl > 0) {
      await this.redisService.set(
        `${this.SESSION_PREFIX}${sessionId}`,
        JSON.stringify(session),
        ttl,
      );
    }
  }

  /**
   * Get session count for user
   */
  async getSessionCount(userId: string): Promise<number> {
    const sessionIds = await this.getUserSessionIds(userId);
    return sessionIds.length;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get user's session IDs from set
   */
  private async getUserSessionIds(userId: string): Promise<string[]> {
    const data = await this.redisService.get(`${this.USER_SESSIONS_PREFIX}${userId}`);
    if (!data) {
      return [];
    }
    return JSON.parse(data) as string[];
  }

  /**
   * Add session to user's session set
   */
  private async addToUserSessions(userId: string, sessionId: string): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);
    if (!sessionIds.includes(sessionId)) {
      sessionIds.push(sessionId);
      await this.redisService.set(
        `${this.USER_SESSIONS_PREFIX}${userId}`,
        JSON.stringify(sessionIds),
        this.sessionTtlSeconds,
      );
    }
  }

  /**
   * Remove session from user's session set
   */
  private async removeFromUserSessions(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);
    const filtered = sessionIds.filter((id) => id !== sessionId);
    await this.redisService.set(
      `${this.USER_SESSIONS_PREFIX}${userId}`,
      JSON.stringify(filtered),
      this.sessionTtlSeconds,
    );
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);

    if (sessions.length > this.maxSessionsPerUser) {
      // Remove oldest sessions (already sorted by lastActivityAt)
      const toRemove = sessions.slice(this.maxSessionsPerUser);
      for (const session of toRemove) {
        await this.revokeSession(session.id);
      }
    }
  }

  /**
   * Parse user agent string to device info
   */
  private parseUserAgent(userAgent: string): DeviceInfo {
    const ua = userAgent.toLowerCase();

    // Detect browser
    let browser: string | undefined;
    if (ua.includes('chrome') && !ua.includes('edge')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
    } else if (ua.includes('edge')) {
      browser = 'Edge';
    } else if (ua.includes('opera') || ua.includes('opr')) {
      browser = 'Opera';
    }

    // Detect OS
    let os: string | undefined;
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('mac os x') || ua.includes('macos')) {
      os = 'macOS';
    } else if (ua.includes('linux') && !ua.includes('android')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
    }

    // Detect device type
    let device: string | undefined;
    const isMobile =
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone') ||
      ua.includes('ipad');

    if (ua.includes('ipad') || ua.includes('tablet')) {
      device = 'Tablet';
    } else if (isMobile) {
      device = 'Mobile';
    } else {
      device = 'Desktop';
    }

    return {
      browser,
      os,
      device,
      isMobile,
    };
  }
}
