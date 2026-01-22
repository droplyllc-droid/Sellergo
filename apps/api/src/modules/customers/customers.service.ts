/**
 * Customers Service
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CustomersRepository, CustomerFilter, PaginationOptions } from './customers.repository';
import { RedisService } from '../../core/redis/redis.service';
import { ErrorCode, CustomerStatus, BlockType } from '@sellergo/types';
import { CreateCustomerDto, UpdateCustomerDto, BlockCustomerDto, AddAddressDto, UpdateAddressDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly redisService: RedisService,
  ) {}

  async getCustomers(tenantId: string, storeId: string, filter: CustomerFilter, pagination: PaginationOptions) {
    return this.customersRepository.findMany(tenantId, storeId, filter, pagination);
  }

  async getCustomer(tenantId: string, customerId: string) {
    const customer = await this.customersRepository.findById(tenantId, customerId);
    if (!customer) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Customer not found' });
    }
    return {
      ...customer,
      fullName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.phone,
    };
  }

  async createCustomer(tenantId: string, storeId: string, dto: CreateCustomerDto) {
    // Check for existing customer with same phone
    const existingByPhone = await this.customersRepository.findByPhone(tenantId, storeId, dto.phone);
    if (existingByPhone) {
      throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Customer with this phone already exists' });
    }

    // Check for existing customer with same email
    if (dto.email) {
      const existingByEmail = await this.customersRepository.findByEmail(tenantId, storeId, dto.email);
      if (existingByEmail) {
        throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Customer with this email already exists' });
      }
    }

    // Check if phone or email is blocked
    const blockCheck = await this.customersRepository.isBlocked(tenantId, storeId, dto.phone, dto.email);
    if (blockCheck.blocked) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `This ${blockCheck.blockType} is blocked: ${blockCheck.reason || 'No reason provided'}`,
      });
    }

    const customer = await this.customersRepository.create(tenantId, storeId, dto);

    // Add address if provided
    if (dto.address) {
      await this.customersRepository.addAddress(tenantId, customer.id, {
        ...dto.address,
        isDefault: true,
      });
    }

    // Invalidate cache
    await this.invalidateCache(tenantId, storeId);

    return this.getCustomer(tenantId, customer.id);
  }

  async updateCustomer(tenantId: string, customerId: string, dto: UpdateCustomerDto) {
    const customer = await this.getCustomer(tenantId, customerId);

    // Check for conflicts if phone/email is being changed
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.customersRepository.findByPhone(tenantId, customer.storeId, dto.phone);
      if (existing && existing.id !== customerId) {
        throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Phone already in use' });
      }
    }

    if (dto.email && dto.email !== customer.email) {
      const existing = await this.customersRepository.findByEmail(tenantId, customer.storeId, dto.email);
      if (existing && existing.id !== customerId) {
        throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Email already in use' });
      }
    }

    const updated = await this.customersRepository.update(tenantId, customerId, { ...dto });
    await this.invalidateCache(tenantId, customer.storeId);

    return this.getCustomer(tenantId, customerId);
  }

  async deleteCustomer(tenantId: string, customerId: string) {
    const customer = await this.getCustomer(tenantId, customerId);
    await this.customersRepository.delete(tenantId, customerId);
    await this.invalidateCache(tenantId, customer.storeId);
    return { success: true };
  }

  // Addresses
  async getAddresses(tenantId: string, customerId: string) {
    await this.getCustomer(tenantId, customerId);
    return this.customersRepository.getAddresses(tenantId, customerId);
  }

  async addAddress(tenantId: string, customerId: string, dto: AddAddressDto) {
    const customer = await this.getCustomer(tenantId, customerId);
    return this.customersRepository.addAddress(tenantId, customerId, dto);
  }

  async updateAddress(tenantId: string, customerId: string, addressId: string, dto: UpdateAddressDto) {
    await this.getCustomer(tenantId, customerId);
    return this.customersRepository.updateAddress(tenantId, addressId, { ...dto });
  }

  async deleteAddress(tenantId: string, customerId: string, addressId: string) {
    await this.getCustomer(tenantId, customerId);
    await this.customersRepository.deleteAddress(tenantId, addressId);
    return { success: true };
  }

  async setDefaultAddress(tenantId: string, customerId: string, addressId: string) {
    await this.getCustomer(tenantId, customerId);
    return this.customersRepository.setDefaultAddress(tenantId, customerId, addressId);
  }

  // Blocks
  async getBlocks(tenantId: string, storeId: string, pagination: PaginationOptions) {
    return this.customersRepository.getBlocks(tenantId, storeId, pagination);
  }

  async blockCustomer(tenantId: string, storeId: string, dto: BlockCustomerDto, userId: string) {
    // Validate block type and value
    if (dto.blockType === BlockType.PHONE && !dto.value.match(/^\+?[0-9]{8,15}$/)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid phone number format' });
    }
    if (dto.blockType === BlockType.EMAIL && !dto.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid email format' });
    }
    if (dto.blockType === BlockType.IP && !dto.value.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid IP address format' });
    }

    const block = await this.customersRepository.createBlock(tenantId, storeId, {
      ...dto,
      blockedBy: userId,
    });

    await this.invalidateCache(tenantId, storeId);
    return block;
  }

  async unblockCustomer(tenantId: string, blockId: string, storeId: string) {
    await this.customersRepository.deleteBlock(tenantId, blockId);
    await this.invalidateCache(tenantId, storeId);
    return { success: true };
  }

  async checkBlock(tenantId: string, storeId: string, phone: string, email?: string, ip?: string) {
    return this.customersRepository.isBlocked(tenantId, storeId, phone, email, ip);
  }

  // Statistics
  async getStatistics(tenantId: string, storeId: string, dateFrom?: Date, dateTo?: Date) {
    const cacheKey = `customers:stats:${storeId}:${dateFrom?.toISOString() || 'all'}:${dateTo?.toISOString() || 'all'}`;
    const cached = await this.redisService.getJson(cacheKey);
    if (cached) return cached;

    const stats = await this.customersRepository.getStatistics(tenantId, storeId, dateFrom, dateTo);
    await this.redisService.setJson(cacheKey, stats, 300); // 5 minutes

    return stats;
  }

  // Order history
  async getOrderHistory(tenantId: string, customerId: string, pagination: PaginationOptions) {
    await this.getCustomer(tenantId, customerId);
    return this.customersRepository.getOrderHistory(tenantId, customerId, pagination);
  }

  // Top customers
  async getTopCustomers(tenantId: string, storeId: string, limit = 10) {
    const cacheKey = `customers:top:${storeId}:${limit}`;
    const cached = await this.redisService.getJson(cacheKey);
    if (cached) return cached;

    const customers = await this.customersRepository.getTopCustomers(tenantId, storeId, limit);
    await this.redisService.setJson(cacheKey, customers, 600); // 10 minutes

    return customers;
  }

  // Find or create customer (for checkout)
  async findOrCreateCustomer(tenantId: string, storeId: string, data: {
    phone: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }) {
    // Check for blocks first
    const blockCheck = await this.customersRepository.isBlocked(tenantId, storeId, data.phone, data.email);
    if (blockCheck.blocked) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: blockCheck.reason || 'Customer is blocked',
      });
    }

    // Try to find by phone first
    let customer = await this.customersRepository.findByPhone(tenantId, storeId, data.phone);

    // If not found and email provided, try by email
    if (!customer && data.email) {
      customer = await this.customersRepository.findByEmail(tenantId, storeId, data.email);
    }

    // If still not found, create new customer
    if (!customer) {
      customer = await this.customersRepository.create(tenantId, storeId, {
        phone: data.phone,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      await this.invalidateCache(tenantId, storeId);
    }

    return customer;
  }

  // Update customer stats after order
  async updateOrderStats(tenantId: string, customerId: string, orderTotal: number) {
    return this.customersRepository.updateOrderStats(tenantId, customerId, orderTotal);
  }

  private async invalidateCache(tenantId: string, storeId: string) {
    await this.redisService.del(`customers:stats:${storeId}:*`);
    await this.redisService.del(`customers:top:${storeId}:*`);
  }
}
