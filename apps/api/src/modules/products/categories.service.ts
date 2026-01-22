/**
 * Categories Service
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { ErrorCode } from '@sellergo/types';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { generateSlug } from '@sellergo/database';

@Injectable()
export class CategoriesService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async getCategories(tenantId: string, storeId: string) {
    return this.productsRepository.getCategories(tenantId, storeId);
  }

  async getCategoryTree(tenantId: string, storeId: string) {
    const categories = await this.productsRepository.getCategories(tenantId, storeId);

    // Build tree structure
    const categoryMap = new Map(categories.map(c => [c.id, { ...c, children: [] as typeof categories }]));
    const roots: typeof categories = [];

    for (const category of categoryMap.values()) {
      if (category.parentId && categoryMap.has(category.parentId)) {
        categoryMap.get(category.parentId)!.children.push(category);
      } else {
        roots.push(category);
      }
    }

    return roots;
  }

  async getCategory(tenantId: string, categoryId: string) {
    const category = await this.productsRepository.getCategoryById(tenantId, categoryId);
    if (!category) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Category not found' });
    return category;
  }

  async createCategory(tenantId: string, storeId: string, dto: CreateCategoryDto) {
    let slug = generateSlug(dto.name);
    let slugSuffix = 0;

    // Get existing categories for position
    const categories = await this.productsRepository.getCategories(tenantId, storeId);
    const position = categories.length;

    return this.productsRepository.createCategory(tenantId, storeId, {
      name: dto.name,
      slug,
      description: dto.description,
      image: dto.image,
      parentId: dto.parentId,
      position,
    });
  }

  async updateCategory(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.getCategory(tenantId, categoryId);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      updateData.name = dto.name;
      updateData.slug = generateSlug(dto.name);
    }
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.image !== undefined) updateData.image = dto.image;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.productsRepository.updateCategory(tenantId, categoryId, updateData);
  }

  async deleteCategory(tenantId: string, categoryId: string) {
    await this.getCategory(tenantId, categoryId);
    return this.productsRepository.deleteCategory(tenantId, categoryId);
  }

  async reorderCategories(tenantId: string, categoryIds: string[]) {
    const updates = categoryIds.map((id, position) =>
      this.productsRepository.updateCategory(tenantId, id, { position })
    );
    return Promise.all(updates);
  }
}
