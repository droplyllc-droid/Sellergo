/**
 * Navigation Service
 * Business logic for store navigation menus
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { StoresRepository } from './stores.repository';
import { ErrorCode } from '@sellergo/types';
import { CreateNavigationMenuDto, UpdateNavigationMenuDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class NavigationService {
  constructor(private readonly storesRepository: StoresRepository) {}

  async getNavigationMenus(tenantId: string, storeId: string) {
    return this.storesRepository.getNavigationMenus(tenantId, storeId);
  }

  async createNavigationMenu(tenantId: string, storeId: string, dto: CreateNavigationMenuDto) {
    const items = dto.items.map((item, index) => ({
      id: crypto.randomUUID(),
      label: item.label,
      url: item.url,
      openInNewTab: item.openInNewTab ?? false,
      position: item.position ?? index,
    }));

    return this.storesRepository.createNavigationMenu({
      tenantId,
      storeId,
      type: dto.type,
      column: dto.column,
      title: dto.title,
      items,
    });
  }

  async updateNavigationMenu(tenantId: string, menuId: string, dto: UpdateNavigationMenuDto) {
    const menus = await this.storesRepository.getNavigationMenus(tenantId, '');
    const menu = menus.find((m: { id: string }) => m.id === menuId);

    if (!menu) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Navigation menu not found' });
    }

    const updateData: { title?: string; items?: Array<{ id: string; label: string; url: string; openInNewTab: boolean; position: number }> } = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.items !== undefined) {
      updateData.items = dto.items.map((item, index) => ({
        id: item.id || crypto.randomUUID(),
        label: item.label,
        url: item.url,
        openInNewTab: item.openInNewTab ?? false,
        position: item.position ?? index,
      }));
    }

    return this.storesRepository.updateNavigationMenu(tenantId, menuId, updateData);
  }

  async deleteNavigationMenu(tenantId: string, menuId: string) {
    const menus = await this.storesRepository.getNavigationMenus(tenantId, '');
    const menu = menus.find((m: { id: string }) => m.id === menuId);

    if (!menu) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Navigation menu not found' });
    }

    return this.storesRepository.deleteNavigationMenu(tenantId, menuId);
  }
}
