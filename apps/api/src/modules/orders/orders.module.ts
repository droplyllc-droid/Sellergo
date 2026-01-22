/**
 * Orders Module
 */

import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  controllers: [OrdersController, CheckoutController],
  providers: [OrdersService, OrdersRepository, CheckoutService],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
