/**
 * Stores Repository
 * Database operations for stores
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { StoreStatus, StorePlan, Language } from '@sellergo/types';

export interface CreateStoreData {
  tenantId: string;
  name: string;
  slug: string;
  currency: string;
  defaultLanguage: Language;
  timezone: string;
  ownerId: string;
}

export interface UpdateStoreData {
  name?: string;
  description?: string;
  currency?: string;
  defaultLanguage?: Language;
  supportedLanguages?: Language[];
  timezone?: string;
  status?: StoreStatus;
  plan?: StorePlan;
  logo?: string;
  favicon?: string;
  subdomain?: string;
  customDomain?: string;
  customDomainVerified?: boolean;
  settings?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  contactEmail?: string;
  contactPhone?: string;
  businessAddress?: Record<string, unknown>;
}

@Injectable()
export class StoresRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Find store by ID
   */
  async findById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
            orders: true,
            customers: true,
          },
        },
      },
    });
  }

  /**
   * Find store by slug
   */
  async findBySlug(slug: string) {
    return this.db.prisma.store.findUnique({
      where: { slug },
    });
  }

  /**
   * Find store by subdomain
   */
  async findBySubdomain(subdomain: string) {
    return this.db.prisma.store.findFirst({
      where: { subdomain },
    });
  }

  /**
   * Find store by custom domain
   */
  async findByCustomDomain(domain: string) {
    return this.db.prisma.store.findFirst({
      where: {
        customDomain: domain,
        customDomainVerified: true,
      },
    });
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string): Promise<boolean> {
    const store = await this.db.prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    });
    return !!store;
  }

  /**
   * Create store
   */
  async create(data: CreateStoreData) {
    const prisma = await this.db.withTenant(data.tenantId);
    return prisma.store.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        slug: data.slug,
        currency: data.currency,
        defaultLanguage: data.defaultLanguage,
        supportedLanguages: [data.defaultLanguage],
        timezone: data.timezone,
        status: 'active',
        plan: 'free',
        ownerId: data.ownerId,
        subdomain: data.slug,
        settings: {
          countryRestrictionMode: 'allow_all',
          allowedCountries: [],
          blockedCountries: [],
          requirePhone: true,
          requireAddress: true,
          showQuantityOffers: true,
          showUpsells: true,
          showTrustBadges: true,
          lowStockThreshold: 5,
          lowStockNotificationEnabled: true,
          themeId: 'default',
          primaryColor: '#3B82F6',
          accentColor: '#10B981',
          thankYouPageTitle: 'Thank you for your order!',
          thankYouPageSubtitle: 'Your order has been received.',
          thankYouPageNextStepsTitle: 'What happens next?',
          thankYouPageNextStepsDescription: 'We will contact you shortly to confirm your order.',
        },
        seo: {
          title: data.name,
          description: '',
        },
      },
    });
  }

  /**
   * Update store
   */
  async update(tenantId: string, id: string, data: UpdateStoreData) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.store.update({
      where: { id },
      data,
    });
  }

  /**
   * Get stores for user
   */
  async getStoresForUser(userId: string) {
    return this.db.prisma.storeMember.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        store: {
          include: {
            _count: {
              select: {
                orders: true,
                products: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get store statistics
   */
  async getStatistics(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);

    const [orderStats, productCount, customerCount] = await Promise.all([
      prisma.order.aggregate({
        where: { storeId },
        _count: true,
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.product.count({
        where: { storeId },
      }),
      prisma.customer.count({
        where: { storeId },
      }),
    ]);

    return {
      totalOrders: orderStats._count,
      totalRevenue: orderStats._sum.totalAmount || 0,
      totalProducts: productCount,
      totalCustomers: customerCount,
    };
  }

  /**
   * Get store members
   */
  async getMembers(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeMember.findMany({
      where: {
        storeId,
        status: { in: ['active', 'pending'] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Add store member
   */
  async addMember(
    tenantId: string,
    storeId: string,
    userId: string,
    role: string,
    invitedBy: string,
  ) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeMember.create({
      data: {
        tenantId,
        storeId,
        userId,
        role,
        status: 'active',
        invitedBy,
      },
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(tenantId: string, memberId: string, role: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeMember.update({
      where: { id: memberId },
      data: { role },
    });
  }

  /**
   * Remove member
   */
  async removeMember(tenantId: string, memberId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeMember.update({
      where: { id: memberId },
      data: { status: 'revoked' },
    });
  }

  /**
   * Create team invitation
   */
  async createInvitation(data: {
    tenantId: string;
    storeId: string;
    email: string;
    role: string;
    token: string;
    invitedBy: string;
    expiresAt: Date;
  }) {
    const prisma = await this.db.withTenant(data.tenantId);
    return prisma.teamInvitation.create({
      data: {
        tenantId: data.tenantId,
        storeId: data.storeId,
        email: data.email,
        role: data.role,
        token: data.token,
        invitedBy: data.invitedBy,
        expiresAt: data.expiresAt,
        status: 'pending',
      },
    });
  }

  /**
   * Find invitation by token
   */
  async findInvitationByToken(token: string) {
    return this.db.prisma.teamInvitation.findFirst({
      where: {
        token,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            tenantId: true,
          },
        },
      },
    });
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(invitationId: string) {
    return this.db.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });
  }

  /**
   * Get pending invitations for store
   */
  async getPendingInvitations(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.teamInvitation.findMany({
      where: {
        storeId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(tenantId: string, invitationId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' },
    });
  }

  // Domain operations

  /**
   * Get store domains
   */
  async getDomains(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeDomain.findMany({
      where: { storeId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Add domain
   */
  async addDomain(data: {
    tenantId: string;
    storeId: string;
    domain: string;
    type: 'subdomain' | 'custom';
    verificationToken?: string;
  }) {
    const prisma = await this.db.withTenant(data.tenantId);
    return prisma.storeDomain.create({
      data: {
        tenantId: data.tenantId,
        storeId: data.storeId,
        domain: data.domain,
        type: data.type,
        isPrimary: false,
        isVerified: data.type === 'subdomain',
        verificationToken: data.verificationToken,
        verificationMethod: data.type === 'custom' ? 'cname' : null,
        sslStatus: data.type === 'subdomain' ? 'active' : 'pending',
      },
    });
  }

  /**
   * Update domain
   */
  async updateDomain(
    tenantId: string,
    domainId: string,
    data: {
      isPrimary?: boolean;
      isVerified?: boolean;
      verifiedAt?: Date;
      sslStatus?: 'pending' | 'active' | 'failed';
      sslIssuedAt?: Date;
      sslExpiresAt?: Date;
    },
  ) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeDomain.update({
      where: { id: domainId },
      data,
    });
  }

  /**
   * Delete domain
   */
  async deleteDomain(tenantId: string, domainId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.storeDomain.delete({
      where: { id: domainId },
    });
  }

  /**
   * Find domain by verification token
   */
  async findDomainByVerificationToken(token: string) {
    return this.db.prisma.storeDomain.findFirst({
      where: { verificationToken: token },
    });
  }

  // Navigation operations

  /**
   * Get navigation menus
   */
  async getNavigationMenus(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.navigationMenu.findMany({
      where: { storeId },
      orderBy: [{ type: 'asc' }, { column: 'asc' }],
    });
  }

  /**
   * Create navigation menu
   */
  async createNavigationMenu(data: {
    tenantId: string;
    storeId: string;
    type: 'header' | 'footer';
    column?: number;
    title?: string;
    items: Array<{
      label: string;
      url: string;
      openInNewTab: boolean;
      position: number;
    }>;
  }) {
    const prisma = await this.db.withTenant(data.tenantId);
    return prisma.navigationMenu.create({
      data: {
        tenantId: data.tenantId,
        storeId: data.storeId,
        type: data.type,
        column: data.column,
        title: data.title,
        items: data.items,
      },
    });
  }

  /**
   * Update navigation menu
   */
  async updateNavigationMenu(
    tenantId: string,
    menuId: string,
    data: {
      title?: string;
      items?: Array<{
        id?: string;
        label: string;
        url: string;
        openInNewTab: boolean;
        position: number;
      }>;
    },
  ) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.navigationMenu.update({
      where: { id: menuId },
      data,
    });
  }

  /**
   * Delete navigation menu
   */
  async deleteNavigationMenu(tenantId: string, menuId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.navigationMenu.delete({
      where: { id: menuId },
    });
  }
}
