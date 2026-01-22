import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disabled until Prisma client can be generated
  splitting: false,
  sourcemap: true,
  clean: true,
});
