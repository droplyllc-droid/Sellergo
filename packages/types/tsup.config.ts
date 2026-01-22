import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/auth/index.ts',
    'src/store/index.ts',
    'src/product/index.ts',
    'src/order/index.ts',
    'src/customer/index.ts',
    'src/billing/index.ts',
    'src/integration/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
