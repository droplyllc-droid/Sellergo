import type { PaginationInput, PaginationOutput, SortInput } from './types';

/**
 * Calculate pagination parameters for Prisma queries
 */
export function getPaginationParams(input?: PaginationInput): {
  skip: number;
  take: number;
} {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(100, Math.max(1, input?.limit ?? 20));

  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build pagination output from query results
 */
export function buildPaginationOutput(
  total: number,
  input?: PaginationInput
): PaginationOutput {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(100, Math.max(1, input?.limit ?? 20));
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Get sort parameters for Prisma queries
 */
export function getSortParams(
  input?: SortInput,
  allowedFields: readonly string[] = []
): Record<string, 'asc' | 'desc'> | undefined {
  if (!input?.field) {
    return undefined;
  }

  // Validate field is allowed (prevent injection)
  if (allowedFields.length > 0 && !allowedFields.includes(input.field)) {
    return undefined;
  }

  return {
    [input.field]: input.order ?? 'desc',
  };
}

/**
 * Generate a unique order number
 */
export function generateOrderNumber(prefix = 'ORD'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Generate a unique invoice number
 */
export function generateInvoiceNumber(prefix = 'INV'): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}${month}-${random}`;
}

/**
 * Generate a secure random token
 */
export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    const randomValue = randomValues[i];
    if (randomValue !== undefined) {
      token += chars[randomValue % chars.length];
    }
  }

  return token;
}

/**
 * Generate a slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique slug with suffix if needed
 */
export function generateUniqueSlug(text: string, existingSlugs: string[]): string {
  const baseSlug = generateSlug(text);

  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.includes(newSlug)) {
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }

  return newSlug;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(
  current: number,
  previous: number
): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Format decimal for currency display
 */
export function formatCurrency(
  amount: number | string,
  currency = 'TND',
  locale = 'en-US'
): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

/**
 * Check if a date is within a range
 */
export function isDateInRange(
  date: Date,
  startDate?: Date,
  endDate?: Date
): boolean {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

/**
 * Get date range for a period
 */
export function getDateRangeForPeriod(period: string): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const endDate = new Date(now);
  let startDate = new Date(now);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate.setDate(0); // Last day of previous month
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      // Default to last 30 days
      startDate.setDate(startDate.getDate() - 30);
  }

  return { startDate, endDate };
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }

  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const masked = '*'.repeat(data.length - visibleChars * 2);

  return `${start}${masked}${end}`;
}

/**
 * Mask email for display
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;

  const maskedLocal =
    localPart.length > 2
      ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart.slice(-1)
      : '*'.repeat(localPart.length);

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number for display
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '*'.repeat(phone.length);
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}
