/**
 * Reviews Controller
 */

import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SkipStoreCheck } from '../auth/decorators/skip-store-check.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission } from '@sellergo/types';
import { CreateReviewDto } from './dto';

@ApiTags('Product Reviews')
@Controller('stores/:storeId/products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get product reviews (public)' })
  async getReviews(
    @Param('productId') productId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getReviews('', productId, page || 1, limit || 10);
  }

  @Post()
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Submit review (public)' })
  async createReview(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview('', storeId, productId, dto);
  }

  @Post(':reviewId/approve')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve review' })
  async approveReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviewsService.approveReview(user.tenantId, reviewId, productId);
  }

  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete review' })
  async deleteReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Param('reviewId') reviewId: string,
  ) {
    await this.reviewsService.deleteReview(user.tenantId, reviewId, productId);
  }
}
