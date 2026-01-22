/**
 * Checkout Controller
 * Public endpoints for storefront checkout
 */

import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { Public } from '../auth/decorators/public.decorator';
import { SkipStoreCheck } from '../auth/decorators/skip-store-check.decorator';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';
import { CheckoutDto, CheckoutItemDto } from './dto';

@ApiTags('Checkout')
@Controller('stores/:storeId/checkout')
@Public()
@SkipStoreCheck()
@SkipTenantCheck()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Process checkout and create order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async checkout(@Param('storeId') storeId: string, @Body() dto: CheckoutDto) {
    // For public checkout, tenantId will be resolved from store
    return this.checkoutService.processCheckout('', storeId, dto);
  }

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate cart total' })
  @ApiResponse({ status: 200, description: 'Cart calculation' })
  async calculateCart(
    @Param('storeId') storeId: string,
    @Body() body: { items: CheckoutItemDto[]; couponCode?: string },
  ) {
    return this.checkoutService.calculateCart('', storeId, body.items, body.couponCode);
  }

  @Post('abandoned-cart')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save abandoned cart' })
  @ApiResponse({ status: 201, description: 'Cart saved' })
  async saveAbandonedCart(
    @Param('storeId') storeId: string,
    @Body() body: { sessionId: string; items: CheckoutItemDto[]; email?: string; phone?: string },
  ) {
    return this.checkoutService.saveAbandonedCart('', storeId, body.sessionId, body.items, body.email, body.phone);
  }
}
