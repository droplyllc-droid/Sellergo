/**
 * Checkout Service
 * Handles public checkout flow for storefronts
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersRepository } from './orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { QueueService } from '../../core/queue/queue.service';
import { RedisService } from '../../core/redis/redis.service';
import { ErrorCode } from '@sellergo/types';
import { CheckoutDto } from './dto';

interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  name: string;
  sku?: string;
  options?: Record<string, string>;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async processCheckout(tenantId: string, storeId: string, dto: CheckoutDto) {
    // Validate and calculate cart
    const { items, subtotal, shippingCost, discount, total, currency } = await this.validateAndCalculateCart(
      tenantId,
      storeId,
      dto.items,
      dto.couponCode,
    );

    // Generate order number
    const orderNumber = await this.ordersRepository.generateOrderNumber(storeId);

    // Find or create customer
    const customerId = await this.findOrCreateCustomer(tenantId, storeId, dto.customer);

    // Create order
    const order = await this.ordersRepository.create(tenantId, storeId, {
      orderNumber,
      customerId,
      customerEmail: dto.customer.email,
      customerPhone: dto.customer.phone,
      customerFirstName: dto.customer.firstName,
      customerLastName: dto.customer.lastName,
      shippingAddress: dto.shippingAddress,
      items,
      subtotal,
      shippingCost,
      discount,
      totalAmount: total,
      currency,
      notes: dto.notes,
      source: 'storefront',
    });

    // Deduct inventory
    await this.deductInventory(tenantId, items);

    // Mark abandoned cart as recovered if session provided
    if (dto.sessionId) {
      await this.recoverAbandonedCart(tenantId, dto.sessionId);
    }

    // Queue notifications
    await this.queueService.addJob('notification', 'order-created', {
      orderId: order.id,
      orderNumber,
      customerEmail: dto.customer.email,
      customerName: `${dto.customer.firstName} ${dto.customer.lastName}`,
      total,
      currency,
    });

    // Queue admin notification
    await this.queueService.addJob('notification', 'new-order-admin', {
      orderId: order.id,
      orderNumber,
      storeId,
      total,
    });

    // Queue analytics event
    await this.queueService.addJob('analytics', 'purchase', {
      storeId,
      orderId: order.id,
      revenue: total,
      items: items.length,
    });

    return {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.totalAmount,
        currency: order.currency,
        status: order.status,
      },
    };
  }

  async calculateCart(tenantId: string, storeId: string, items: CheckoutDto['items'], couponCode?: string) {
    return this.validateAndCalculateCart(tenantId, storeId, items, couponCode);
  }

  async saveAbandonedCart(tenantId: string, storeId: string, sessionId: string, items: CheckoutDto['items'], email?: string, phone?: string) {
    const cartItems = await Promise.all(
      items.map(async (item) => {
        const product = await this.productsRepository.findById(tenantId, item.productId);
        if (!product) return null;
        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: product.price,
        };
      }),
    );

    const validItems = cartItems.filter(Boolean) as Array<{ productId: string; variantId?: string; quantity: number; price: number }>;
    const totalValue = validItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return this.ordersRepository.createAbandonedCart(tenantId, storeId, {
      sessionId,
      email,
      phone,
      items: validItems,
      totalValue,
    });
  }

  private async validateAndCalculateCart(tenantId: string, storeId: string, items: CheckoutDto['items'], couponCode?: string) {
    const cartItems: CartItem[] = [];
    let subtotal = 0;
    let currency = 'TND';

    for (const item of items) {
      const product = await this.productsRepository.findById(tenantId, item.productId);

      if (!product) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: `Product not found: ${item.productId}`,
        });
      }

      if (product.status !== 'active') {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: `Product is not available: ${product.name}`,
        });
      }

      // Get price (check quantity offers)
      let unitPrice = product.price;
      if (item.quantityOfferIndex !== undefined && product.quantityOffers?.[item.quantityOfferIndex]) {
        const offer = product.quantityOffers[item.quantityOfferIndex] as { quantity: number; price: number };
        if (item.quantity >= offer.quantity) {
          unitPrice = offer.price;
        }
      }

      // Check variant
      let variant = null;
      let options: Record<string, string> = {};
      if (item.variantId) {
        variant = product.variants?.find(v => v.id === item.variantId);
        if (variant) {
          unitPrice = variant.price;
          options = variant.options as Record<string, string>;
        }
      }

      // Check inventory
      const availableQuantity = variant?.quantity ?? product.quantity;
      if (product.trackQuantity && item.quantity > availableQuantity) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_ERROR,
          message: `Insufficient stock for: ${product.name}`,
        });
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      cartItems.push({
        productId: product.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        name: product.name,
        sku: variant?.sku ?? product.sku,
        options,
      });

      // Add upsells
      if (item.upsellIds?.length && product.upsells) {
        for (const upsellId of item.upsellIds) {
          const upsell = (product.upsells as Array<{ id: string; name: string; price: number; isActive: boolean }>).find(u => u.id === upsellId);
          if (upsell && upsell.isActive) {
            subtotal += upsell.price;
            cartItems.push({
              productId: product.id,
              variantId: undefined,
              quantity: 1,
              unitPrice: upsell.price,
              totalPrice: upsell.price,
              name: `${product.name} - ${upsell.name}`,
              options: { upsell: 'true' },
            });
          }
        }
      }
    }

    // Calculate shipping
    const shippingCost = await this.calculateShipping(cartItems);

    // Apply coupon discount
    let discount = 0;
    if (couponCode) {
      discount = await this.applyCoupon(tenantId, storeId, couponCode, subtotal);
    }

    const total = subtotal + shippingCost - discount;

    return {
      items: cartItems,
      subtotal,
      shippingCost,
      discount,
      total,
      currency,
    };
  }

  private async calculateShipping(items: CartItem[]): Promise<number> {
    // Simplified shipping calculation
    // In production, this would integrate with shipping carriers
    return 7; // Default 7 TND shipping
  }

  private async applyCoupon(tenantId: string, storeId: string, code: string, subtotal: number): Promise<number> {
    // TODO: Implement coupon validation
    return 0;
  }

  private async findOrCreateCustomer(tenantId: string, storeId: string, customer: CheckoutDto['customer']): Promise<string | undefined> {
    // TODO: Implement customer lookup/creation
    return undefined;
  }

  private async deductInventory(tenantId: string, items: CartItem[]): Promise<void> {
    for (const item of items) {
      if (item.variantId) {
        await this.productsRepository.updateVariant(tenantId, item.variantId, {
          quantity: { decrement: item.quantity },
        });
      } else {
        await this.productsRepository.updateInventory(tenantId, item.productId, -item.quantity);
      }
    }
  }

  private async recoverAbandonedCart(tenantId: string, sessionId: string): Promise<void> {
    try {
      // Find cart by session and mark as recovered
      const carts = await this.ordersRepository.getAbandonedCarts(tenantId, '', { page: 1, limit: 100 });
      const cart = carts.items.find(c => c.sessionId === sessionId);
      if (cart) {
        await this.ordersRepository.recoverAbandonedCart(tenantId, cart.id);
      }
    } catch (error) {
      this.logger.warn(`Failed to recover abandoned cart: ${error}`);
    }
  }
}
