/**
 * Categories Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
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
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@ApiTags('Categories')
@Controller('stores/:storeId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get categories' })
  async getCategories(@Param('storeId') storeId: string) {
    return this.categoriesService.getCategories('', storeId);
  }

  @Get('tree')
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get category tree' })
  async getCategoryTree(@Param('storeId') storeId: string) {
    return this.categoriesService.getCategoryTree('', storeId);
  }

  @Get(':categoryId')
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get category by ID' })
  async getCategory(@Param('categoryId') categoryId: string) {
    return this.categoriesService.getCategory('', categoryId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create category' })
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.createCategory(user.tenantId, storeId, dto);
  }

  @Patch(':categoryId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category' })
  async updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(user.tenantId, categoryId, dto);
  }

  @Delete(':categoryId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_DELETE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete category' })
  async deleteCategory(@CurrentUser() user: AuthenticatedUser, @Param('categoryId') categoryId: string) {
    await this.categoriesService.deleteCategory(user.tenantId, categoryId);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder categories' })
  async reorderCategories(@CurrentUser() user: AuthenticatedUser, @Body() body: { categoryIds: string[] }) {
    return this.categoriesService.reorderCategories(user.tenantId, body.categoryIds);
  }
}
