/**
 * Products Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
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
import {
  CreateProductDto, UpdateProductDto, ProductFilterDto,
  BulkStatusDto, BulkActionDto, UpdateInventoryDto,
  ReorderImagesDto, QuantityOfferDto, UpsellDto,
} from './dto';

@ApiTags('Products')
@Controller('stores/:storeId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get products' })
  async getProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: ProductFilterDto,
  ) {
    const { page, limit, sortBy, sortOrder, ...filter } = query;
    return this.productsService.getProducts(user.tenantId, storeId, filter, { page: page!, limit: limit!, sortBy, sortOrder });
  }

  @Get('public')
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get public products (storefront)' })
  async getPublicProducts(@Param('storeId') storeId: string, @Query() query: ProductFilterDto) {
    const { page, limit, sortBy, sortOrder, ...filter } = query;
    return this.productsService.getProducts('', storeId, { ...filter, status: 'active' as any }, { page: page!, limit: limit!, sortBy, sortOrder });
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product statistics' })
  async getStatistics(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string) {
    return this.productsService.getStatistics(user.tenantId, storeId);
  }

  @Get(':productId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get product by ID' })
  async getProduct(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.productsService.getProduct(user.tenantId, productId);
  }

  @Get('by-slug/:slug')
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get product by slug (public)' })
  async getProductBySlug(@Param('storeId') storeId: string, @Param('slug') slug: string) {
    return this.productsService.getProductBySlug('', storeId, slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product' })
  async createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.createProduct(user.tenantId, storeId, dto);
  }

  @Patch(':productId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product' })
  async updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(user.tenantId, productId, dto);
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product' })
  async deleteProduct(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    await this.productsService.deleteProduct(user.tenantId, productId);
  }

  @Post('bulk/status')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk update product status' })
  async bulkUpdateStatus(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkStatusDto) {
    return this.productsService.bulkUpdateStatus(user.tenantId, dto.productIds, dto.status);
  }

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk delete products' })
  async bulkDelete(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkActionDto) {
    await this.productsService.bulkDelete(user.tenantId, dto.productIds);
  }

  @Patch(':productId/inventory')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product inventory' })
  async updateInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.productsService.updateInventory(user.tenantId, productId, dto.quantity);
  }

  // Images
  @Post(':productId/images')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add product image' })
  async addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() body: { url: string; alt?: string },
  ) {
    return this.productsService.addImage(user.tenantId, productId, body.url, body.alt);
  }

  @Patch(':productId/images/reorder')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder product images' })
  async reorderImages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.productsService.reorderImages(user.tenantId, productId, dto.imageIds);
  }

  @Patch(':productId/featured-image')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set featured image' })
  async setFeaturedImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() body: { imageIndex: number },
  ) {
    return this.productsService.setFeaturedImage(user.tenantId, productId, body.imageIndex);
  }

  @Delete(':productId/images/:imageId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete product image' })
  async deleteImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    await this.productsService.deleteImage(user.tenantId, productId, imageId);
  }

  // Quantity Offers
  @Put(':productId/quantity-offers')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update quantity offers' })
  async updateQuantityOffers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() offers: QuantityOfferDto[],
  ) {
    return this.productsService.updateQuantityOffers(user.tenantId, productId, offers);
  }

  // Upsells
  @Put(':productId/upsells')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update upsells' })
  async updateUpsells(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() upsells: UpsellDto[],
  ) {
    return this.productsService.updateUpsells(user.tenantId, productId, upsells);
  }
}

// Add Put decorator import
import { Put } from '@nestjs/common';
