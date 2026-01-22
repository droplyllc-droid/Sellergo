/**
 * Customers Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission } from '@sellergo/types';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  BlockCustomerDto,
  CustomerFilterDto,
  BlocksFilterDto,
  AddAddressDto,
  UpdateAddressDto,
} from './dto';

@ApiTags('Customers')
@Controller('stores/:storeId/customers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get customers' })
  async getCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: CustomerFilterDto,
  ) {
    const { page, limit, sortBy, sortOrder, dateFrom, dateTo, ...filter } = query;
    return this.customersService.getCustomers(
      user.tenantId,
      storeId,
      { ...filter, dateFrom: dateFrom ? new Date(dateFrom) : undefined, dateTo: dateTo ? new Date(dateTo) : undefined },
      { page: page!, limit: limit!, sortBy, sortOrder },
    );
  }

  @Get('statistics')
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get customer statistics' })
  async getStatistics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.customersService.getStatistics(
      user.tenantId,
      storeId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('top')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get top customers by spending' })
  async getTopCustomers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.getTopCustomers(user.tenantId, storeId, limit || 10);
  }

  @Get('blocks')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get blocked customers and values' })
  async getBlocks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: BlocksFilterDto,
  ) {
    return this.customersService.getBlocks(user.tenantId, storeId, { page: query.page!, limit: query.limit! });
  }

  @Post('blocks')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Block customer, phone, email, or IP' })
  @ApiResponse({ status: 201, description: 'Block created' })
  async blockCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: BlockCustomerDto,
  ) {
    return this.customersService.blockCustomer(user.tenantId, storeId, dto, user.id);
  }

  @Delete('blocks/:blockId')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove block' })
  async unblockCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('blockId') blockId: string,
  ) {
    return this.customersService.unblockCustomer(user.tenantId, blockId, storeId);
  }

  @Get(':customerId')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.getCustomer(user.tenantId, customerId);
  }

  @Post()
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Create customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  async createCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createCustomer(user.tenantId, storeId, dto);
  }

  @Patch(':customerId')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Update customer' })
  async updateCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(user.tenantId, customerId, dto);
  }

  @Delete(':customerId')
  @RequirePermissions(Permission.CUSTOMER_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete customer' })
  async deleteCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.deleteCustomer(user.tenantId, customerId);
  }

  // Order History
  @Get(':customerId/orders')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get customer order history' })
  async getOrderHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.getOrderHistory(user.tenantId, customerId, { page: page || 1, limit: limit || 20 });
  }

  // Addresses
  @Get(':customerId/addresses')
  @RequirePermissions(Permission.CUSTOMER_READ)
  @ApiOperation({ summary: 'Get customer addresses' })
  async getAddresses(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.getAddresses(user.tenantId, customerId);
  }

  @Post(':customerId/addresses')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Add address to customer' })
  @ApiResponse({ status: 201, description: 'Address added' })
  async addAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() dto: AddAddressDto,
  ) {
    return this.customersService.addAddress(user.tenantId, customerId, dto);
  }

  @Patch(':customerId/addresses/:addressId')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @ApiOperation({ summary: 'Update address' })
  async updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customersService.updateAddress(user.tenantId, customerId, addressId, dto);
  }

  @Delete(':customerId/addresses/:addressId')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete address' })
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.customersService.deleteAddress(user.tenantId, customerId, addressId);
  }

  @Post(':customerId/addresses/:addressId/default')
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set default address' })
  async setDefaultAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.customersService.setDefaultAddress(user.tenantId, customerId, addressId);
  }
}
