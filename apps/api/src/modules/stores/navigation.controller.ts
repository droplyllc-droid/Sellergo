/**
 * Navigation Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NavigationService } from './navigation.service';
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
import { CreateNavigationMenuDto, UpdateNavigationMenuDto } from './dto';

@ApiTags('Store Navigation')
@Controller('stores/:storeId/navigation')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get()
  @Public()
  @SkipStoreCheck()
  @ApiOperation({ summary: 'Get navigation menus (public)' })
  async getNavigationMenus(@Param('storeId') storeId: string) {
    return this.navigationService.getNavigationMenus('', storeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create navigation menu' })
  async createNavigationMenu(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string, @Body() dto: CreateNavigationMenuDto) {
    return this.navigationService.createNavigationMenu(user.tenantId, storeId, dto);
  }

  @Patch(':menuId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update navigation menu' })
  async updateNavigationMenu(@CurrentUser() user: AuthenticatedUser, @Param('menuId') menuId: string, @Body() dto: UpdateNavigationMenuDto) {
    return this.navigationService.updateNavigationMenu(user.tenantId, menuId, dto);
  }

  @Delete(':menuId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @RequirePermissions(Permission.SETTINGS_UPDATE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete navigation menu' })
  async deleteNavigationMenu(@CurrentUser() user: AuthenticatedUser, @Param('menuId') menuId: string) {
    await this.navigationService.deleteNavigationMenu(user.tenantId, menuId);
  }
}
