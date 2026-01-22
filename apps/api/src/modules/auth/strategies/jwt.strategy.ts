/**
 * JWT Strategy for Passport
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@sellergo/types';
import { AuthRepository } from '../auth.repository';

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  storeId?: string;
  role?: string;
  permissions?: readonly string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessTokenSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Verify token type
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user still exists and is active
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    // Check if user is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      storeId: payload.storeId,
      role: payload.role,
      permissions: payload.permissions,
    };
  }
}
