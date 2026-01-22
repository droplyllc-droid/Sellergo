/**
 * Orders Service
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { OrdersRepository, OrderFilter, PaginationOptions } from './orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { QueueService } from '../../core/queue/queue.service';
import { RedisService } from '../../core/redis/redis.service';
import { ErrorCode, OrderStatus, PaymentStatus, FulfillmentStatus } from '@sellergo/types';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
  ) {}

  async getOrder(tenantId: string, orderId: string) {
    const order = await this.ordersRepository.findById(tenantId, orderId);
    if (!order) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Order not found' });
    return order;
  }

  async getOrderByNumber(tenantId: string, storeId: string, orderNumber: string) {
    const order = await this.ordersRepository.findByOrderNumber(tenantId, storeId, orderNumber);
    if (!order) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Order not found' });
    return order;
  }

  async getOrders(tenantId: string, storeId: string, filter: OrderFilter, pagination: PaginationOptions) {
    return this.ordersRepository.findMany(tenantId, storeId, filter, pagination);
  }

  async updateOrderStatus(tenantId: string, orderId: string, status: OrderStatus, note?: string, userId?: string) {
    const order = await this.getOrder(tenantId, orderId);

    // Validate status transition
    this.validateStatusTransition(order.status as OrderStatus, status);

    await this.ordersRepository.updateStatus(tenantId, orderId, status);

    // Add timeline event
    await this.ordersRepository.addTimelineEvent(tenantId, orderId, {
      type: 'status_change',
      title: `Status changed to ${status}`,
      description: note,
      metadata: { previousStatus: order.status, newStatus: status, changedBy: userId },
    });

    // Queue notifications
    await this.queueService.addJob('notification', 'order-status-change', {
      orderId,
      status,
      customerEmail: order.customerEmail,
    });

    return this.getOrder(tenantId, orderId);
  }

  async confirmOrder(tenantId: string, orderId: string, userId?: string) {
    return this.updateOrderStatus(tenantId, orderId, OrderStatus.CONFIRMED, 'Order confirmed', userId);
  }

  async markAsPreparing(tenantId: string, orderId: string, userId?: string) {
    return this.updateOrderStatus(tenantId, orderId, OrderStatus.PROCESSING, 'Order is being prepared', userId);
  }

  async shipOrder(tenantId: string, orderId: string, trackingNumber?: string, carrier?: string, userId?: string) {
    const order = await this.getOrder(tenantId, orderId);

    await this.ordersRepository.update(tenantId, orderId, {
      status: OrderStatus.SHIPPED,
      fulfillmentStatus: FulfillmentStatus.PARTIALLY_FULFILLED,
      shippedAt: new Date(),
      trackingNumber,
      carrier,
    });

    await this.ordersRepository.addTimelineEvent(tenantId, orderId, {
      type: 'shipped',
      title: 'Order shipped',
      description: trackingNumber ? `Tracking: ${trackingNumber}` : undefined,
      metadata: { trackingNumber, carrier, shippedBy: userId },
    });

    await this.queueService.addJob('notification', 'order-shipped', {
      orderId,
      customerEmail: order.customerEmail,
      trackingNumber,
      carrier,
    });

    return this.getOrder(tenantId, orderId);
  }

  async markAsDelivered(tenantId: string, orderId: string, userId?: string) {
    const order = await this.getOrder(tenantId, orderId);

    await this.ordersRepository.update(tenantId, orderId, {
      status: OrderStatus.DELIVERED,
      fulfillmentStatus: FulfillmentStatus.FULFILLED,
      deliveredAt: new Date(),
    });

    await this.ordersRepository.addTimelineEvent(tenantId, orderId, {
      type: 'delivered',
      title: 'Order delivered',
      metadata: { markedBy: userId },
    });

    // Process COD payment if applicable
    if (order.paymentStatus === 'unpaid') {
      await this.markAsPaid(tenantId, orderId, 'cod', userId);
    }

    return this.getOrder(tenantId, orderId);
  }

  async cancelOrder(tenantId: string, orderId: string, reason: string, userId?: string) {
    const order = await this.getOrder(tenantId, orderId);

    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Cannot cancel a delivered or already cancelled order',
      });
    }

    await this.ordersRepository.update(tenantId, orderId, {
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason,
    });

    await this.ordersRepository.addTimelineEvent(tenantId, orderId, {
      type: 'cancelled',
      title: 'Order cancelled',
      description: reason,
      metadata: { cancelledBy: userId },
    });

    // Restore inventory
    await this.queueService.addJob('inventory', 'restore', {
      orderId,
      items: order.items,
    });

    return this.getOrder(tenantId, orderId);
  }

  async markAsPaid(tenantId: string, orderId: string, paymentMethod: string, userId?: string) {
    await this.ordersRepository.updatePaymentStatus(tenantId, orderId, PaymentStatus.PAID);

    await this.ordersRepository.addTimelineEvent(tenantId, orderId, {
      type: 'payment',
      title: 'Payment received',
      metadata: { paymentMethod, markedBy: userId },
    });

    return this.getOrder(tenantId, orderId);
  }

  async addNote(tenantId: string, orderId: string, note: string, userId: string) {
    await this.ordersRepository.addTimelineEvent(tenantId, orderId, {
      type: 'note',
      title: 'Note added',
      description: note,
      metadata: { addedBy: userId },
    });
    return this.getOrder(tenantId, orderId);
  }

  async getStatistics(tenantId: string, storeId: string, dateFrom?: Date, dateTo?: Date) {
    return this.ordersRepository.getStatistics(tenantId, storeId, dateFrom, dateTo);
  }

  async getOrdersByStatus(tenantId: string, storeId: string) {
    return this.ordersRepository.getOrdersByStatus(tenantId, storeId);
  }

  // Abandoned Carts
  async getAbandonedCarts(tenantId: string, storeId: string, pagination: PaginationOptions) {
    return this.ordersRepository.getAbandonedCarts(tenantId, storeId, pagination);
  }

  async sendCartRecoveryEmail(tenantId: string, cartId: string) {
    const carts = await this.ordersRepository.getAbandonedCarts(tenantId, '', { page: 1, limit: 1 });
    const cart = carts.items.find((c: { id: string; email?: string; items: unknown[] }) => c.id === cartId);

    if (!cart || !cart.email) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Cart not found or no email available',
      });
    }

    await this.queueService.addJob('notification', 'cart-recovery', {
      cartId,
      email: cart.email,
      items: cart.items,
    });

    await this.ordersRepository.updateAbandonedCart(tenantId, cartId, {
      lastReminderSentAt: new Date(),
      reminderCount: { increment: 1 },
    });

    return { success: true };
  }

  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.RETURNED],
      [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
      [OrderStatus.DELIVERED]: [OrderStatus.RETURNED, OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUNDED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Cannot transition from ${currentStatus} to ${newStatus}`,
      });
    }
  }
}
