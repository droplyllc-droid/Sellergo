/**
 * Billing Module
 */

import { Module } from '@nestjs/common';
import { BillingController, StripeWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRepository } from './billing.repository';

@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, BillingRepository],
  exports: [BillingService],
})
export class BillingModule {}
