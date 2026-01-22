/**
 * Products Module
 */

import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { VariantsService } from './variants.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ProductsController, CategoriesController, ReviewsController],
  providers: [
    ProductsService,
    ProductsRepository,
    CategoriesService,
    VariantsService,
    ReviewsService,
  ],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
