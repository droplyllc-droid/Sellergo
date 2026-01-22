/**
 * Orders Controller
 */

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission } from '@sellergo/types';
import { OrderFilterDto, UpdateOrderStatusDto, ShipOrderDto, CancelOrderDto, AddNoteDto } from './dto';

@ApiTags('Orders')
@Controller('stores/:storeId/orders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: 'Get orders' })
  async getOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: OrderFilterDto,
  ) {
    const { page, limit, sortBy, sortOrder, dateFrom, dateTo, ...filter } = query;
    return this.ordersService.getOrders(
      user.tenantId,
      storeId,
      { ...filter, dateFrom: dateFrom ? new Date(dateFrom) : undefined, dateTo: dateTo ? new Date(dateTo) : undefined },
      { page: page!, limit: limit!, sortBy, sortOrder },
    );
  }

  @Get('statistics')
  @RequirePermissions(Permission.ANALYTICS_READ)
  @ApiOperation({ summary: 'Get order statistics' })
  async getStatistics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.ordersService.getStatistics(
      user.tenantId,
      storeId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get('by-status')
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: 'Get orders count by status' })
  async getOrdersByStatus(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string) {
    return this.ordersService.getOrdersByStatus(user.tenantId, storeId);
  }

  @Get(':orderId')
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.ordersService.getOrder(user.tenantId, orderId);
  }

  @Get('number/:orderNumber')
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: 'Get order by number' })
  async getOrderByNumber(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.ordersService.getOrderByNumber(user.tenantId, storeId, orderNumber);
  }

  @Patch(':orderId/status')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @ApiOperation({ summary: 'Update order status' })
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(user.tenantId, orderId, dto.status, dto.note, user.id);
  }

  @Post(':orderId/confirm')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm order' })
  async confirmOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.ordersService.confirmOrder(user.tenantId, orderId, user.id);
  }

  @Post(':orderId/prepare')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark as preparing' })
  async markAsPreparing(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.ordersService.markAsPreparing(user.tenantId, orderId, user.id);
  }

  @Post(':orderId/ship')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ship order' })
  async shipOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: ShipOrderDto,
  ) {
    return this.ordersService.shipOrder(user.tenantId, orderId, dto.trackingNumber, dto.carrier, user.id);
  }

  @Post(':orderId/deliver')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark as delivered' })
  async markAsDelivered(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.ordersService.markAsDelivered(user.tenantId, orderId, user.id);
  }

  @Post(':orderId/cancel')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order' })
  async cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.tenantId, orderId, dto.reason, user.id);
  }

  @Post(':orderId/paid')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark as paid' })
  async markAsPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() body: { paymentMethod: string },
  ) {
    return this.ordersService.markAsPaid(user.tenantId, orderId, body.paymentMethod, user.id);
  }

  @Post(':orderId/notes')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @ApiOperation({ summary: 'Add note to order' })
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.ordersService.addNote(user.tenantId, orderId, dto.note, user.id);
  }

  // Abandoned Carts
  @Get('abandoned-carts')
  @RequirePermissions(Permission.ORDER_READ)
  @ApiOperation({ summary: 'Get abandoned carts' })
  async getAbandonedCarts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.getAbandonedCarts(user.tenantId, storeId, { page: page || 1, limit: limit || 20 });
  }

  @Post('abandoned-carts/:cartId/recover')
  @RequirePermissions(Permission.ORDER_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send cart recovery email' })
  async sendCartRecoveryEmail(@CurrentUser() user: AuthenticatedUser, @Param('cartId') cartId: string) {
    return this.ordersService.sendCartRecoveryEmail(user.tenantId, cartId);
  }
}
