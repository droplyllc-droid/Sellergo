/**
 * Skip Store Check Decorator
 * Marks a route to skip store validation
 */

import { SetMetadata } from '@nestjs/common';

export const SKIP_STORE_CHECK_KEY = 'skipStoreCheck';
export const SkipStoreCheck = () => SetMetadata(SKIP_STORE_CHECK_KEY, true);
