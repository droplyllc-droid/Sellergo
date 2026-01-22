/**
 * Variants Service
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { ErrorCode } from '@sellergo/types';

export interface VariantOption {
  name: string;
  values: string[];
}

export interface CreateVariantDto {
  sku?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  trackQuantity: boolean;
  options: Record<string, string>;
  imageId?: string;
  isDefault?: boolean;
}

@Injectable()
export class VariantsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async getVariants(tenantId: string, productId: string) {
    return this.productsRepository.getVariants(tenantId, productId);
  }

  async createVariant(tenantId: string, storeId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.productsRepository.findById(tenantId, productId);
    if (!product) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Product not found' });

    const position = product.variants.length;

    const variant = await this.productsRepository.createVariant(tenantId, storeId, productId, {
      sku: dto.sku,
      price: dto.price,
      compareAtPrice: dto.compareAtPrice,
      quantity: dto.quantity,
      trackQuantity: dto.trackQuantity,
      options: dto.options,
      position,
      isDefault: dto.isDefault ?? false,
    });

    // Update product hasVariants flag
    if (!product.hasVariants) {
      await this.productsRepository.update(tenantId, productId, { hasVariants: true });
    }

    return variant;
  }

  async updateVariant(tenantId: string, variantId: string, dto: Partial<CreateVariantDto>) {
    return this.productsRepository.updateVariant(tenantId, variantId, dto);
  }

  async deleteVariant(tenantId: string, productId: string, variantId: string) {
    await this.productsRepository.deleteVariant(tenantId, variantId);

    // Check if product still has variants
    const variants = await this.productsRepository.getVariants(tenantId, productId);
    if (variants.length === 0) {
      await this.productsRepository.update(tenantId, productId, { hasVariants: false });
    }
  }

  async updateVariantOptions(tenantId: string, productId: string, options: VariantOption[]) {
    const variantOptions = options.map((opt, i) => ({
      id: crypto.randomUUID(),
      name: opt.name,
      values: opt.values,
      position: i,
    }));

    await this.productsRepository.update(tenantId, productId, { variantOptions });
    return variantOptions;
  }

  async generateVariantCombinations(options: VariantOption[]): Promise<Record<string, string>[]> {
    if (options.length === 0) return [];

    const combinations: Record<string, string>[] = [];

    const generate = (index: number, current: Record<string, string>) => {
      if (index === options.length) {
        combinations.push({ ...current });
        return;
      }

      const option = options[index];
      for (const value of option.values) {
        current[option.name] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  async bulkCreateVariants(
    tenantId: string,
    storeId: string,
    productId: string,
    basePrice: number,
    options: VariantOption[],
  ) {
    const combinations = await this.generateVariantCombinations(options);

    const variants = await Promise.all(
      combinations.map((optionValues, index) =>
        this.productsRepository.createVariant(tenantId, storeId, productId, {
          price: basePrice,
          quantity: 0,
          trackQuantity: true,
          options: optionValues,
          position: index,
          isDefault: index === 0,
        }),
      ),
    );

    await this.productsRepository.update(tenantId, productId, {
      hasVariants: true,
      variantOptions: options.map((opt, i) => ({
        id: crypto.randomUUID(),
        name: opt.name,
        values: opt.values,
        position: i,
      })),
    });

    return variants;
  }
}
