/**
 * Stores Service
 * Business logic for store management
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoresRepository } from './stores.repository';
import { QueueService } from '../../core/queue/queue.service';
import { RedisService } from '../../core/redis/redis.service';
import { ErrorCode, UserRole, StoreStatus } from '@sellergo/types';
import { CreateStoreDto, UpdateStoreDto, UpdateStoreSettingsDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get store by ID
   */
  async getStore(tenantId: string, storeId: string) {
    const store = await this.storesRepository.findById(tenantId, storeId);
    if (!store) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Store not found',
      });
    }
    return store;
  }

  /**
   * Get store by slug (for storefront)
   */
  async getStoreBySlug(slug: string) {
    const store = await this.storesRepository.findBySlug(slug);
    if (!store) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Store not found',
      });
    }
    return store;
  }

  /**
   * Get store by domain (for storefront routing)
   */
  async getStoreByDomain(domain: string) {
    // Check if it's a subdomain
    const baseDomain = this.configService.get<string>('app.baseDomain', 'sellergo.shop');
    if (domain.endsWith(`.${baseDomain}`)) {
      const subdomain = domain.replace(`.${baseDomain}`, '');
      return this.storesRepository.findBySubdomain(subdomain);
    }

    // Check custom domain
    return this.storesRepository.findByCustomDomain(domain);
  }

  /**
   * Get stores for authenticated user
   */
  async getStoresForUser(userId: string) {
    const memberships = await this.storesRepository.getStoresForUser(userId);
    return memberships.map((m: { store: { id: string; name: string; slug: string; logo: string | null; status: string; plan: string; _count: { orders: number; products: number } }; role: string }) => ({
      id: m.store.id,
      name: m.store.name,
      slug: m.store.slug,
      logo: m.store.logo,
      status: m.store.status,
      plan: m.store.plan,
      role: m.role,
      isOwner: m.role === 'owner',
      statistics: {
        totalOrders: m.store._count.orders,
        totalProducts: m.store._count.products,
      },
    }));
  }

  /**
   * Update store
   */
  async updateStore(tenantId: string, storeId: string, dto: UpdateStoreDto) {
    const store = await this.getStore(tenantId, storeId);

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== store.slug) {
      const slugExists = await this.storesRepository.slugExists(dto.slug);
      if (slugExists) {
        throw new ConflictException({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Store slug already taken',
        });
      }
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.slug !== undefined) {
      updateData.slug = dto.slug;
      updateData.subdomain = dto.slug;
    }
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.defaultLanguage !== undefined) updateData.defaultLanguage = dto.defaultLanguage;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.logo !== undefined) updateData.logo = dto.logo;
    if (dto.favicon !== undefined) updateData.favicon = dto.favicon;

    // Contact info
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone;

    // SEO
    if (dto.seoTitle !== undefined || dto.seoDescription !== undefined) {
      updateData.seo = {
        title: dto.seoTitle ?? store.seo?.title,
        description: dto.seoDescription ?? store.seo?.description,
      };
    }

    // Invalidate cache
    await this.invalidateStoreCache(storeId);

    return this.storesRepository.update(tenantId, storeId, updateData);
  }

  /**
   * Update store settings
   */
  async updateStoreSettings(
    tenantId: string,
    storeId: string,
    dto: UpdateStoreSettingsDto,
  ) {
    const store = await this.getStore(tenantId, storeId);

    const settings = { ...store.settings, ...dto };

    await this.invalidateStoreCache(storeId);

    return this.storesRepository.update(tenantId, storeId, { settings });
  }

  /**
   * Get store statistics
   */
  async getStatistics(tenantId: string, storeId: string) {
    // Check cache first
    const cacheKey = `store:${storeId}:stats`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const stats = await this.storesRepository.getStatistics(tenantId, storeId);

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, JSON.stringify(stats), 300);

    return stats;
  }

  /**
   * Get store members
   */
  async getMembers(tenantId: string, storeId: string) {
    return this.storesRepository.getMembers(tenantId, storeId);
  }

  /**
   * Invite team member
   */
  async inviteMember(
    tenantId: string,
    storeId: string,
    email: string,
    role: UserRole,
    invitedBy: string,
  ) {
    const store = await this.getStore(tenantId, storeId);

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.storesRepository.createInvitation({
      tenantId,
      storeId,
      email,
      role,
      token,
      invitedBy,
      expiresAt,
    });

    // Queue invitation email
    await this.queueService.addJob('email', 'team-invitation', {
      to: email,
      data: {
        storeName: store.name,
        role,
        inviteUrl: `${this.configService.get('app.url')}/invite/${token}`,
        expiresAt,
      },
    });

    return invitation;
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.storesRepository.findInvitationByToken(token);

    if (!invitation) {
      throw new NotFoundException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid or expired invitation',
      });
    }

    // Add user as member
    await this.storesRepository.addMember(
      invitation.store.tenantId,
      invitation.storeId,
      userId,
      invitation.role,
      invitation.invitedBy,
    );

    // Mark invitation as accepted
    await this.storesRepository.acceptInvitation(invitation.id);

    return { storeId: invitation.storeId, storeName: invitation.store.name };
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    tenantId: string,
    storeId: string,
    memberId: string,
    role: UserRole,
    currentUserRole: UserRole,
  ) {
    // Only owner and admin can update roles
    if (currentUserRole !== UserRole.OWNER && currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have permission to update member roles',
      });
    }

    // Cannot change owner role
    if (role === UserRole.OWNER) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot assign owner role',
      });
    }

    return this.storesRepository.updateMemberRole(tenantId, memberId, role);
  }

  /**
   * Remove member
   */
  async removeMember(
    tenantId: string,
    storeId: string,
    memberId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // Only owner and admin can remove members
    if (currentUserRole !== UserRole.OWNER && currentUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You do not have permission to remove members',
      });
    }

    return this.storesRepository.removeMember(tenantId, memberId);
  }

  /**
   * Get pending invitations
   */
  async getPendingInvitations(tenantId: string, storeId: string) {
    return this.storesRepository.getPendingInvitations(tenantId, storeId);
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(tenantId: string, invitationId: string) {
    return this.storesRepository.cancelInvitation(tenantId, invitationId);
  }

  /**
   * Suspend store
   */
  async suspendStore(tenantId: string, storeId: string, reason: string) {
    await this.invalidateStoreCache(storeId);
    return this.storesRepository.update(tenantId, storeId, {
      status: 'suspended' as StoreStatus,
    });
  }

  /**
   * Activate store
   */
  async activateStore(tenantId: string, storeId: string) {
    await this.invalidateStoreCache(storeId);
    return this.storesRepository.update(tenantId, storeId, {
      status: 'active' as StoreStatus,
    });
  }

  /**
   * Invalidate store cache
   */
  private async invalidateStoreCache(storeId: string): Promise<void> {
    const keys = [
      `store:${storeId}`,
      `store:${storeId}:stats`,
      `store:${storeId}:settings`,
    ];
    await Promise.all(keys.map((key) => this.redisService.del(key)));
  }
}
