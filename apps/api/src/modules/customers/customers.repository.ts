/**
 * Customers Repository
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { CustomerStatus, BlockType } from '@sellergo/types';

export interface CustomerFilter {
  status?: CustomerStatus;
  search?: string;
  hasEmail?: boolean;
  minOrders?: number;
  maxOrders?: number;
  minSpent?: number;
  maxSpent?: number;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CustomersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: { select: { orders: true } },
      },
    });
  }

  async findByPhone(tenantId: string, storeId: string, phone: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.findFirst({
      where: { storeId, phone },
    });
  }

  async findByEmail(tenantId: string, storeId: string, email: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.findFirst({
      where: { storeId, email },
    });
  }

  async findMany(tenantId: string, storeId: string, filter: CustomerFilter, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const where: Record<string, unknown> = { storeId };
    if (filter.status) where.status = filter.status;
    if (filter.hasEmail === true) where.email = { not: null };
    if (filter.hasEmail === false) where.email = null;
    if (filter.tags?.length) where.tags = { hasSome: filter.tags };
    if (filter.search) {
      where.OR = [
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { phone: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) (where.createdAt as Record<string, Date>).gte = filter.dateFrom;
      if (filter.dateTo) (where.createdAt as Record<string, Date>).lte = filter.dateTo;
    }
    if (filter.minOrders !== undefined) where.totalOrders = { gte: filter.minOrders };
    if (filter.maxOrders !== undefined) {
      where.totalOrders = { ...(where.totalOrders as Record<string, number> || {}), lte: filter.maxOrders };
    }
    if (filter.minSpent !== undefined) where.totalSpent = { gte: filter.minSpent };
    if (filter.maxSpent !== undefined) {
      where.totalSpent = { ...(where.totalSpent as Record<string, number> || {}), lte: filter.maxSpent };
    }

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          totalOrders: true,
          totalSpent: true,
          lastOrderAt: true,
          firstOrderAt: true,
          status: true,
          createdAt: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((c: { firstName: string | null; lastName: string | null; phone: string; [key: string]: unknown }) => ({
        ...c,
        fullName: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(tenantId: string, storeId: string, data: {
    phone: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    acceptsMarketing?: boolean;
    notes?: string;
    tags?: string[];
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.create({
      data: {
        tenantId,
        storeId,
        phone: data.phone,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        acceptsMarketing: data.acceptsMarketing ?? false,
        notes: data.notes,
        tags: data.tags || [],
        status: 'active',
        totalOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
      },
    });
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.update({ where: { id }, data });
  }

  async updateStatus(tenantId: string, id: string, status: CustomerStatus) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.update({ where: { id }, data: { status } });
  }

  async delete(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customer.delete({ where: { id } });
  }

  async updateOrderStats(tenantId: string, id: string, orderTotal: number) {
    const prisma = await this.db.withTenant(tenantId);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return null;

    const newTotalOrders = customer.totalOrders + 1;
    const newTotalSpent = customer.totalSpent + orderTotal;
    const newAverage = newTotalSpent / newTotalOrders;

    return prisma.customer.update({
      where: { id },
      data: {
        totalOrders: newTotalOrders,
        totalSpent: newTotalSpent,
        averageOrderValue: newAverage,
        lastOrderAt: new Date(),
        firstOrderAt: customer.firstOrderAt || new Date(),
      },
    });
  }

  // Addresses
  async getAddresses(tenantId: string, customerId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async addAddress(tenantId: string, customerId: string, data: {
    street: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    phone?: string;
    label?: string;
    isDefault?: boolean;
  }) {
    const prisma = await this.db.withTenant(tenantId);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    return prisma.customerAddress.create({
      data: {
        tenantId,
        customerId,
        ...data,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async updateAddress(tenantId: string, addressId: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customerAddress.update({ where: { id: addressId }, data });
  }

  async deleteAddress(tenantId: string, addressId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.customerAddress.delete({ where: { id: addressId } });
  }

  async setDefaultAddress(tenantId: string, customerId: string, addressId: string) {
    const prisma = await this.db.withTenant(tenantId);

    await prisma.customerAddress.updateMany({
      where: { customerId },
      data: { isDefault: false },
    });

    return prisma.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }

  // Blocks
  async getBlocks(tenantId: string, storeId: string, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;

    const [items, total] = await Promise.all([
      prisma.customerBlock.findMany({
        where: { storeId },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          blockedByUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerBlock.count({ where: { storeId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createBlock(tenantId: string, storeId: string, data: {
    customerId?: string;
    blockType: BlockType;
    value: string;
    reason?: string;
    expiresAt?: Date;
    isPermanent?: boolean;
    blockedBy: string;
  }) {
    const prisma = await this.db.withTenant(tenantId);

    // If blocking a customer, update their status
    if (data.customerId) {
      await prisma.customer.update({
        where: { id: data.customerId },
        data: { status: 'blocked' },
      });
    }

    return prisma.customerBlock.create({
      data: {
        tenantId,
        storeId,
        customerId: data.customerId,
        blockType: data.blockType,
        value: data.value,
        reason: data.reason,
        expiresAt: data.expiresAt,
        isPermanent: data.isPermanent ?? false,
        blockedBy: data.blockedBy,
      },
    });
  }

  async deleteBlock(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    const block = await prisma.customerBlock.findUnique({ where: { id } });

    // If unblocking a customer, update their status
    if (block?.customerId) {
      // Check if there are other active blocks
      const otherBlocks = await prisma.customerBlock.count({
        where: { customerId: block.customerId, id: { not: id } },
      });
      if (otherBlocks === 0) {
        await prisma.customer.update({
          where: { id: block.customerId },
          data: { status: 'active' },
        });
      }
    }

    return prisma.customerBlock.delete({ where: { id } });
  }

  async isBlocked(tenantId: string, storeId: string, phone: string, email?: string, ip?: string): Promise<{
    blocked: boolean;
    reason?: string;
    blockType?: BlockType;
  }> {
    const prisma = await this.db.withTenant(tenantId);
    const now = new Date();

    const conditions: Array<Record<string, unknown>> = [
      { blockType: 'phone', value: phone },
    ];
    if (email) conditions.push({ blockType: 'email', value: email });
    if (ip) conditions.push({ blockType: 'ip', value: ip });

    const block = await prisma.customerBlock.findFirst({
      where: {
        storeId,
        OR: conditions,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
          { isPermanent: true },
        ],
      },
    });

    if (block) {
      return { blocked: true, reason: block.reason || undefined, blockType: block.blockType as BlockType };
    }

    return { blocked: false };
  }

  // Statistics
  async getStatistics(tenantId: string, storeId: string, dateFrom?: Date, dateTo?: Date) {
    const prisma = await this.db.withTenant(tenantId);
    const where: Record<string, unknown> = { storeId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = dateFrom;
      if (dateTo) (where.createdAt as Record<string, Date>).lte = dateTo;
    }

    const [
      totalCustomers,
      newCustomers,
      repeatCustomers,
      totalRevenue,
      averageOrderValue,
      blockedCustomers,
      ipBlocks,
      phoneBlocks,
      permanentBlocks,
    ] = await Promise.all([
      prisma.customer.count({ where: { storeId } }),
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { storeId, totalOrders: { gte: 2 } } }),
      prisma.customer.aggregate({ where: { storeId }, _sum: { totalSpent: true } }),
      prisma.customer.aggregate({ where: { storeId }, _avg: { averageOrderValue: true } }),
      prisma.customer.count({ where: { storeId, status: 'blocked' } }),
      prisma.customerBlock.count({ where: { storeId, blockType: 'ip' } }),
      prisma.customerBlock.count({ where: { storeId, blockType: 'phone' } }),
      prisma.customerBlock.count({ where: { storeId, isPermanent: true } }),
    ]);

    return {
      totalCustomers,
      newCustomers,
      repeatCustomers,
      repeatRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
      totalRevenue: { amount: totalRevenue._sum.totalSpent || 0, currency: 'TND' },
      averageOrderValue: { amount: averageOrderValue._avg.averageOrderValue || 0, currency: 'TND' },
      blockedCustomers,
      ipBlocks,
      phoneBlocks,
      permanentBlocks,
    };
  }

  // Order history
  async getOrderHistory(tenantId: string, customerId: string, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;

    const [orders, total, customer] = await Promise.all([
      prisma.order.findMany({
        where: { customerId },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: { customerId } }),
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { totalOrders: true, totalSpent: true },
      }),
    ]);

    return {
      customerId,
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: o.totalAmount,
        status: o.status,
        createdAt: o.createdAt,
      })),
      totalOrders: customer?.totalOrders || total,
      totalSpent: customer?.totalSpent || 0,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Top customers
  async getTopCustomers(tenantId: string, storeId: string, limit = 10) {
    const prisma = await this.db.withTenant(tenantId);
    const customers = await prisma.customer.findMany({
      where: { storeId, totalOrders: { gt: 0 } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        totalOrders: true,
        totalSpent: true,
        averageOrderValue: true,
      },
      orderBy: { totalSpent: 'desc' },
      take: limit,
    });

    return customers.map(c => ({
      ...c,
      fullName: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone,
    }));
  }
}
